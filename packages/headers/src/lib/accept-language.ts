import { WeightedHeaderValue, type WeightedHeaderValueInit } from './weighted-header-value.ts'

/**
 * Initializer for an `Accept-Language` header value.
 */
export type AcceptLanguageInit = WeightedHeaderValueInit

/**
 * The value of a `Accept-Language` HTTP header. Language weights match by subtag prefix, so `en`
 * matches `en-US` and `en-GB`, and `*` matches all languages.
 *
 * [MDN `Accept-Language` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Accept-Language)
 *
 * [HTTP/1.1 Specification](https://datatracker.ietf.org/doc/html/rfc7231#section-5.3.5)
 */
export class AcceptLanguage extends WeightedHeaderValue {
  constructor(init?: string | AcceptLanguageInit) {
    super(init, (range, language) => {
      let rangeTags = range.split('-')
      let tags = language.split('-')
      if (rangeTags[0] === '*' || tags[0] === '*') return 0

      // A range matches a tag when one is a subtag prefix of the other, so `en` and `en-US` match
      // each other but `zh-Hant-TW` and `zh-Hant-CN` do not. Longer shared prefixes are more specific.
      let length = Math.min(rangeTags.length, tags.length)
      for (let i = 0; i < length; i++) {
        if (rangeTags[i] !== tags[i]) return null
      }
      return length
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
