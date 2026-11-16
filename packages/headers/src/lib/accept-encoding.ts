import { WeightedHeaderValue, type WeightedHeaderValueInit } from './weighted-header-value.ts'

/**
 * Initializer for an `Accept-Encoding` header value.
 */
export type AcceptEncodingInit = WeightedHeaderValueInit

/**
 * The value of a `Accept-Encoding` HTTP header.
 *
 * [MDN `Accept-Encoding` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Accept-Encoding)
 *
 * [HTTP/1.1 Specification](https://datatracker.ietf.org/doc/html/rfc7231#section-5.3.4)
 */
export class AcceptEncoding extends WeightedHeaderValue {
  constructor(init?: string | AcceptEncodingInit) {
    super(init, (range, encoding) => (range === '*' || encoding === '*' ? 0 : null))
  }

  /**
   * An array of all encodings in the header.
   */
  get encodings(): string[] {
    return Array.from(this, ([encoding]) => encoding)
  }

  /**
   * Returns `true` if the header matches the given encoding (i.e. it is "acceptable"). The
   * `identity` encoding is acceptable unless the header refuses it with `identity;q=0`, or with
   * `*;q=0` and no `identity` entry.
   *
   * @param encoding The encoding to check
   * @returns `true` if the encoding is acceptable, `false` otherwise
   */
  accepts(encoding: string): boolean {
    if (encoding.toLowerCase() === 'identity' && !this.has('identity') && !this.has('*'))
      return true
    return super.accepts(encoding)
  }

  /**
   * Parse an Accept-Encoding header value.
   *
   * @param value The header value (string, init object, or null)
   * @returns An AcceptEncoding instance (empty if null)
   */
  static from(value: string | AcceptEncodingInit | null): AcceptEncoding {
    return new AcceptEncoding(value ?? undefined)
  }
}
