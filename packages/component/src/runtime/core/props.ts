import type { ElementProps } from './vnode.ts'
import { camelToKebab, normalizeCssValue } from '../../style/stylesheet.ts'

const SVG_NS = 'http://www.w3.org/2000/svg'
const RESERVED_PROPS = /^(?:children|mix|key|animate|innerHTML|class|className)$/
const ATTR_FALLBACK =
  /^(?:width|height|href|list|form|tabIndex|download|rowSpan|colSpan|role|popover|translate)$/
const BOOLEANISH_ATTR =
  /^(?:accent(?:under)?|autoReverse|contenteditable|displaystyle|draggable|externalResourcesRequired|fence|focusable|largeop|movablelimits|preserveAlpha|separator|spellcheck|stretchy|symmetric)$/
const UNSAFE_PROP = /^on|[\0\t\n\f\r "'/>=]/i
const EXEC_URL_ATTR = /^(?:href|src|action|formaction|xlink:href)$/
const BLOCKED_JS_URL =
  "javascript:throw new Error('Remix has blocked a javascript: URL as a security precaution.')"
const UNITLESS_STYLE =
  /acit|ex(?:s|g|n|p|$)|rph|grid|ows|mnc|ntw|ine-?[ch]|zoo|^ord|itera|anim(?:ation)?$|border-?i|mask-?b|scale|shape-?i|tab-?s|clamp/i

/**
 * Patches DOM attributes and selected properties from old props to new props.
 *
 * @param curr Previous host props.
 * @param next Next host props.
 * @param dom Element to patch.
 */
export function patchHostProps(curr: ElementProps, next: ElementProps, dom: Element): void {
  let isSvg = dom.namespaceURI === SVG_NS
  let select = dom instanceof HTMLSelectElement ? dom : null
  let wasMultiple = select?.multiple
  let currClass = getMergedClassName(curr)
  let nextClass = getMergedClassName(next)

  if (currClass !== nextClass) {
    if (nextClass) dom.setAttribute('class', nextClass)
    else dom.removeAttribute('class')
  }

  for (let name in curr) {
    if (
      next[name] == null &&
      !RESERVED_PROPS.test(name) &&
      isAllowedHostPropName(name) &&
      !(select && name === 'defaultValue')
    ) {
      patchHostProp(dom, name, next[name], curr[name], isSvg, select)
    }
  }
  for (let name in next) {
    let value = next[name]
    let prev = curr[name]
    if (
      value != null &&
      value !== prev &&
      !RESERVED_PROPS.test(name) &&
      isAllowedHostPropName(name) &&
      !(select && name === 'defaultValue')
    ) {
      patchHostProp(dom, name, value, prev, isSvg, select)
    }
  }

  if (select && wasMultiple !== select.multiple && next.value == null) {
    setSelectDefaultValue(select, next.defaultValue)
  }
}

function patchHostProp(
  dom: Element,
  name: string,
  value: unknown,
  prev: unknown,
  isSvg: boolean,
  select: HTMLSelectElement | null,
): void {
  let { attr, ns } = normalizeAttributeName(name, isSvg)
  let useProp =
    !isSvg && name in dom && !ATTR_FALLBACK.test(name) && !BOOLEANISH_ATTR.test(attr)
  let el = dom as Element & Record<string, unknown>

  if (value == null) {
    if (
      (name === 'value' || name === 'checked') &&
      prev === undefined &&
      (value === undefined || (name === 'value' && select))
    )
      return
    if (useProp) {
      try {
        if (name === 'value' || name === 'defaultValue') el[name] = ''
        else if (name === 'checked' || name === 'defaultChecked' || name === 'selected')
          el[name] = false
        else if (name === 'selectedIndex') el[name] = -1
      } catch {}
    }
    if (ns) dom.removeAttributeNS(ns, attr.slice(attr.indexOf(':') + 1))
    else dom.removeAttribute(attr)
    return
  }

  value = sanitizeUrlAttribute(dom.localName, attr, value)

  if (select && name === 'value') {
    setSelectValue(select, value)
    return
  }

  if (attr === 'style') {
    if (typeof value === 'string') {
      dom.setAttribute('style', value)
      return
    }
    if (typeof value === 'object' && !Array.isArray(value)) {
      let prevStyle =
        name === 'style' && typeof prev === 'object' && prev !== null && !Array.isArray(prev)
          ? (prev as Record<string, unknown>)
          : undefined
      if (!prevStyle && name === 'style') dom.removeAttribute('style')
      patchStyleObject((dom as HTMLElement).style, prevStyle, value as Record<string, unknown>)
      return
    }
  }

  if (useProp) {
    // An empty attribute means present; as a boolean property `""` would be false.
    if (value === '') {
      try {
        if (
          name === 'hidden' ||
          ((!dom.localName.includes('-') || name in HTMLElement.prototype) &&
            typeof el[name] === 'boolean')
        ) {
          value = true
        }
      } catch {}
    }
    try {
      el[name] = value
      return
    } catch {}
  }

  if (typeof value === 'function') return

  let stringify = typeof value !== 'boolean' || shouldStringifyBooleanAttribute(attr)
  if (stringify || value) {
    let str = stringify ? String(value) : ''
    if (ns) dom.setAttributeNS(ns, attr, str)
    else dom.setAttribute(attr, str)
  } else if (ns) {
    dom.removeAttributeNS(ns, attr.slice(attr.indexOf(':') + 1))
  } else {
    dom.removeAttribute(attr)
  }
}

function toStyleValue(name: string, val: unknown): string | undefined {
  if (val == null || typeof val === 'boolean') return undefined
  if (Array.isArray(val)) return val.join(', ')
  if (typeof val === 'number') {
    if (!Number.isFinite(val)) return undefined
    return val && name[0] !== '-' && !UNITLESS_STYLE.test(name) ? `${val}px` : String(val)
  }
  return String(val)
}

function patchStyleObject(
  style: CSSStyleDeclaration | undefined,
  curr: Record<string, unknown> | undefined,
  next: Record<string, unknown>,
): void {
  if (!style) return
  let s = style as unknown as Record<string, string>
  for (let k in curr) {
    if (toStyleValue(k, next[k]) === undefined && toStyleValue(k, curr[k]) !== undefined) {
      if (k.includes('-')) style.removeProperty(k)
      else s[k] = ''
    }
  }
  for (let k in next) {
    let val = toStyleValue(k, next[k])
    if (val !== undefined && val !== toStyleValue(k, curr?.[k])) {
      if (k.includes('-')) style.setProperty(k, val)
      else s[k] = val
    }
  }
}

export function getSelectValues(value: unknown): Set<string> | undefined {
  return value == null
    ? undefined
    : new Set(Array.isArray(value) ? value.map(String) : [String(value)])
}

export function setSelectDefaultValue(
  select: HTMLSelectElement,
  value: unknown,
  scalar = !select.multiple,
): void {
  let values = getSelectValues(value)
  let matched = false
  let firstEnabled: HTMLOptionElement | undefined
  for (let option of select.options) {
    if (!firstEnabled && !option.disabled) firstEnabled = option
    let selected = (values?.has(option.value) ?? false) && !(scalar && matched)
    if (selected) matched = true
    option.defaultSelected = option.selected = selected
  }
  if (!select.multiple && !matched && firstEnabled) firstEnabled.selected = true
}

export function setSelectValue(select: HTMLSelectElement, value: unknown): void {
  if (!select.multiple || !Array.isArray(value)) {
    select.value = value == null ? '' : String(value)
    return
  }
  let values = getSelectValues(value)
  for (let option of select.options) option.selected = values?.has(option.value) ?? false
}

export function isAllowedHostPropName(name: string): boolean {
  return !!name && name !== '__proto__' && name !== 'outerHTML' && !UNSAFE_PROP.test(name)
}

export function sanitizeUrlAttribute(tagName: string, attrName: string, value: unknown): unknown {
  if (!EXEC_URL_ATTR.test(attrName) && !(attrName === 'data' && tagName.toLowerCase() === 'object'))
    return value
  return /^javascript:/i.test(String(value).replace(/^[\0- ]+|[\r\n\t]/g, ''))
    ? BLOCKED_JS_URL
    : value
}

type AttributeName = { attr: string; ns?: string }

const HTML_ATTR_RENAMES: Record<string, string> = {
  className: 'class',
  htmlFor: 'for',
  acceptCharset: 'accept-charset',
  httpEquiv: 'http-equiv',
}

export function normalizeAttributeName(name: string, isSvg: boolean): AttributeName {
  if (name.startsWith('data-') || name.startsWith('aria-')) return { attr: name }
  if (!isSvg) return { attr: HTML_ATTR_RENAMES[name] ?? name.toLowerCase() }
  if (name === 'className') return { attr: 'class' }
  return normalizeSvgAttribute(name)
}

export function shouldStringifyBooleanAttribute(name: string): boolean {
  return (
    name.startsWith('aria-') ||
    (name.startsWith('data-') &&
      name !== 'data-rmx-document' &&
      name !== 'data-rmx-preserve-dom') ||
    BOOLEANISH_ATTR.test(name) ||
    name === 'value'
  )
}

export function serializeStyleObject(style: Record<string, unknown>): string {
  let parts: string[] = []
  for (let key in style) {
    let raw = style[key]
    let cssValue =
      typeof raw === 'boolean'
        ? undefined
        : Array.isArray(raw)
          ? raw.join(', ')
          : normalizeCssValue(key, raw)
    if (cssValue !== undefined) parts.push(`${camelToKebab(key)}: ${cssValue};`)
  }
  return parts.join(' ')
}

export function getMergedClassName(props: ElementProps): string | undefined {
  let a = typeof props.class === 'string' ? props.class : ''
  let b = typeof props.className === 'string' ? props.className : ''
  return a && b ? `${a} ${b}` : a || b || undefined
}

const SVG_CAMEL_LIST =
  'accentHeight attributeName attributeType autoReverse baseFrequency baseProfile calcMode viewBox preserveAspectRatio externalResourcesRequired filterRes gradientUnits gradientTransform glyphRef kernelMatrix kernelUnitLength keyPoints keySplines keyTimes lengthAdjust limitingConeAngle markerHeight patternUnits patternContentUnits patternTransform markerWidth numOctaves pathLength pointsAtX pointsAtY pointsAtZ preserveAlpha clipPathUnits maskUnits maskContentUnits filterUnits primitiveUnits refX refY requiredExtensions requiredFeatures specularConstant specularExponent spreadMethod startOffset stdDeviation stitchTiles surfaceScale systemLanguage tableValues targetX targetY textLength viewTarget xChannelSelector yChannelSelector zoomAndPan edgeMode diffuseConstant markerUnits'

let svgAliases: Map<string, AttributeName> | undefined

function normalizeSvgAttribute(name: string): AttributeName {
  if (!svgAliases) {
    svgAliases = new Map()
    for (let attr of SVG_CAMEL_LIST.split(' ')) {
      let entry: AttributeName = { attr }
      svgAliases.set(attr, entry).set(svgCamelToKebab(attr), entry)
    }
  }
  let alias = svgAliases.get(name)
  if (alias) return alias
  let match = /^(xlink|xml|xmlns)(?:[:-]([a-z]+)|([A-Z][a-z]+))$/.exec(name)
  if (match) {
    let prefix = match[1]
    let local = match[2] ?? match[3].toLowerCase()
    if (
      (prefix === 'xlink'
        ? 'href actuate arcrole role show title type'
        : prefix === 'xml'
          ? 'base lang space'
          : 'xlink'
      )
        .split(' ')
        .includes(local)
    ) {
      let attr = `${prefix}:${local}`
      return prefix === 'xmlns'
        ? { attr }
        : {
            attr,
            ns:
              prefix === 'xlink'
                ? 'http://www.w3.org/1999/xlink'
                : 'http://www.w3.org/XML/1998/namespace',
          }
    }
  }
  return { attr: svgCamelToKebab(name) }
}

function svgCamelToKebab(input: string): string {
  return input
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/_/g, '-')
    .toLowerCase()
}
