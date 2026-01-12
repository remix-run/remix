import { type HeaderValue } from './header-value.ts'
import { parseParams } from './param-values.ts'
import { isIterable } from './utils.ts'

/**
 * Initializer for an `Accept-Language` header value.
 */
export type AcceptLanguageInit = Iterable<string | [string, number]> | Record<string, number>

/**
 * The value of a `Accept-Language` HTTP header.
 *
 * [MDN `Accept-Language` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Accept-Language)
 *
 * [HTTP/1.1 Specification](https://datatracker.ietf.org/doc/html/rfc7231#section-5.3.5)
 */
export class AcceptLanguage implements HeaderValue, Iterable<[string, number]> {
  #map!: Map<string, number>

  constructor(init?: string | AcceptLanguageInit) {
    if (init) return AcceptLanguage.from(init)
    this.#map = new Map()
  }

  #sort() {
    this.#map = new Map([...this.#map].sort((a, b) => b[1] - a[1]))
  }

  /**
   * An array of all languages in the header.
   */
  get languages(): string[] {
    return Array.from(this.#map.keys())
  }

  /**
   * An array of all weights (q values) in the header.
   */
  get weights(): number[] {
    return Array.from(this.#map.values())
  }

  /**
   * The number of languages in the header.
   */
  get size(): number {
    return this.#map.size
  }

  /**
   * Returns `true` if the header matches the given language (i.e. it is "acceptable").
   *
   * @param language The locale identifier of the language to check
   * @returns `true` if the language is acceptable, `false` otherwise
   */
  accepts(language: string): boolean {
    return this.getWeight(language) > 0
  }

  /**
   * Gets the weight of a language with the given locale identifier. Performs wildcard and subtype
   * matching, so `en` matches `en-US` and `en-GB`, and `*` matches all languages.
   *
   * @param language The locale identifier of the language to get
   * @returns The weight of the language, or `0` if it is not in the header
   */
  getWeight(language: string): number {
    let [base, subtype] = language.toLowerCase().split('-')

    for (let [key, value] of this) {
      let [b, s] = key.split('-')
      if (
        (b === base || b === '*' || base === '*') &&
        (s === subtype || s === undefined || subtype === undefined)
      ) {
        return value
      }
    }

    return 0
  }

  /**
   * Returns the most preferred language from the given list of languages.
   *
   * @param languages The locale identifiers of the languages to choose from
   * @returns The most preferred language or `null` if none match
   */
  getPreferred<language extends string>(languages: readonly language[]): language | null {
    let sorted = languages
      .map((language) => [language, this.getWeight(language)] as const)
      .sort((a, b) => b[1] - a[1])

    let first = sorted[0]

    return first !== undefined && first[1] > 0 ? first[0] : null
  }

  /**
   * Gets the weight of a language with the given locale identifier. If it is not in the header
   * verbatim, this returns `null`.
   *
   * @param language The locale identifier of the language to get
   * @returns The weight of the language, or `null` if it is not in the header
   */
  get(language: string): number | null {
    return this.#map.get(language.toLowerCase()) ?? null
  }

  /**
   * Sets a language with the given weight.
   *
   * @param language The locale identifier of the language to set
   * @param weight The weight of the language (default: `1`)
   */
  set(language: string, weight = 1): void {
    this.#map.set(language.toLowerCase(), weight)
    this.#sort()
  }

  /**
   * Removes a language with the given locale identifier.
   *
   * @param language The locale identifier of the language to remove
   */
  delete(language: string): void {
    this.#map.delete(language.toLowerCase())
  }

  /**
   * Checks if the header contains a language with the given locale identifier.
   *
   * @param language The locale identifier of the language to check
   * @returns `true` if the language is in the header, `false` otherwise
   */
  has(language: string): boolean {
    return this.#map.has(language.toLowerCase())
  }

  /**
   * Removes all languages from the header.
   */
  clear(): void {
    this.#map.clear()
  }

  /**
   * Returns an iterator of all language and weight pairs.
   *
   * @returns An iterator of `[language, weight]` tuples
   */
  entries(): IterableIterator<[string, number]> {
    return this.#map.entries()
  }

  [Symbol.iterator](): IterableIterator<[string, number]> {
    return this.entries()
  }

  /**
   * Invokes the callback for each language and weight pair.
   *
   * @param callback The function to call for each pair
   * @param thisArg The value to use as `this` when calling the callback
   */
  forEach(
    callback: (language: string, weight: number, header: AcceptLanguage) => void,
    thisArg?: any,
  ): void {
    for (let [language, weight] of this) {
      callback.call(thisArg, language, weight, this)
    }
  }

  /**
   * Returns the string representation of the header value.
   *
   * @returns The header value as a string
   */
  toString(): string {
    let pairs: string[] = []

    for (let [language, weight] of this.#map) {
      pairs.push(`${language}${weight === 1 ? '' : `;q=${weight}`}`)
    }

    return pairs.join(',')
  }

  /**
   * Parse an Accept-Language header value.
   *
   * @param value The header value (string, init object, or null)
   * @returns An AcceptLanguage instance (empty if null)
   */
  static from(value: string | AcceptLanguageInit | null): AcceptLanguage {
    let header = new AcceptLanguage()

    if (value !== null) {
      if (typeof value === 'string') {
        for (let piece of value.split(/\s*,\s*/)) {
          let params = parseParams(piece)
          if (params.length < 1) continue

          let language = params[0][0]
          let weight = 1

          for (let i = 1; i < params.length; i++) {
            let [key, val] = params[i]
            if (key === 'q') {
              weight = Number(val)
              break
            }
          }

          header.#map.set(language.toLowerCase(), weight)
        }
      } else if (isIterable(value)) {
        for (let item of value) {
          if (Array.isArray(item)) {
            header.#map.set(item[0].toLowerCase(), item[1])
          } else {
            header.#map.set(item.toLowerCase(), 1)
          }
        }
      } else {
        for (let language of Object.getOwnPropertyNames(value)) {
          header.#map.set(language.toLowerCase(), value[language])
        }
      }

      header.#sort()
    }

    return header
  }
}
