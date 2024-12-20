import { type HeaderValue } from './header-value.ts';
import { parseParams } from './param-values.ts';
import { isIterable } from './utils.ts';

export type AcceptLanguageInit = Iterable<string | [string, number]> | Record<string, number>;

/**
 * The value of a `Accept-Language` HTTP header.
 *
 * [MDN `Accept-Language` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Accept-Language)
 *
 * [HTTP/1.1 Specification](https://datatracker.ietf.org/doc/html/rfc7231#section-5.3.5)
 */
export class AcceptLanguage implements HeaderValue, Iterable<[string, number]> {
  #map: Map<string, number>;

  constructor(init?: string | AcceptLanguageInit) {
    this.#map = new Map();

    if (init) {
      if (typeof init === 'string') {
        for (let piece of init.split(/\s*,\s*/)) {
          let params = parseParams(piece);
          if (params.length < 1) continue;

          let language = params[0][0];
          let quality = 1;

          for (let i = 1; i < params.length; i++) {
            let [key, value] = params[i];
            if (key === 'q') {
              quality = Number(value);
              break;
            }
          }

          this.#map.set(language.toLowerCase(), quality);
        }
      } else if (isIterable(init)) {
        for (let value of init) {
          if (Array.isArray(value)) {
            this.#map.set(value[0].toLowerCase(), value[1]);
          } else {
            this.#map.set(value.toLowerCase(), 1);
          }
        }
      } else {
        for (let language of Object.getOwnPropertyNames(init)) {
          this.#map.set(language.toLowerCase(), init[language]);
        }
      }

      this.#sort();
    }
  }

  #sort() {
    this.#map = new Map([...this.#map].sort(([, a], [, b]) => b - a));
  }

  /**
   * An array of all locale identifiers in the header.
   */
  get languages(): string[] {
    return Array.from(this.#map.keys());
  }

  /**
   * An array of all quality values in the header.
   */
  get qualities(): number[] {
    return Array.from(this.#map.values());
  }

  /**
   * Returns `true` if the header matches the given language (i.e. it is "acceptable").
   * @param language The locale identifier of the language to check.
   * @returns `true` if the language is acceptable, `false` otherwise.
   */
  accepts(language: string): boolean {
    return this.getQuality(language) > 0;
  }

  /**
   * Gets the quality of a language with the given locale identifier. Performs wildcard and subtype
   * matching, so `en` matches `en-US` and `en-GB`, and `*` matches all languages.
   * @param language The locale identifier of the language to get.
   * @returns The quality of the language, or `0` if it is not in the header.
   */
  getQuality(language: string): number {
    let [base, subtype] = language.toLowerCase().split('-');

    for (let [key, value] of this) {
      let [b, s] = key.split('-');
      if (
        (b === base || b === '*' || base === '*') &&
        (s === subtype || s === undefined || subtype === undefined)
      ) {
        return value;
      }
    }

    return 0;
  }

  /**
   * Returns the most preferred language from the given list of languages.
   * @param languages The locale identifiers of the languages to choose from.
   * @returns The most preferred language or `null` if none match.
   */
  getPreferred(languages: string[]): string | null {
    let sorted = languages
      .map((language) => [language, this.getQuality(language)] as const)
      .sort((a, b) => b[1] - a[1]);

    let first = sorted[0];

    return first !== undefined && first[1] > 0 ? first[0] : null;
  }

  /**
   * Gets the quality of a language with the given locale identifier. If it is not in the header
   * verbatim, this returns `null`.
   * @param language The locale identifier of the language to get.
   * @returns The quality of the language, or `null` if it is not in the header.
   */
  get(language: string): number | null {
    return this.#map.get(language.toLowerCase()) ?? null;
  }

  /**
   * Sets a language with the given quality.
   * @param language The locale identifier of the language to set.
   * @param quality The quality of the language. Defaults to 1.
   */
  set(language: string, quality = 1): void {
    this.#map.set(language.toLowerCase(), quality);
    this.#sort();
  }

  /**
   * Removes a language with the given locale identifier.
   * @param language The locale identifier of the language to remove.
   */
  delete(language: string): void {
    this.#map.delete(language.toLowerCase());
  }

  /**
   * Checks if the header contains a language with the given locale identifier.
   * @param language The locale identifier of the language to check.
   * @returns `true` if the language is in the header, `false` otherwise.
   */
  has(language: string): boolean {
    return this.#map.has(language.toLowerCase());
  }

  /**
   * Removes all languages from the header.
   */
  clear(): void {
    this.#map.clear();
  }

  entries(): IterableIterator<[string, number]> {
    return this.#map.entries();
  }

  [Symbol.iterator](): IterableIterator<[string, number]> {
    return this.entries();
  }

  forEach(
    callback: (language: string, quality: number, header: AcceptLanguage) => void,
    thisArg?: any,
  ): void {
    for (let [language, quality] of this) {
      callback.call(thisArg, language, quality, this);
    }
  }

  /**
   * The number of languages in the header.
   */
  get size(): number {
    return this.#map.size;
  }

  toString(): string {
    let pairs: string[] = [];

    for (let [language, quality] of this.#map) {
      pairs.push(`${language}${quality === 1 ? '' : `;q=${quality}`}`);
    }

    return pairs.join(',');
  }
}
