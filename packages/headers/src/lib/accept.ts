import { WeightedHeaderValue, type WeightedHeaderValueInit } from './weighted-header-value.ts'

/**
 * Initializer for an `Accept` header value.
 */
export type AcceptInit = WeightedHeaderValueInit

/**
 * The value of a `Accept` HTTP header.
 *
 * [MDN `Accept` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Accept)
 *
 * [HTTP/1.1 Specification](https://datatracker.ietf.org/doc/html/rfc7231#section-5.3.2)
 */
export class Accept extends WeightedHeaderValue {
  constructor(init?: string | AcceptInit) {
    super(init, (range, mediaType) => {
      let [rangeType, rangeSubtype] = range.split('/')
      let [type, subtype] = mediaType.split('/')
      if (
        (rangeType === type || rangeType === '*' || type === '*') &&
        (rangeSubtype === subtype || rangeSubtype === '*' || subtype === '*')
      ) {
        return (
          (rangeType === type && type !== '*' ? 1 : 0) +
          (rangeSubtype === subtype && subtype !== '*' ? 1 : 0)
        )
      }
      return null
    })
  }

  /**
   * An array of all media types in the header.
   */
  get mediaTypes(): string[] {
    return Array.from(this, ([mediaType]) => mediaType)
  }

  /**
   * Parse an Accept header value.
   *
   * @param value The header value (string, init object, or null)
   * @returns An Accept instance (empty if null)
   */
  static from(value: string | AcceptInit | null): Accept {
    return new Accept(value ?? undefined)
  }
}
