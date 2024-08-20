import { HeaderValue } from './header-value.js';
import { parseParams } from './param-values.js';
import { isIterable } from './utils.js';

export type AcceptLanguageInit =
  | Iterable<string | [string] | [string, number | undefined]>
  | Record<string, number | undefined>;

/**
 * The value of a `Accept-Language` HTTP header.
 *
 * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Accept-Language)
 */
export class AcceptLanguage implements HeaderValue, Iterable<[string, number]> {
  #map: Map<string, number>;

  constructor(init?: string | AcceptLanguageInit) {
    this.#map = new Map();
    if (init) {
      if (typeof init === 'string') {
        let params = parseParams(init, ',');
        for (let [language, quality] of params) {
          if (typeof quality === 'string') {
            language = language.slice(0, -2).trim();
          } else {
            quality = '1';
          }
          this.#map.set(language, Number(quality));
        }
      } else if (isIterable(init)) {
        for (let language of init) {
          let quality;
          if (Array.isArray(language)) {
            [language, quality] = language;
          }
          this.#map.set(language, quality ?? 1);
        }
      } else {
        for (let language in init) {
          if (Object.prototype.hasOwnProperty.call(init, language)) {
            this.#map.set(language, init[language] ?? 1);
          }
        }
      }
    }
  }

  /**
   * Gets the quality of a language with the given locale identifier from the `Accept-Language` header.
   */
  get(language: string): number | undefined {
    return this.#map.get(language);
  }

  /**
   * Sets a language with the given quality in the `Accept-Language` header.
   */
  set(language: string, quality = 1): void {
    this.#map.set(language, quality);
  }

  /**
   * Removes a language with the given locale identifier from the `Accept-Language` header.
   */
  delete(language: string): boolean {
    return this.#map.delete(language);
  }

  /**
   * True if a language with the given locale identifier in the `Accept-Language` header.
   */
  has(language: string): boolean {
    return this.#map.has(language);
  }

  /**
   * Removes all languages from the `Accept-Language` header.
   */
  clear(): void {
    this.#map.clear();
  }

  entries(): IterableIterator<[string, number]> {
    return this.#map.entries();
  }

  get languages(): string[] {
    return Array.from(this.#map.keys());
  }

  get qualities(): number[] {
    return Array.from(this.#map.values());
  }

  [Symbol.iterator](): IterableIterator<[string, number]> {
    return this.entries();
  }

  forEach(
    callback: (language: string, quality: number, map: Map<string, number>) => void,
    thisArg?: any,
  ): void {
    this.#map.forEach((quality, language, map) => callback(language, quality, map), thisArg);
  }

  /**
   * The number of languages in the `Accept-Language` header.
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
