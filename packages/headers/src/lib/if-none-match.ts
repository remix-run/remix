import { type HeaderValue } from './header-value.ts'
import { quoteEtag } from './utils.ts'

/**
 * Initializer for an `If-None-Match` header value.
 */
export interface IfNoneMatchInit {
  /**
   * The entity tags to compare against the current entity.
   */
  tags: string[]
}

/**
 * The value of an `If-None-Match` HTTP header.
 *
 * [MDN `If-None-Match` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/If-None-Match)
 *
 * [HTTP/1.1 Specification](https://datatracker.ietf.org/doc/html/rfc7232#section-3.2)
 */
export class IfNoneMatch implements HeaderValue, IfNoneMatchInit {
  tags: string[] = []

  /**
   * @param init A string, array of strings, or object to initialize the header
   */
  constructor(init?: string | string[] | IfNoneMatchInit) {
    if (init) {
      if (typeof init === 'string') {
        this.tags.push(...init.split(/\s*,\s*/).map(quoteEtag))
      } else if (Array.isArray(init)) {
        this.tags.push(...init.map(quoteEtag))
      } else {
        this.tags.push(...init.tags.map(quoteEtag))
      }
    }
  }

  /**
   * Checks if the header contains the given entity tag.
   *
   * Note: This method checks only for exact matches and does not consider wildcards.
   *
   * @param tag The entity tag to check for
   * @return `true` if the tag is present in the header, `false` otherwise
   */
  has(tag: string): boolean {
    return this.tags.includes(quoteEtag(tag))
  }

  /**
   * Checks if this header matches the given entity tag.
   *
   * @param tag The entity tag to check for
   * @return `true` if the tag is present in the header (or the header contains a wildcard), `false` otherwise
   */
  matches(tag: string): boolean {
    return this.has(tag) || this.tags.includes('*')
  }

  /**
   * Returns the string representation of the header value.
   *
   * @return The header value as a string
   */
  toString() {
    return this.tags.join(', ')
  }
}
