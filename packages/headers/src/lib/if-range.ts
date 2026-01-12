import { type HeaderValue } from './header-value.ts'
import { parseHttpDate, removeMilliseconds } from './utils.ts'
import { quoteEtag } from './utils.ts'

/**
 * The value of an `If-Range` HTTP header.
 *
 * The `If-Range` header can contain either an entity tag (ETag) or an HTTP date.
 *
 * [MDN `If-Range` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/If-Range)
 *
 * [HTTP/1.1 Specification](https://datatracker.ietf.org/doc/html/rfc7233#section-3.2)
 */
export class IfRange implements HeaderValue {
  value: string = ''

  constructor(init?: string | Date) {
    if (init) return IfRange.from(init)
  }

  /**
   * Checks if the `If-Range` condition is satisfied for the current resource state.
   *
   * This method always returns `true` if the `If-Range` header is not present,
   * meaning the range request should proceed unconditionally.
   *
   * The `If-Range` header can contain either:
   * - An HTTP date (RFC 7231 IMF-fixdate format)
   * - An entity tag (ETag)
   *
   * When comparing ETags, only strong entity tags are matched as per RFC 7233.
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
    if (!this.value) {
      return true
    }

    // Try parsing as HTTP date first
    let dateTimestamp = parseHttpDate(this.value)
    if (dateTimestamp !== null && resource.lastModified != null) {
      return removeMilliseconds(dateTimestamp) === removeMilliseconds(resource.lastModified)
    }

    // Otherwise treat as ETag
    if (resource.etag != null) {
      let normalizedTag = quoteEtag(this.value)
      let normalizedResourceTag = quoteEtag(resource.etag)

      // Weak tags never match in If-Range (strong comparison only, per RFC 7233)
      if (normalizedTag.startsWith('W/') || normalizedResourceTag.startsWith('W/')) {
        return false
      }

      return normalizedTag === normalizedResourceTag
    }

    return false
  }

  /**
   * Returns the string representation of the header value.
   *
   * @returns The header value as a string
   */
  toString() {
    return this.value
  }

  /**
   * Parse an If-Range header value.
   *
   * @param value The header value (string, Date, or null)
   * @returns An IfRange instance (empty if null)
   */
  static from(value: string | Date | null): IfRange {
    let header = new IfRange()

    if (value !== null) {
      if (typeof value === 'string') {
        header.value = value
      } else {
        header.value = value.toUTCString()
      }
    }

    return header
  }
}
