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

          this.#map.set(language, quality);
        }
      } else if (isIterable(init)) {
        for (let language of init) {
          if (Array.isArray(language)) {
            this.#map.set(language[0], language[1]);
          } else {
            this.#map.set(language, 1);
          }
        }
      } else {
        for (let language in init) {
          if (Object.prototype.hasOwnProperty.call(init, language)) {
            this.#map.set(language, init[language]);
          }
        }
      }

      this.#sort();
    }
  }

  #sort() {
    this.#map = new Map([...this.#map].sort(([, a], [, b]) => b - a));
  }

  /**
   * An array of all locale identifiers in the `Accept-Language` header.
   */
  get languages(): string[] {
    return Array.from(this.#map.keys());
  }

  /**
   * An array of all quality values in the `Accept-Language` header.
   */
  get qualities(): number[] {
    return Array.from(this.#map.values());
  }

  /**
   * Gets the quality of a language with the given locale identifier from the `Accept-Language` header.
   */
  get(language: string): number | undefined {
    return this.#map.get(language);
  }

  /**
   * Sets a language with the given quality (defaults to 1) in the `Accept-Language` header.
   */
  set(language: string, quality = 1): void {
    this.#map.set(language, quality);
    this.#sort();
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
