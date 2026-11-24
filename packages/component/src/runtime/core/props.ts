import type { ElementProps } from './vnode.ts'
import { camelToKebab, isStyleObject, normalizeCssValue } from '../../style/stylesheet.ts'

const SVG_NS = 'http://www.w3.org/2000/svg'
const RESERVED_HOST_PROPS = new Set([
  'children',
  'mix',
  'key',
  'animate',
  'innerHTML',
  'class',
  'className',
])

function skipHostProp(name: string, dom: Element): boolean {
  return (
    RESERVED_HOST_PROPS.has(name) ||
    !isAllowedHostPropName(name) ||
    (name === 'defaultValue' && dom instanceof HTMLSelectElement)
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
    if (skipHostProp(name, dom)) continue
    let value = next[name]
    if (value == null) patchHostProp(dom, name, value, curr[name], isSvg)
  }
  for (let name in next) {
    if (skipHostProp(name, dom)) continue
    let value = next[name]
    if (value == null) continue
    let previous = curr[name]
    if (value !== previous) patchHostProp(dom, name, value, previous, isSvg)
  }

  if (dom instanceof HTMLSelectElement && wasMultiple !== dom.multiple && next.value == null) {
    setSelectDefaultValue(dom, next.defaultValue)
  }
}

function patchHostProp(
  dom: Element,
  name: string,
  value: unknown,
  previous: unknown,
  isSvg: boolean,
): void {
  let { attr, ns } = normalizeAttributeName(name, isSvg)
  if (value == null) {
    if (
      (name === 'value' || name === 'checked') &&
      previous === undefined &&
      (value === undefined || (name === 'value' && dom instanceof HTMLSelectElement))
    )
      return
    if (canUseProperty(dom, name, isSvg, attr)) {
      try {
        if (name === 'value' || name === 'defaultValue') dom[name] = ''
        else if (name === 'checked' || name === 'defaultChecked' || name === 'selected')
          dom[name] = false
        else if (name === 'selectedIndex') dom[name] = -1
      } catch {}
    }
    removeAttribute(dom, attr, ns)
    return
  }

  value = sanitizeUrlAttribute(dom.localName, attr, value)

  if (name === 'value' && dom instanceof HTMLSelectElement) {
    setSelectValue(dom, value)
    return
  }

  if (attr === 'style') {
    if (isStyleObject(value)) {
      let prev = name === 'style' && isStyleObject(previous) ? previous : undefined
      if (!prev && name === 'style') dom.removeAttribute('style')
      patchStyleObject(dom, prev, value)
      return
    }
    if (typeof value === 'string') {
      dom.setAttribute('style', value)
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
    let attrValue = stringify ? String(value) : ''
    if (ns) dom.setAttributeNS(ns, attr, attrValue)
    else dom.setAttribute(attr, attrValue)
  } else {
    removeAttribute(dom, attr, ns)
  }
}

function removeAttribute(dom: Element, attr: string, ns?: string): void {
  if (ns) dom.removeAttributeNS(ns, attr.slice(attr.indexOf(':') + 1))
  else dom.removeAttribute(attr)
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
  for (let name in curr) {
    if (
      styleValueToCss(name, next[name]) === undefined &&
      styleValueToCss(name, curr[name]) !== undefined
    ) {
      style.removeProperty(camelToKebab(name))
    }
  }

  for (let name in next) {
    let value = styleValueToCss(name, next[name])
    if (value !== undefined && value !== styleValueToCss(name, curr?.[name])) {
      style.setProperty(camelToKebab(name), value)
    }
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

function canUseProperty(
  element: Element,
  name: string,
  isSvg: boolean,
  attr: string,
): element is Element & Record<string, unknown> {
  return (
    !isSvg &&
    name in element &&
    !ATTRIBUTE_FALLBACK_NAMES.has(name) &&
    !BOOLEANISH_STRING_ATTRIBUTES.has(attr)
  )
}

type AttributeName = { attr: string; ns?: string }

const htmlAttributeNames = new Map<string, AttributeName>()
const svgAttributeNames = new Map<string, AttributeName>()

export function normalizeAttributeName(name: string, isSvg: boolean): AttributeName {
  if (name.startsWith('data-') || name.startsWith('aria-')) return { attr: name }
  let cache = isSvg ? svgAttributeNames : htmlAttributeNames
  let normalized = cache.get(name)
  if (normalized) return normalized

  if (name === 'className') normalized = { attr: 'class' }
  else if (isSvg) normalized = SVG_ATTR_ALIASES.get(name) ?? { attr: svgCamelToKebab(name) }
  else if (name === 'htmlFor') normalized = { attr: 'for' }
  else if (name === 'acceptCharset') normalized = { attr: 'accept-charset' }
  else if (name === 'httpEquiv') normalized = { attr: 'http-equiv' }
  else normalized = { attr: name.toLowerCase() }

  if (cache.size >= 256) cache.clear()
  cache.set(name, normalized)
  return normalized
}

// Remix reads these by presence, so `true` renders an empty attribute and `false` omits it.
const REMIX_BOOLEAN_ATTRIBUTES = new Set(['data-rmx-document', 'data-rmx-preserve-dom'])

export function shouldStringifyBooleanAttribute(name: string): boolean {
  return (
    name.startsWith('aria-') ||
    (name.startsWith('data-') && !REMIX_BOOLEAN_ATTRIBUTES.has(name)) ||
    BOOLEANISH_STRING_ATTRIBUTES.has(name) ||
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

function styleValueToCss(name: string, value: unknown): string | undefined {
  if (typeof value === 'boolean') return undefined
  if (Array.isArray(value)) return value.join(', ')
  return normalizeCssValue(name, value)
}

export function getMergedClassName(props: ElementProps): string | undefined {
  let classAttr = typeof props.class === 'string' ? props.class : ''
  let className = typeof props.className === 'string' ? props.className : ''
  return classAttr && className ? `${classAttr} ${className}` : classAttr || className || undefined
}

const SVG_ATTR_ALIASES = new Map<string, AttributeName>()
for (let attr of [
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
]) {
  // xlink:href, xlinkHref, and xlink-href all refer to the same attribute.
  let camel = attr.replace(/:([a-z])/, (_, initial: string) => initial.toUpperCase())
  let normalized: AttributeName = { attr }
  if (attr.startsWith('xlink:')) normalized.ns = 'http://www.w3.org/1999/xlink'
  if (attr.startsWith('xml:')) normalized.ns = 'http://www.w3.org/XML/1998/namespace'
  SVG_ATTR_ALIASES.set(camel, normalized)
  SVG_ATTR_ALIASES.set(svgCamelToKebab(camel), normalized)
  if (camel !== attr) SVG_ATTR_ALIASES.set(attr, normalized)
}

function svgCamelToKebab(input: string): string {
  return input
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/_/g, '-')
    .toLowerCase()
}
