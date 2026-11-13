import { WeightedHeaderValue, type WeightedHeaderValueInit } from './weighted-header-value.ts'

/**
 * Initializer for an `Accept-Language` header value.
 */
export type AcceptLanguageInit = WeightedHeaderValueInit

/**
 * The value of a `Accept-Language` HTTP header. Language weights match by base language and
 * subtype, so `en` matches `en-US` and `en-GB`, and `*` matches all languages.
 *
 * [MDN `Accept-Language` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Accept-Language)
 *
 * [HTTP/1.1 Specification](https://datatracker.ietf.org/doc/html/rfc7231#section-5.3.5)
 */
export class AcceptLanguage extends WeightedHeaderValue {
  constructor(init?: string | AcceptLanguageInit) {
    super(init, (range, language) => {
      let [rangeBase, rangeSubtype] = range.split('-')
      let [base, subtype] = language.split('-')
      if (
        (rangeBase === base || rangeBase === '*' || base === '*') &&
        (rangeSubtype === subtype || rangeSubtype === undefined || subtype === undefined)
      ) {
        return (
          (rangeBase === base && base !== '*' ? 1 : 0) +
          (rangeSubtype !== undefined && rangeSubtype === subtype ? 1 : 0)
        )
      }
      return null
    })
  }

  /**
   * An array of all languages in the header.
   */
  get languages(): string[] {
    return Array.from(this, ([language]) => language)
  }

  /**
   * Parse an Accept-Language header value.
   *
   * @param value The header value (string, init object, or null)
   * @returns An AcceptLanguage instance (empty if null)
   */
  static from(value: string | AcceptLanguageInit | null): AcceptLanguage {
    return new AcceptLanguage(value ?? undefined)
  }
}
