import type { ElementProps } from './vnode.ts'

const SVG_NS = 'http://www.w3.org/2000/svg'
const XML_NS = 'http://www.w3.org/XML/1998/namespace'
const RESERVED_PROPS = new Set([
  'children',
  'mix',
  'key',
  'animate',
  'innerHTML',
  'class',
  'className',
])
const ATTR_FALLBACK = new Set([
  'width',
  'height',
  'href',
  'list',
  'form',
  'tabIndex',
  'download',
  'rowSpan',
  'colSpan',
  'role',
  'popover',
  'translate',
])
const BOOLEANISH_ATTR = new Set([
  'accent',
  'accentunder',
  'autoReverse',
  'contenteditable',
  'displaystyle',
  'draggable',
  'externalResourcesRequired',
  'fence',
  'focusable',
  'largeop',
  'movablelimits',
  'preserveAlpha',
  'separator',
  'spellcheck',
  'stretchy',
  'symmetric',
])
const UNSAFE_PROP = /^on|[\0\t\n\f\r "'/>=]/i
const EXEC_URL_ATTR = new Set(['href', 'src', 'action', 'formaction', 'xlink:href'])
const BLOCKED_JS_URL =
  "javascript:throw new Error('Remix has blocked a javascript: URL as a security precaution.')"
const VENDOR_STYLE_PREFIX = /^(?:-?(?:webkit|moz|ms|o)-|(?:[Ww]ebkit|[Mm]oz|[Mm]s|[Oo])(?=[A-Z]))/
// Properties whose grammar accepts a standalone number, including shorthands and number/length unions.
const NUMERIC_CSS_PROP =
  /^(?:animation(?:iterationcount)?|aspectratio|bookmarklevel|(?:borderimage|mask(?:border|boximage))(?:outset|slice|width)?|box(?:flex(?:group)?|ordinalgroup)|column(?:s|count|span)|flex(?:grow|linecount|negative|order|positive|shrink)?|floatdefer|font(?:sizeadjust|weight)|forcebrokenimageicon|grid(?:area|(?:column|row)(?:end|span|start)?)|hyphenatelimit(?:chars|lines)|initialletter|line(?:clamp|height)|mathdepth|maxlines|(?:fill|flood|stop|stroke)?opacity|order|orphans|readingorder|scale|shapeimagethreshold|tabsize|voicebalance|widows|zindex|zoom|stroke(?:dash(?:array|offset)|miterlimit|width))$/i

function skipHostProp(name: string, select: HTMLSelectElement | null): boolean {
  return (
    RESERVED_PROPS.has(name) ||
    !isAllowedHostPropName(name) ||
    (select !== null && name === 'defaultValue')
  )
}

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
    if (skipHostProp(name, select)) continue
    let value = next[name]
    if (value == null) patchHostProp(dom, name, value, curr[name], isSvg, select)
  }
  for (let name in next) {
    if (skipHostProp(name, select)) continue
    let value = next[name]
    if (value == null) continue
    let prev = curr[name]
    if (value !== prev) patchHostProp(dom, name, value, prev, isSvg, select)
  }

  if (select && wasMultiple !== select.multiple && next.value == null) {
    setSelectDefaultValue(select, next.defaultValue)
  }
}

function canUseProperty(
  dom: Element,
  name: string,
  isSvg: boolean,
  attr: string,
): dom is Element & Record<string, unknown> {
  return !isSvg && name in dom && !ATTR_FALLBACK.has(name) && !BOOLEANISH_ATTR.has(attr)
}

function removeHostAttribute(dom: Element, attr: string, isSvg: boolean): void {
  if (isSvg && attr.startsWith('xml:')) dom.removeAttributeNS(XML_NS, attr.slice(4))
  else dom.removeAttribute(attr)
}

function patchHostProp(
  dom: Element,
  name: string,
  value: unknown,
  prev: unknown,
  isSvg: boolean,
  select: HTMLSelectElement | null,
): void {
  let attr = normalizeAttributeName(name, isSvg)

  if (value == null) {
    if (
      (name === 'value' || name === 'checked') &&
      prev === undefined &&
      (value === undefined || (name === 'value' && select !== null))
    ) {
      return
    }
    if (canUseProperty(dom, name, isSvg, attr)) {
      try {
        if (name === 'value' || name === 'defaultValue') dom[name] = ''
        else if (name === 'checked' || name === 'defaultChecked' || name === 'selected') {
          dom[name] = false
        } else if (name === 'selectedIndex') {
          dom[name] = -1
        }
      } catch {}
    }
    removeHostAttribute(dom, attr, isSvg)
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
    if (isStyleObject(value)) {
      let prevStyle = name === 'style' && isStyleObject(prev) ? prev : undefined
      if (!prevStyle && name === 'style') dom.removeAttribute('style')
      patchStyleObject(dom, prevStyle, value)
      return
    }
  }

  if (canUseProperty(dom, name, isSvg, attr)) {
    // An empty attribute means present, and the server renders `""` as one. As a boolean property,
    // `""` would mean false. `hidden` can currently hold the string "until-found".
    if (value === '') {
      try {
        if (
          name === 'hidden' ||
          ((!dom.localName.includes('-') || name in HTMLElement.prototype) &&
            typeof dom[name] === 'boolean')
        ) {
          value = true
        }
      } catch {}
    }
    try {
      dom[name] = value
      return
    } catch {}
  }

  if (typeof value === 'function') return

  // Match server rendering: booleans render as "true"/"false" only for attributes that read them as
  // strings; otherwise `true` renders an empty attribute and `false` omits it.
  let stringify = typeof value !== 'boolean' || shouldStringifyBooleanAttribute(attr)
  if (stringify || value) {
    let str = stringify ? String(value) : ''
    if (isSvg && attr.startsWith('xml:')) dom.setAttributeNS(XML_NS, attr, str)
    else dom.setAttribute(attr, str)
  } else {
    removeHostAttribute(dom, attr, isSvg)
  }
}

export function isStyleObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function normalizeCssValue(key: string, value: unknown): string | undefined {
  if (value == null) return undefined
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return undefined
    if (
      value !== 0 &&
      !key.startsWith('--') &&
      !NUMERIC_CSS_PROP.test(key.replace(VENDOR_STYLE_PREFIX, '').replace(/-/g, ''))
    ) {
      return `${value}px`
    }
  }
  return String(value)
}

function toInlineStyleValue(name: string, value: unknown): string | undefined {
  if (typeof value === 'boolean') return undefined
  if (Array.isArray(value)) return value.join(', ')
  return normalizeCssValue(name, value)
}

function setInlineStyle(style: CSSStyleDeclaration, name: string, value: string): void {
  if (name.includes('-')) {
    if (value) style.setProperty(name, value)
    else style.removeProperty(name)
  } else {
    let record = style as unknown as Record<string, unknown>
    if (
      name === 'cssText' ||
      name === 'length' ||
      name === 'parentRule' ||
      typeof record[name] === 'function'
    ) {
      return
    }
    try {
      record[name] = value
    } catch {}
  }
}

function patchStyleObject(
  dom: Element,
  curr: Record<string, unknown> | undefined,
  next: Record<string, unknown>,
): void {
  let style = 'style' in dom ? (dom as HTMLElement).style : undefined
  if (!(style instanceof CSSStyleDeclaration)) {
    let parts: string[] = []
    for (let [key, value] of Object.entries(next)) {
      let cssValue = toInlineStyleValue(key, value)
      if (cssValue !== undefined) {
        let prop = key.startsWith('--')
          ? key
          : key
              .replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)
              .replace(/^(webkit|moz|ms|o)-/, '-$1-')
        parts.push(`${prop}: ${cssValue};`)
      }
    }
    dom.setAttribute('style', parts.join(' '))
    return
  }

  for (let name in curr) {
    if (
      next[name] !== curr[name] &&
      toInlineStyleValue(name, next[name]) === undefined &&
      toInlineStyleValue(name, curr[name]) !== undefined
    ) {
      setInlineStyle(style, name, '')
    }
  }

  for (let name in next) {
    if (curr && next[name] === curr[name]) continue
    let value = toInlineStyleValue(name, next[name])
    if (value !== undefined && value !== toInlineStyleValue(name, curr?.[name])) {
      setInlineStyle(style, name, value)
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
    option.defaultSelected = selected
    option.selected = selected
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
  let lower = attrName.toLowerCase()
  if (!EXEC_URL_ATTR.has(lower) && !(lower === 'data' && tagName.toLowerCase() === 'object')) {
    return value
  }
  // Browsers ignore leading C0 controls and spaces, plus tabs and newlines within URL schemes.
  return /^javascript:/i.test(String(value).replace(/^[\0- ]+|[\r\n\t]/g, ''))
    ? BLOCKED_JS_URL
    : value
}

const HTML_RENAMES: Record<string, string> = {
  className: 'class',
  htmlFor: 'for',
  acceptCharset: 'accept-charset',
  httpEquiv: 'http-equiv',
}

// React-style camelCase SVG props (e.g. strokeWidth, fillOpacity, stopColor) that correspond to
// kebab-case SVG attributes. Canonical camelCase SVG attributes (viewBox, clipPathUnits,
// stdDeviation, etc.) and standard kebab-case attributes do not match and pass through verbatim.
const SVG_KEBAB_PROP =
  /^(?:(?:stroke|fill|font|color|horiz|vert|overline|strikethrough|underline|unicode|v)[A-Z]|glyph[NO]|(?:marker(?:Start|Mid|End)|clip(?:Path|Rule)|whiteSpace)$)|(?:Baseline|Color|Opacity|Rendering|Spacing|Origin|Shift|Form|Rule|Background|Order|Events|Intent|Anchor|Decoration|Em|Effect|writingMode|capHeight|xHeight)$/

export function normalizeAttributeName(name: string, isSvg: boolean): string {
  if (isSvg) {
    if (name === 'className') return 'class'
    if (/^xlink(?:Href|:href)$/i.test(name)) return 'href'
    if (/^xml(?:Lang|Space|Base|nsXlink)$/.test(name)) {
      return name.replace(/([A-Z])/, (_, c: string) => `:${c.toLowerCase()}`)
    }
    return SVG_KEBAB_PROP.test(name)
      ? name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
      : name
  }
  if (name.startsWith('data-') || name.startsWith('aria-')) return name
  return Object.hasOwn(HTML_RENAMES, name) ? HTML_RENAMES[name] : name.toLowerCase()
}

export function shouldStringifyBooleanAttribute(name: string): boolean {
  return (
    name.startsWith('aria-') ||
    (name.startsWith('data-') &&
      name !== 'data-rmx-document' &&
      name !== 'data-rmx-preserve-dom') ||
    BOOLEANISH_ATTR.has(name) ||
    name === 'value'
  )
}

export function getMergedClassName(props: ElementProps): string | undefined {
  let classAttr = typeof props.class === 'string' ? props.class : ''
  let className = typeof props.className === 'string' ? props.className : ''
  return classAttr && className ? `${classAttr} ${className}` : classAttr || className || undefined
}
