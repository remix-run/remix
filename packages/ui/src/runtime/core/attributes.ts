import { normalizeCssValue } from '../../style/style.ts'
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

export function normalizeAttributeName(
  name: string,
  isSvg: boolean,
): { ns?: string; attr: string } {
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
    if (value == null) continue
    if (typeof value === 'boolean') continue
    if (typeof value === 'number' && !Number.isFinite(value)) continue

    let cssKey = toKebabCase(key)
    let cssValue = Array.isArray(value) ? value.join(', ') : normalizeCssValue(key, value)

    parts.push(`${cssKey}: ${cssValue};`)
  }

  return parts.join(' ')
}

export function getMergedClassName(props: ElementProps): string | undefined {
  let classAttr = typeof props.class === 'string' ? props.class : ''
  let className = typeof props.className === 'string' ? props.className : ''
  let merged = classAttr && className ? `${classAttr} ${className}` : classAttr || className
  return merged || undefined
}

export function toKebabCase(value: string): string {
  return value.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`)
}
