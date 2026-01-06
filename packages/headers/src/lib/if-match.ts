import { type HeaderValue } from './header-value.ts'
import { quoteEtag } from './utils.ts'

/**
 * Initializer for an `If-Match` header value.
 */
export interface IfMatchInit {
  /**
   * The entity tags to compare against the current entity.
   */
  tags: string[]
}

/**
 * The value of an `If-Match` HTTP header.
 *
 * [MDN `If-Match` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/If-Match)
 *
 * [HTTP/1.1 Specification](https://datatracker.ietf.org/doc/html/rfc7232#section-3.1)
 */
export class IfMatch implements HeaderValue, IfMatchInit {
  tags: string[] = []

  constructor(init?: string | string[] | IfMatchInit) {
    if (init) return IfMatch.from(init)
  }

  /**
   * Checks if the header contains the given entity tag.
   *
   * Note: This method checks only for exact matches and does not consider wildcards.
   *
   * @param tag The entity tag to check for
   * @returns `true` if the tag is present in the header, `false` otherwise
   */
  has(tag: string): boolean {
    return this.tags.includes(quoteEtag(tag))
  }

  /**
   * Checks if the precondition passes for the given entity tag.
   *
   * This method always returns `true` if the `If-Match` header is not present
   * since the precondition passes regardless of the entity tag being checked.
   *
   * Uses strong comparison as per RFC 9110, meaning weak entity tags (prefixed with `W/`)
   * will never match.
   *
   * @param tag The entity tag to check against
   * @returns `true` if the precondition passes, `false` if it fails (should return 412)
   */
  matches(tag: string): boolean {
    if (this.tags.length === 0) {
      return true
    }

    // Wildcard always matches (regardless of weak/strong)
    if (this.tags.includes('*')) {
      return true
    }

    let normalizedTag = quoteEtag(tag)

    // Weak tags never match in If-Match (strong comparison only)
    if (normalizedTag.startsWith('W/')) {
      return false
    }

    // Only match against strong tags in the header
    for (let headerTag of this.tags) {
      if (!headerTag.startsWith('W/') && headerTag === normalizedTag) {
        return true
      }
    }

    return false
  }

  /**
   * Returns the string representation of the header value.
   *
   * @returns The header value as a string
   */
  toString() {
    return this.tags.join(', ')
  }

  /**
   * Parse an If-Match header value.
   *
   * @param value The header value (string, string[], init object, or null)
   * @returns An IfMatch instance (empty if null)
   */
  static from(value: string | string[] | IfMatchInit | null): IfMatch {
    let header = new IfMatch()

    if (value !== null) {
      if (typeof value === 'string') {
        header.tags.push(...value.split(/\s*,\s*/).map(quoteEtag))
      } else if (Array.isArray(value)) {
        header.tags.push(...value.map(quoteEtag))
      } else {
        header.tags.push(...value.tags.map(quoteEtag))
      }
    }

    return header
  }
}
