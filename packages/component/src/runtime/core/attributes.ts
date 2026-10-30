import { camelToKebab, normalizeCssValue } from '../../style/style.ts'
import { normalizeSvgAttribute } from '../svg-attributes.ts'
import type { ElementProps } from '../jsx.ts'

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
  'autoReverse',
  'contenteditable',
  'draggable',
  'externalResourcesRequired',
  'focusable',
  'preserveAlpha',
  'spellcheck',
])

const BLOCKED_HOST_PROP_NAMES = new Set(['__proto__', 'outerHTML'])
const UNSAFE_HOST_PROP_NAME = /^on|[\u0000\t\n\f\r "'/>=]/i
const EXECUTABLE_URL_ATTRIBUTES = new Set(['href', 'src', 'action', 'formaction', 'xlink:href'])
// Browsers ignore leading C0 controls and spaces, plus tabs and newlines within URL schemes.
const JAVASCRIPT_PROTOCOL =
  /^[\u0000-\u001F ]*j[\r\n\t]*a[\r\n\t]*v[\r\n\t]*a[\r\n\t]*s[\r\n\t]*c[\r\n\t]*r[\r\n\t]*i[\r\n\t]*p[\r\n\t]*t[\r\n\t]*:/i
const BLOCKED_JAVASCRIPT_URL =
  "javascript:throw new Error('Remix has blocked a javascript: URL as a security precaution.')"

export const FRAMEWORK_PROPS = new Set(['children', 'mix', 'key', 'animate', 'innerHTML', 'on'])

export const SELF_CLOSING_TAGS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
])

export function isChildlessElement(name: string): boolean {
  return SELF_CLOSING_TAGS.has(name)
}

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

export function isBooleanishStringAttribute(name: string): boolean {
  return BOOLEANISH_STRING_ATTRIBUTES.has(name)
}

export function shouldStringifyBooleanAttribute(name: string): boolean {
  return isBooleanishStringAttribute(name) || name === 'value'
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
