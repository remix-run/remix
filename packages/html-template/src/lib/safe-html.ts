// Safe HTML branding
const kSafeHtml: unique symbol = Symbol('safeHtml')

/**
 * A string that is safe to render as HTML without escaping.
 */
export type SafeHtml = String & { readonly [kSafeHtml]: true }

function createSafeHtml(value: string): SafeHtml {
  let s = new String(value) as SafeHtml
  ;(s as any)[kSafeHtml] = true
  return s
}

/**
 * Checks if a value is a `SafeHtml` string.
 *
 * @param value The value to check
 * @returns `true` if the value is a `SafeHtml` string
 */
export function isSafeHtml(value: unknown): value is SafeHtml {
  return typeof value === 'object' && value != null && (value as any)[kSafeHtml] === true
}

const escapeRe = /[&<>"']/g
const escapeMap = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
} as const

function escapeHtml(text: string): string {
  return text.replace(escapeRe, (c) => escapeMap[c as keyof typeof escapeMap])
}

type Interpolation = SafeHtml | string | number | boolean | null | undefined | Array<Interpolation>

function stringifyInterpolation(value: Interpolation): string {
  if (value == null) return ''
  if (Array.isArray(value)) return value.map(stringifyInterpolation).join('')
  if (isSafeHtml(value)) return String(value)
  if (typeof value === 'string') return escapeHtml(value)
  if (typeof value === 'number' || typeof value === 'boolean') return escapeHtml(String(value))
  return escapeHtml(String(value))
}

function stringifyRawInterpolation(value: Interpolation): string {
  if (value == null) return ''
  if (Array.isArray(value)) return value.map(stringifyRawInterpolation).join('')
  if (isSafeHtml(value)) return String(value)
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return String(value)
}

function isTemplateStringsArray(obj: any): obj is TemplateStringsArray {
  return Array.isArray(obj) && 'raw' in obj
}

/**
 * Use this helper to escape HTML and create a safe HTML string.
 *
 * ```ts
 * let unsafe = '<script>alert(1)</script>'
 * let safe = html`<h1>${unsafe}</h1>`
 * assert.equal(String(safe), '<h1>&lt;script&gt;alert(1)&lt;/script&gt;</h1>')
 * ```
 *
 * To interpolate raw HTML without escaping, use `html.raw` as a template tag:
 *
 * ```ts
 * let icon = '<b>OK</b>'
 * let safe = html.raw`<div>${icon}</div>`
 * assert.equal(String(safe), '<div><b>Bold</b></div>')
 * ```
 *
 * This has the same semantics as `String.raw` but for HTML snippets that have
 * already been escaped or are from trusted sources.
 */
type SafeHtmlHelper = {
  /**
   * A tagged template function that escapes interpolated values as HTML.
   *
   * @param strings The template strings
   * @param values The values to interpolate
   * @returns A `SafeHtml` value
   */
  (strings: TemplateStringsArray, ...values: Interpolation[]): SafeHtml
  /**
   * A tagged template function that does not escape interpolated values.
   *
   * Similar to `String.raw`, this preserves the raw values without escaping.
   * Only use with trusted content or pre-escaped HTML.
   *
   * @param strings The template strings
   * @param values The values to interpolate
   * @returns A `SafeHtml` value
   */
  raw(strings: TemplateStringsArray, ...values: Interpolation[]): SafeHtml
}

function htmlHelper(strings: TemplateStringsArray, ...values: Interpolation[]): SafeHtml {
  if (!isTemplateStringsArray(strings)) {
    throw new TypeError('html must be used as a template tag')
  }

  let out = ''
  for (let i = 0; i < strings.length; i++) {
    out += strings[i]
    if (i < values.length) out += stringifyInterpolation(values[i])
  }

  return createSafeHtml(out)
}

export const html = htmlHelper as SafeHtmlHelper

html.raw = (strings, ...values) => {
  if (!isTemplateStringsArray(strings)) {
    throw new TypeError('html.raw must be used as a template tag')
  }

  let out = ''
  for (let i = 0; i < strings.length; i++) {
    out += strings[i]
    if (i < values.length) out += stringifyRawInterpolation(values[i])
  }

  return createSafeHtml(out)
}
