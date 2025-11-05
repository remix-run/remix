import { type HeaderValue } from './header-value.ts'
import { quoteEtag } from './utils.ts'

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
   * @param tag The entity tag to check for.
   * @returns `true` if the tag is present in the header, `false` otherwise.
   */
  has(tag: string): boolean {
    return this.tags.includes(quoteEtag(tag))
  }

  /**
   * Checks if the precondition passes for the given entity tag.
   *
   * Note: This method returns `true` if the `If-Match` header is not present,
   * regardless of the entity tag being checked since the precondition passes.
   *
   * @param tag The entity tag to check against.
   * @returns `true` if the precondition passes, `false` if it fails (should return 412).
   */
  matches(tag: string): boolean {
    if (this.tags.length === 0) {
      return true
    }
    return this.has(tag) || this.tags.includes('*') // Present and matches or wildcard = pass
  }

  toString() {
    return this.tags.join(', ')
  }
}
