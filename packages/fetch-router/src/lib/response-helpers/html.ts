// Safe HTML branding
const kSafeHtml: unique symbol = Symbol('safeHtml')
export type SafeHtml = String & { readonly [kSafeHtml]: true }

function createSafeHtml(value: string): SafeHtml {
  let s = new String(value) as SafeHtml
  ;(s as any)[kSafeHtml] = true
  return s
}

function isSafeHtml(value: unknown): value is SafeHtml {
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
  if (value == null || value === false) return ''
  if (Array.isArray(value)) return value.map(stringifyInterpolation).join('')
  if (isSafeHtml(value)) return String(value)
  if (typeof value === 'string') return escapeHtml(value)
  if (typeof value === 'number' || typeof value === 'boolean') return escapeHtml(String(value))
  return escapeHtml(String(value))
}

function htmlFromTemplate(strings: TemplateStringsArray, values: Interpolation[]): SafeHtml {
  let out = ''
  for (let i = 0; i < strings.length; i++) {
    out += strings[i]
    if (i < values.length) out += stringifyInterpolation(values[i])
  }

  return createSafeHtml(out)
}

function isTemplateStringsArray(value: unknown): value is TemplateStringsArray {
  return Array.isArray(value) && 'raw' in (value as any)
}

/**
 * A helper for working with HTML [`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response) objects.
 *
 * When used as a function, it creates a `Response`.
 *
 * ```ts
 * let response = html('<h1>Hello</h1>')
 * assert.equal(response.headers.get('Content-Type'), 'text/html; charset=UTF-8')
 * assert.equal(await response.text(), '<h1>Hello</h1>')
 * ```
 *
 * When used as a tagged template, it escapes HTML and returns a Response.
 *
 * ```ts
 * let unsafe = '<script>alert(1)</script>'
 * let response = html`<h1>${unsafe}</h1>`
 * assert.equal(await response.text(), '<h1>&lt;script&gt;alert(1)&lt;/script&gt;</h1>')
 * ```
 *
 * To escape HTML without creating a Response, use `html.escape`.
 *
 * ```ts
 * let fragment = html.escape`<h1>${unsafe}</h1>`
 * return html(fragment)
 * ```
 *
 * To insert raw (safe) HTML into a response, use `html.raw`.
 *
 * ```ts
 * let icon = html.raw('<b>OK</b>')
 * let response = html`<div>${icon}</div>`
 * assert.equal(await response.text(), '<div><b>OK</b></div>')
 * ```
 */
type HtmlHelper = {
  (body: SafeHtml, init?: ResponseInit): Response
  (body: BodyInit, init?: ResponseInit): Response
  (strings: TemplateStringsArray, ...values: Interpolation[]): Response
  /**
   * A tagged template function that escapes interpolated values as HTML.
   *
   * @param strings The template strings
   * @param values The values to interpolate
   * @returns A SafeHtml value
   */
  esc: (strings: TemplateStringsArray, ...values: Interpolation[]) => SafeHtml
  /**
   * Marks the given string as HTML that is safe (needs no escaping).
   *
   * @param value The string to mark as safe
   * @returns A SafeHtml value
   */
  raw: (value: string | SafeHtml) => SafeHtml
}

function htmlHelper(
  first: BodyInit | SafeHtml | TemplateStringsArray | ResponseInit,
  ...rest: any[]
): Response {
  // Tagged template form: html`...`
  if (isTemplateStringsArray(first)) {
    let strings = first as TemplateStringsArray
    let values = rest as Interpolation[]
    let markup = htmlFromTemplate(strings, values)
    return html(markup)
  }

  // Normal response form: html(body, init?)
  let body = first as BodyInit | SafeHtml
  let init = (rest[0] as ResponseInit | undefined) ?? undefined

  let headers = new Headers(init?.headers)
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'text/html; charset=UTF-8')
  }

  let payload: BodyInit
  if (isSafeHtml(body)) {
    payload = String(body)
  } else {
    payload = body as BodyInit
  }

  return new Response(payload, { ...init, headers })
}

export const html = htmlHelper as HtmlHelper
html.esc = (strings, ...values) => htmlFromTemplate(strings, values)
html.raw = (value) => (isSafeHtml(value) ? value : createSafeHtml(String(value)))
