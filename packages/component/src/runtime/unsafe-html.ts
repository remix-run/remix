import { invariant } from './invariant.ts'

class UnsafeHTMLValue {
  #value: string

  constructor(value: string) {
    this.#value = value
  }

  static read(value: UnsafeHTMLValue): string {
    return value.#value
  }
}

/**
 * An opaque value that Remix may insert into an element without HTML escaping.
 *
 * Create values with {@link unsafeHTML}. Remix does not sanitize or otherwise modify the HTML.
 */
export type UnsafeHTML = UnsafeHTMLValue

/**
 * Explicitly allows a string to be inserted into an element as raw HTML.
 *
 * This function does not sanitize or otherwise modify the HTML. Only pass trusted content or
 * content that your application has already sanitized.
 *
 * @param value The raw HTML string to allow.
 * @returns An opaque value accepted by raw-HTML props such as `innerHTML` and iframe
 * `srcDoc`/`srcdoc`.
 */
export function unsafeHTML(value: string): UnsafeHTML {
  let result = new UnsafeHTMLValue(value)
  Object.freeze(result)
  return result
}

function readHTMLProp(props: Record<string, unknown>, name: string): string | undefined {
  let value = props[name]
  if (value === undefined) return
  let html = value instanceof UnsafeHTMLValue ? UnsafeHTMLValue.read(value) : undefined
  invariant(html !== undefined, `Invalid ${name} prop: expected a value created with unsafeHTML()`)
  return html
}

interface NormalizedUnsafeHTMLProps extends Record<string, unknown> {
  innerHTML?: string
  srcDoc?: string
  srcdoc?: string
}

/**
 * Validates and unwraps every host prop that can cause the browser to parse raw HTML.
 *
 * @param props The authored host props to normalize.
 * @returns Host props with opaque raw-HTML values replaced by their strings.
 * @internal
 */
export function normalizeUnsafeHTMLProps(
  props: Record<string, unknown>,
): NormalizedUnsafeHTMLProps {
  let innerHTML = readHTMLProp(props, 'innerHTML')
  let srcDoc = readHTMLProp(props, 'srcDoc')
  let srcdoc = readHTMLProp(props, 'srcdoc')

  invariant(
    props.outerHTML === undefined,
    'Invalid outerHTML prop: outerHTML is not supported on host elements',
  )

  if (innerHTML === undefined && srcDoc === undefined && srcdoc === undefined) return props
  return {
    ...props,
    ...(innerHTML === undefined ? {} : { innerHTML }),
    ...(srcDoc === undefined ? {} : { srcDoc }),
    ...(srcdoc === undefined ? {} : { srcdoc }),
  }
}
