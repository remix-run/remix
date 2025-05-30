import { type HeaderValue } from './header-value.ts';
import { parseParams } from './param-values.ts';
import { isIterable } from './utils.ts';

export type AcceptEncodingInit = Iterable<string | [string, number]> | Record<string, number>;

/**
 * The value of a `Accept-Encoding` HTTP header.
 *
 * [MDN `Accept-Encoding` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Accept-Encoding)
 *
 * [HTTP/1.1 Specification](https://datatracker.ietf.org/doc/html/rfc7231#section-5.3.4)
 */
export class AcceptEncoding implements HeaderValue, Iterable<[string, number]> {
  #map: Map<string, number>;

  constructor(init?: string | AcceptEncodingInit) {
    this.#map = new Map();

    if (init) {
      if (typeof init === 'string') {
        for (let piece of init.split(/\s*,\s*/)) {
          let params = parseParams(piece);
          if (params.length < 1) continue;

          let encoding = params[0][0];
          let weight = 1;

          for (let i = 1; i < params.length; i++) {
            let [key, value] = params[i];
            if (key === 'q') {
              weight = Number(value);
              break;
            }
          }

          this.#map.set(encoding.toLowerCase(), weight);
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
        for (let encoding of Object.getOwnPropertyNames(init)) {
          this.#map.set(encoding.toLowerCase(), init[encoding]);
        }
      }

      this.#sort();
    }
  }

  #sort() {
    this.#map = new Map([...this.#map].sort((a, b) => b[1] - a[1]));
  }

  /**
   * An array of all encodings in the header.
   */
  get encodings(): string[] {
    return Array.from(this.#map.keys());
  }

  /**
   * An array of all weights (q values) in the header.
   */
  get weights(): number[] {
    return Array.from(this.#map.values());
  }

  /**
   * The number of encodings in the header.
   */
  get size(): number {
    return this.#map.size;
  }

  /**
   * Returns `true` if the header matches the given encoding (i.e. it is "acceptable").
   * @param encoding The encoding to check.
   * @returns `true` if the encoding is acceptable, `false` otherwise.
   */
  accepts(encoding: string): boolean {
    return encoding.toLowerCase() === 'identity' || this.getWeight(encoding) > 0;
  }

  /**
   * Gets the weight an encoding. Performs wildcard matching so `*` matches all encodings.
   * @param encoding The encoding to get.
   * @returns The weight of the encoding, or `0` if it is not in the header.
   */
  getWeight(encoding: string): number {
    let lower = encoding.toLowerCase();

    for (let [enc, weight] of this) {
      if (enc === lower || enc === '*' || lower === '*') {
        return weight;
      }
    }

    return 0;
  }

  /**
   * Returns the most preferred encoding from the given list of encodings.
   * @param encodings The encodings to choose from.
   * @returns The most preferred encoding or `null` if none match.
   */
  getPreferred(encodings: string[]): string | null {
    let sorted = encodings
      .map((encoding) => [encoding, this.getWeight(encoding)] as const)
      .sort((a, b) => b[1] - a[1]);

    let first = sorted[0];

    return first !== undefined && first[1] > 0 ? first[0] : null;
  }

  /**
   * Gets the weight of an encoding. If it is not in the header verbatim, this returns `null`.
   * @param encoding The encoding to get.
   * @returns The weight of the encoding, or `null` if it is not in the header.
   */
  get(encoding: string): number | null {
    return this.#map.get(encoding.toLowerCase()) ?? null;
  }

  /**
   * Sets an encoding with the given weight.
   * @param encoding The encoding to set.
   * @param weight The weight of the encoding. Defaults to 1.
   */
  set(encoding: string, weight = 1): void {
    this.#map.set(encoding.toLowerCase(), weight);
    this.#sort();
  }

  /**
   * Removes the given encoding from the header.
   * @param encoding The encoding to remove.
   */
  delete(encoding: string): void {
    this.#map.delete(encoding.toLowerCase());
  }

  /**
   * Checks if the header contains a given encoding.
   * @param encoding The encoding to check.
   * @returns `true` if the encoding is in the header, `false` otherwise.
   */
  has(encoding: string): boolean {
    return this.#map.has(encoding.toLowerCase());
  }

  /**
   * Removes all encodings from the header.
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
    callback: (encoding: string, weight: number, header: AcceptEncoding) => void,
    thisArg?: any,
  ): void {
    for (let [encoding, weight] of this) {
      callback.call(thisArg, encoding, weight, this);
    }
  }

  toString(): string {
    let pairs: string[] = [];

    for (let [encoding, weight] of this.#map) {
      pairs.push(`${encoding}${weight === 1 ? '' : `;q=${weight}`}`);
    }

    return pairs.join(',');
  }
}
