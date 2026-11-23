import type { ElementProps } from './vnode.ts'
import { camelToKebab, normalizeCssValue } from '../../style/style.ts'

const SVG_NS = 'http://www.w3.org/2000/svg'

function isFrameworkProp(name: string): boolean {
  return (
    name === 'children' ||
    name === 'mix' ||
    name === 'key' ||
    name === 'animate' ||
    name === 'innerHTML' ||
    name === 'on'
  )
}

function toLocalName(attrName: string): string {
  let separatorIndex = attrName.indexOf(':')
  if (separatorIndex === -1) return attrName
  return attrName.slice(separatorIndex + 1)
}

function clearRuntimePropertyOnRemoval(dom: Element & Record<string, unknown>, name: string): void {
  try {
    if (name === 'value' || name === 'defaultValue') {
      dom[name] = ''
      return
    }
    if (name === 'checked' || name === 'defaultChecked' || name === 'selected') {
      dom[name] = false
      return
    }
    if (name === 'selectedIndex') {
      dom[name] = -1
    }
  } catch {}
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
  let wasMultiple = dom instanceof HTMLSelectElement ? dom.multiple : undefined
  let currClassName = getMergedClassName(curr)
  let nextClassName = getMergedClassName(next)

  if (currClassName !== nextClassName) {
    if (nextClassName) {
      dom.setAttribute('class', nextClassName)
    } else {
      dom.removeAttribute('class')
    }
  }

  for (let name in curr) {
    if (isFrameworkProp(name)) continue
    if (name === 'defaultValue' && dom instanceof HTMLSelectElement) continue
    if (name === 'value' && dom instanceof HTMLSelectElement && curr.value === undefined) continue
    if (!isAllowedHostPropName(name)) continue
    if (name === 'class' || name === 'className') continue
    if (name in next && next[name] != null) continue

    let { ns, attr } = normalizeAttributeName(name, isSvg)
    if (canUseProperty(dom, name, isSvg, attr)) {
      clearRuntimePropertyOnRemoval(dom, name)
    }

    if (ns) dom.removeAttributeNS(ns, toLocalName(attr))
    else dom.removeAttribute(attr)
  }

  for (let name in next) {
    if (isFrameworkProp(name)) continue
    if (name === 'defaultValue' && dom instanceof HTMLSelectElement) continue
    if (!isAllowedHostPropName(name)) continue
    if (name === 'class' || name === 'className') continue

    let nextValue = next[name]
    if (nextValue == null) continue

    let prevValue = curr[name]
    if (prevValue === nextValue) continue

    if (name === 'style' && isStyleObject(nextValue)) {
      if (isStyleObject(prevValue)) {
        patchStyleObject(dom, prevValue, nextValue)
      } else {
        dom.removeAttribute('style')
        patchStyleObject(dom, undefined, nextValue)
      }
      continue
    }

    patchHostProp(dom, name, nextValue, isSvg)
  }

  if (dom instanceof HTMLSelectElement && wasMultiple !== dom.multiple && next.value == null) {
    setSelectDefaultValue(dom, next.defaultValue)
  }
}

function patchHostProp(dom: Element, name: string, value: unknown, isSvg: boolean): void {
  let { ns, attr } = normalizeAttributeName(name, isSvg)
  value = sanitizeUrlAttribute(dom.localName, attr, value)

  if (name === 'value' && dom instanceof HTMLSelectElement) {
    setSelectValue(dom, value)
    return
  }

  if (attr === 'style' && isStyleObject(value)) {
    patchStyleObject(dom, undefined, value)
    return
  }

  if (attr === 'style' && typeof value === 'string') {
    dom.setAttribute('style', value)
    return
  }

  if (canUseProperty(dom, name, isSvg, attr)) {
    // An empty attribute means present, and the server renders `""` as one. As a boolean property,
    // `""` would mean false. `hidden` can currently hold the string "until-found".
    if (value === '') {
      try {
        if (name === 'hidden' || typeof dom[name] === 'boolean') value = true
      } catch {}
    }
    try {
      dom[name] = value == null ? '' : value
      return
    } catch {}
  }

  if (typeof value === 'function') return

  // Match server rendering: booleans render as "true"/"false" only for attributes that read them as
  // strings; otherwise `true` renders an empty attribute and `false` omits it.
  let stringify = typeof value !== 'boolean' || shouldStringifyBooleanAttribute(attr)
  if (value != null && (stringify || value)) {
    let attrValue = stringify ? String(value) : ''
    if (ns) dom.setAttributeNS(ns, attr, attrValue)
    else dom.setAttribute(attr, attrValue)
  } else {
    if (ns) dom.removeAttributeNS(ns, toLocalName(attr))
    else dom.removeAttribute(attr)
  }
}

function isStyleObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function patchStyleObject(
  dom: Element,
  curr: Record<string, unknown> | undefined,
  next: Record<string, unknown>,
): void {
  if (!(dom instanceof HTMLElement || dom instanceof SVGElement)) {
    dom.setAttribute('style', serializeStyleObject(next))
    return
  }

  let style = dom.style
  if (curr) {
    for (let name in curr) {
      let nextCssValue = styleValueToCss(name, next[name])
      if (nextCssValue !== undefined) continue

      let prevCssValue = styleValueToCss(name, curr[name])
      if (prevCssValue === undefined) continue

      style.removeProperty(camelToKebab(name))
    }
  }

  for (let name in next) {
    let nextCssValue = styleValueToCss(name, next[name])
    if (nextCssValue === undefined) continue

    let prevCssValue = curr ? styleValueToCss(name, curr[name]) : undefined
    if (prevCssValue === nextCssValue) continue

    style.setProperty(camelToKebab(name), nextCssValue)
  }
}

export function getSelectValues(value: unknown): Set<string> | undefined {
  if (value == null) return undefined
  return new Set(Array.isArray(value) ? value.map(String) : [String(value)])
}

export function setSelectDefaultValue(
  select: HTMLSelectElement,
  value: unknown,
  scalar = !select.multiple,
): void {
  let values = getSelectValues(value)
  let options = Array.from(select.options)
  let matched = false
  for (let option of options) {
    let selected = (values?.has(option.value) ?? false) && !(scalar && matched)
    if (selected) matched = true
    option.defaultSelected = selected
    option.selected = selected
  }
  if (!select.multiple && !matched) {
    let firstEnabled = options.find((option) => !option.disabled)
    if (firstEnabled) firstEnabled.selected = true
  }
}

export function setSelectValue(select: HTMLSelectElement, value: unknown): void {
  if (!select.multiple || !Array.isArray(value)) {
    select.value = value == null ? '' : String(value)
    return
  }
  let values = getSelectValues(value)
  for (let option of select.options) option.selected = values?.has(option.value) ?? false
}

const ATTRIBUTE_FALLBACK_NAMES = new Set([
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

const BOOLEANISH_STRING_ATTRIBUTES = new Set([
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

const BLOCKED_HOST_PROP_NAMES = new Set(['__proto__', 'outerHTML'])
const UNSAFE_HOST_PROP_NAME = /^on|[\u0000\t\n\f\r "'/>=]/i
const EXECUTABLE_URL_ATTRIBUTES = new Set(['href', 'src', 'action', 'formaction', 'xlink:href'])
// Browsers ignore leading C0 controls and spaces, plus tabs and newlines within URL schemes.
const JAVASCRIPT_PROTOCOL =
  /^[\u0000-\u001F ]*j[\r\n\t]*a[\r\n\t]*v[\r\n\t]*a[\r\n\t]*s[\r\n\t]*c[\r\n\t]*r[\r\n\t]*i[\r\n\t]*p[\r\n\t]*t[\r\n\t]*:/i
const BLOCKED_JAVASCRIPT_URL =
  "javascript:throw new Error('Remix has blocked a javascript: URL as a security precaution.')"

export function isAllowedHostPropName(name: string): boolean {
  return name.length > 0 && !UNSAFE_HOST_PROP_NAME.test(name) && !BLOCKED_HOST_PROP_NAMES.has(name)
}

export function sanitizeUrlAttribute(tagName: string, attrName: string, value: unknown): unknown {
  let isExecutableUrl =
    EXECUTABLE_URL_ATTRIBUTES.has(attrName) ||
    (attrName === 'data' && tagName.toLowerCase() === 'object')
  if (!isExecutableUrl) return value

  return JAVASCRIPT_PROTOCOL.test(String(value)) ? BLOCKED_JAVASCRIPT_URL : value
}

export function canUseProperty(
  element: Element,
  name: string,
  isSvg: boolean,
  attr: string,
): element is Element & Record<string, unknown> {
  if (isSvg) return false
  if (ATTRIBUTE_FALLBACK_NAMES.has(name)) return false
  if (isBooleanishStringAttribute(attr)) return false
  return name in element
}

// Prop names repeat constantly across elements and renders; cache the
// normalized results so the string work and object allocation happen once
// per distinct name. Entries are shared — callers must not mutate them.
const NORMALIZATION_CACHE_LIMIT = 256
const htmlAttributeNameCache = new Map<string, { ns?: string; attr: string }>()
const svgAttributeNameCache = new Map<string, { ns?: string; attr: string }>()

export function normalizeAttributeName(
  name: string,
  isSvg: boolean,
): { ns?: string; attr: string } {
  let cache = isSvg ? svgAttributeNameCache : htmlAttributeNameCache
  let cached = cache.get(name)
  if (cached === undefined) {
    cached = computeAttributeName(name, isSvg)
    if (cache.size >= NORMALIZATION_CACHE_LIMIT) {
      let oldest = cache.keys().next()
      if (!oldest.done) cache.delete(oldest.value)
    }
    cache.set(name, cached)
  }
  return cached
}

function computeAttributeName(name: string, isSvg: boolean): { ns?: string; attr: string } {
  if (name.startsWith('aria-') || name.startsWith('data-')) return { attr: name }

  if (name === 'className') return { attr: 'class' }

  if (!isSvg) {
    if (name === 'htmlFor') return { attr: 'for' }
    if (name === 'tabIndex') return { attr: 'tabindex' }
    if (name === 'acceptCharset') return { attr: 'accept-charset' }
    if (name === 'httpEquiv') return { attr: 'http-equiv' }
    return { attr: name.toLowerCase() }
  }

  return normalizeSvgAttribute(name)
}

function isBooleanishStringAttribute(name: string): boolean {
  return BOOLEANISH_STRING_ATTRIBUTES.has(name)
}

// Remix reads these by presence, so `true` renders an empty attribute and `false` omits it.
const REMIX_BOOLEAN_ATTRIBUTES = new Set(['data-rmx-document', 'data-rmx-preserve-dom'])

export function shouldStringifyBooleanAttribute(name: string): boolean {
  return (
    name.startsWith('aria-') ||
    (name.startsWith('data-') && !REMIX_BOOLEAN_ATTRIBUTES.has(name)) ||
    isBooleanishStringAttribute(name) ||
    name === 'value'
  )
}

export function serializeStyleObject(style: Record<string, unknown>): string {
  let parts: string[] = []

  for (let [key, value] of Object.entries(style)) {
    let cssValue = styleValueToCss(key, value)
    if (cssValue === undefined) continue

    parts.push(`${camelToKebab(key)}: ${cssValue};`)
  }

  return parts.join(' ')
}

export function styleValueToCss(name: string, value: unknown): string | undefined {
  if (typeof value === 'boolean') return undefined
  if (Array.isArray(value)) return value.join(', ')
  return normalizeCssValue(name, value)
}

export function getMergedClassName(props: ElementProps): string | undefined {
  let classAttr = typeof props.class === 'string' ? props.class : ''
  let className = typeof props.className === 'string' ? props.className : ''
  let merged = classAttr && className ? `${classAttr} ${className}` : classAttr || className
  return merged || undefined
}

const XLINK_NS = 'http://www.w3.org/1999/xlink'
const XML_NS = 'http://www.w3.org/XML/1998/namespace'

const CANONICAL_CAMEL_SVG_ATTRS = new Set([
  'accentHeight',
  'attributeName',
  'attributeType',
  'autoReverse',
  'baseFrequency',
  'baseProfile',
  'calcMode',
  'viewBox',
  'preserveAspectRatio',
  'externalResourcesRequired',
  'filterRes',
  'gradientUnits',
  'gradientTransform',
  'glyphRef',
  'kernelMatrix',
  'kernelUnitLength',
  'keyPoints',
  'keySplines',
  'keyTimes',
  'lengthAdjust',
  'limitingConeAngle',
  'markerHeight',
  'patternUnits',
  'patternContentUnits',
  'patternTransform',
  'markerWidth',
  'numOctaves',
  'pathLength',
  'pointsAtX',
  'pointsAtY',
  'pointsAtZ',
  'preserveAlpha',
  'clipPathUnits',
  'maskUnits',
  'maskContentUnits',
  'filterUnits',
  'primitiveUnits',
  'refX',
  'refY',
  'requiredExtensions',
  'requiredFeatures',
  'specularConstant',
  'specularExponent',
  'spreadMethod',
  'startOffset',
  'stdDeviation',
  'stitchTiles',
  'surfaceScale',
  'systemLanguage',
  'tableValues',
  'targetX',
  'targetY',
  'textLength',
  'viewTarget',
  'xChannelSelector',
  'yChannelSelector',
  'zoomAndPan',
  'edgeMode',
  'diffuseConstant',
  'markerUnits',
])

const SVG_ATTR_ALIASES = new Map<string, string>()
for (let attr of CANONICAL_CAMEL_SVG_ATTRS) {
  SVG_ATTR_ALIASES.set(svgCamelToKebab(attr), attr)
}

// Each namespaced attribute is accepted as `xlinkHref`, `xlink:href`, or `xlink-href`.
const NAMESPACED_SVG_ATTR = /^(xlink|xmlns|xml)(?:[:-]([a-z]+)|([A-Z][a-z]+))$/
const NAMESPACED_SVG_ATTRS = new Set([
  'xlink:href',
  'xlink:actuate',
  'xlink:arcrole',
  'xlink:role',
  'xlink:show',
  'xlink:title',
  'xlink:type',
  'xml:base',
  'xml:lang',
  'xml:space',
  'xmlns:xlink',
])

function normalizeSvgAttributeName(name: string): string {
  let alias = SVG_ATTR_ALIASES.get(name)
  if (alias) return alias

  if (CANONICAL_CAMEL_SVG_ATTRS.has(name)) return name

  return svgCamelToKebab(name)
}

function normalizeSvgAttribute(name: string): {
  ns?: string
  attr: string
} {
  let match = NAMESPACED_SVG_ATTR.exec(name)
  if (match) {
    let [, prefix, separatedName, camelName] = match
    let attr = `${prefix}:${separatedName ?? camelName.toLowerCase()}`
    if (NAMESPACED_SVG_ATTRS.has(attr)) {
      if (prefix === 'xmlns') return { attr }
      return { ns: prefix === 'xlink' ? XLINK_NS : XML_NS, attr }
    }
  }

  return { attr: normalizeSvgAttributeName(name) }
}

function svgCamelToKebab(input: string): string {
  return input
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/_/g, '-')
    .toLowerCase()
}
