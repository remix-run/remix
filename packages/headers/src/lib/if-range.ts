import { type HeaderValue } from './header-value.ts'
import { parseHttpDate, removeMilliseconds } from './utils.ts'

function isStrongEntityTag(value: string): boolean {
  // Strong ETags use the quoted opaque-tag grammar without the W/ prefix.
  // https://www.rfc-editor.org/rfc/rfc9110.html#section-8.8.3
  return /^"[\x21\x23-\x7e\x80-\xff]*"$/.test(value)
}

/**
 * The value of an `If-Range` HTTP header.
 *
 * The `If-Range` header can contain either an entity tag (ETag) or an HTTP date.
 *
 * [MDN `If-Range` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/If-Range)
 *
 * [HTTP Semantics Specification](https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.5)
 */
export class IfRange implements HeaderValue {
  #present = false
  #value = ''

  /**
   * Raw header value, either an entity tag or an HTTP date.
   * Assigning an empty string clears the condition.
   */
  get value(): string {
    return this.#value
  }

  set value(value: string) {
    this.#value = value
    this.#present = value !== ''
  }

  constructor(init?: string | Date | IfRange) {
    if (init !== undefined) return IfRange.from(init)
  }

  /**
   * Checks if the `If-Range` condition is satisfied for the current resource state.
   *
   * This method always returns `true` if the `If-Range` header is not present,
   * meaning the range request should proceed unconditionally.
   * An explicitly empty or malformed header value returns `false`.
   *
   * The `If-Range` header can contain either:
   * - An HTTP date (RFC 7231 IMF-fixdate format)
   * - An entity tag (ETag)
   *
   * When comparing ETags, only quoted strong entity tags are matched as per RFC 9110.
   * Weak entity tags (prefixed with `W/`) are never considered a match.
   *
   * @param resource The current resource state to compare against
   * @param resource.etag The resource's ETag value
   * @param resource.lastModified The resource's last modified timestamp
   * @returns `true` if the condition is satisfied, `false` otherwise
   *
   * @example
   * ```ts
   * let ifRange = new IfRange('Wed, 21 Oct 2015 07:28:00 GMT')
   * ifRange.matches({ lastModified: 1445412480000 }) // true if dates match
   * ifRange.matches({ lastModified: new Date('2015-10-21T07:28:00Z') }) // true
   *
   * let ifRange2 = new IfRange('"abc123"')
   * ifRange2.matches({ etag: '"abc123"' }) // true
   * ifRange2.matches({ etag: 'W/"abc123"' }) // false (weak ETag)
   * ```
   */
  matches(resource: { etag?: string | null; lastModified?: number | Date | null }): boolean {
    if (!this.#present) {
      return true
    }

    // Evaluate tags and dates separately, using strong ETag or exact date comparison.
    // https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.5
    if (isStrongEntityTag(this.value)) {
      return (
        resource.etag != null && isStrongEntityTag(resource.etag) && this.value === resource.etag
      )
    }

    let dateTimestamp = parseHttpDate(this.value)
    if (dateTimestamp !== null) {
      return (
        resource.lastModified != null &&
        removeMilliseconds(dateTimestamp) === removeMilliseconds(resource.lastModified)
      )
    }

    return false
  }

  /**
   * Returns the string representation of the header value.
   *
   * @returns The header value as a string
   */
  toString(): string {
    return this.value
  }

  /**
   * Parse an If-Range header value.
   * A `null` value represents absence; an empty string represents a present, invalid value.
   * Existing instances are copied with their presence state preserved.
   *
   * @param value The header value (string, Date, IfRange, or null)
   * @returns An IfRange instance (empty if null)
   */
  static from(value: string | Date | IfRange | null): IfRange {
    let header = new IfRange()

    if (value instanceof IfRange) {
      // Read through the public API because SuperHeaders can wrap instances in a Proxy.
      // Only an absent value matches a resource with no validators.
      header.#value = value.value
      header.#present = header.#value !== '' || !value.matches({})
    } else if (typeof value === 'string') {
      header.#present = true
      header.#value = value
    } else if (value !== null) {
      header.value = value.toUTCString()
    }

    return header
  }
}
