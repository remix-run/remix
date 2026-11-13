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
    super(init, (range, encoding) => {
      if (encoding === '*') return 0
      if (range === encoding) return 1
      return range === '*' ? 0 : null
    })
  }

  /**
   * An array of all encodings in the header.
   */
  get encodings(): string[] {
    return Array.from(this, ([encoding]) => encoding)
  }

  /**
   * Returns `true` if the header matches the given encoding (i.e. it is "acceptable"). The
   * `identity` encoding is always acceptable.
   *
   * @param encoding The encoding to check
   * @returns `true` if the encoding is acceptable, `false` otherwise
   */
  accepts(encoding: string): boolean {
    return encoding.toLowerCase() === 'identity' || super.accepts(encoding)
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
