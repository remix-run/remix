import { camelToKebab, normalizeCssValue } from '../../style/style.ts'
import type { ElementProps } from './vnode.ts'

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
