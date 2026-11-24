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
const SVG_CAMEL_RE =
  /^(?:accentHeight|attribute(?:Name|Type)|autoReverse|base(?:Frequency|Profile)|calcMode|clipPathUnits|diffuseConstant|edgeMode|externalResourcesRequired|filter(?:Res|Units)|glyphRef|gradient(?:Transform|Units)|kernel(?:Matrix|UnitLength)|key(?:Points|Splines|Times)|lengthAdjust|limitingConeAngle|marker(?:Height|Units|Width)|mask(?:Content)?Units|numOctaves|pathLength|pattern(?:ContentUnits|Transform|Units)|pointsAt[XYZ]|preserve(?:Alpha|AspectRatio)|primitiveUnits|ref[XY]|required(?:Extensions|Features)|specular(?:Constant|Exponent)|spreadMethod|startOffset|stdDeviation|stitchTiles|surfaceScale|systemLanguage|tableValues|target[XY]|textLength|view(?:Box|Target)|[xy]ChannelSelector|zoomAndPan)$/
const NS_SVG_RE = /^(xlink|xml|xmlns)(?:[:-]([a-z]+)|([A-Z][a-z]+))$/

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

  let visit = (name: string, value: unknown, prev: unknown) => {
    if (
      RESERVED_PROPS.test(name) ||
      !isAllowedHostPropName(name) ||
      (select && name === 'defaultValue')
    ) {
      return
    }
    patchHostProp(dom, name, value, prev, isSvg, select)
  }

  for (let name in curr) {
    if (next[name] == null) visit(name, next[name], curr[name])
  }
  for (let name in next) {
    let value = next[name]
    let prev = curr[name]
    if (value != null && value !== prev) visit(name, value, prev)
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
  let del = () =>
    ns ? dom.removeAttributeNS(ns, attr.slice(attr.indexOf(':') + 1)) : dom.removeAttribute(attr)

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
    del()
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
  } else {
    del()
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
  let set = (k: string, v: string) =>
    k.includes('-')
      ? v
        ? style.setProperty(k, v)
        : style.removeProperty(k)
      : ((style as unknown as Record<string, string>)[k] = v)
  for (let k in curr) {
    if (toStyleValue(k, next[k]) === undefined && toStyleValue(k, curr[k]) !== undefined) {
      set(k, '')
    }
  }
  for (let k in next) {
    let val = toStyleValue(k, next[k])
    if (val !== undefined && val !== toStyleValue(k, curr?.[k])) set(k, val)
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

const HTML_RENAMES: Record<string, string> = {
  className: 'class',
  htmlFor: 'for',
  acceptCharset: 'accept-charset',
  httpEquiv: 'http-equiv',
}

export function normalizeAttributeName(name: string, isSvg: boolean): AttributeName {
  if (name.startsWith('data-') || name.startsWith('aria-')) return { attr: name }
  if (!isSvg) return { attr: HTML_RENAMES[name] ?? name.toLowerCase() }
  if (name === 'className') return { attr: 'class' }
  if (SVG_CAMEL_RE.test(name)) return { attr: name }
  if (name.includes('-')) {
    let camel = name.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())
    if (SVG_CAMEL_RE.test(camel)) return { attr: camel }
  }
  let m = NS_SVG_RE.exec(name)
  if (m) {
    let prefix = m[1]
    let local = m[2] ?? m[3].toLowerCase()
    if (
      (prefix === 'xmlns'
        ? local === 'xlink'
        : (prefix === 'xlink'
            ? /^(?:href|actuate|arcrole|role|show|title|type)$/
            : /^(?:base|lang|space)$/
          ).test(local))
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
  return {
    attr: name
      .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
      .replace(/_/g, '-')
      .toLowerCase(),
  }
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
