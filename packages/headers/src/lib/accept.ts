import { type HeaderValue } from './header-value.ts';
import { parseParams } from './param-values.ts';
import { isIterable } from './utils.ts';

export type AcceptInit = Iterable<string | [string, number]> | Record<string, number>;

/**
 * The value of a `Accept` HTTP header.
 *
 * [MDN `Accept` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Accept)
 *
 * [HTTP/1.1 Specification](https://datatracker.ietf.org/doc/html/rfc7231#section-5.3.2)
 */
export class Accept implements HeaderValue, Iterable<[string, number]> {
  #map: Map<string, number>;

  constructor(init?: string | AcceptInit) {
    this.#map = new Map();

    if (init) {
      if (typeof init === 'string') {
        for (let piece of init.split(/\s*,\s*/)) {
          let params = parseParams(piece);
          if (params.length < 1) continue;

          let mediaType = params[0][0];
          let weight = 1;

          for (let i = 1; i < params.length; i++) {
            let [key, value] = params[i];
            if (key === 'q') {
              weight = Number(value);
              break;
            }
          }

          this.#map.set(mediaType.toLowerCase(), weight);
        }
      } else if (isIterable(init)) {
        for (let mediaType of init) {
          if (Array.isArray(mediaType)) {
            this.#map.set(mediaType[0].toLowerCase(), mediaType[1]);
          } else {
            this.#map.set(mediaType.toLowerCase(), 1);
          }
        }
      } else {
        for (let mediaType of Object.getOwnPropertyNames(init)) {
          this.#map.set(mediaType.toLowerCase(), init[mediaType]);
        }
      }

      this.#sort();
    }
  }

  #sort() {
    this.#map = new Map([...this.#map].sort(([, a], [, b]) => b - a));
  }

  /**
   * An array of all media types in the header.
   */
  get mediaTypes(): string[] {
    return Array.from(this.#map.keys());
  }

  /**
   * An array of weight values in the header.
   */
  get weights(): number[] {
    return Array.from(this.#map.values());
  }

  /**
   * Returns `true` if the header matches the given media type (i.e. it is "acceptable").
   * @param mediaType The media type to check.
   * @returns `true` if the media type is acceptable, `false` otherwise.
   */
  accepts(mediaType: string): boolean {
    return this.getWeight(mediaType) > 0;
  }

  /**
   * Gets the weight of a given media type. Also supports wildcards, so e.g. `text/*` will match `text/html`.
   * @param mediaType The media type to get the weight of.
   * @returns The weight of the media type.
   */
  getWeight(mediaType: string): number {
    let [type, subtype] = mediaType.toLowerCase().split('/');

    for (let [key, value] of this) {
      let [t, s] = key.split('/');
      if (
        (t === type || t === '*' || type === '*') &&
        (s === subtype || s === '*' || subtype === '*')
      ) {
        return value;
      }
    }

    return 0;
  }

  /**
   * Returns the most preferred media type from the given list of media types.
   * @param mediaTypes The list of media types to choose from.
   * @returns The most preferred media type or `null` if none match.
   */
  getPreferred(mediaTypes: string[]): string | null {
    let sorted = mediaTypes
      .map((mediaType) => [mediaType, this.getWeight(mediaType)] as const)
      .sort((a, b) => {
        return b[1] - a[1];
      });

    let first = sorted[0];

    return first !== undefined && first[1] > 0 ? first[0] : null;
  }

  /**
   * Returns the weight of a media type. If it is not in the header verbatim, this returns `null`.
   * @param mediaType The media type to get the weight of.
   * @returns The weight of the media type, or `null` if it is not in the header.
   */
  get(mediaType: string): number | null {
    return this.#map.get(mediaType.toLowerCase()) ?? null;
  }

  /**
   * Sets a media type with the given weight.
   * @param mediaType The media type to set.
   * @param weight The weight of the media type. Defaults to 1.
   */
  set(mediaType: string, weight = 1): void {
    this.#map.set(mediaType.toLowerCase(), weight);
    this.#sort();
  }

  /**
   * Removes the given media type from the header.
   * @param mediaType The media type to remove.
   */
  delete(mediaType: string): void {
    this.#map.delete(mediaType.toLowerCase());
  }

  /**
   * Checks if a media type is in the header.
   * @param mediaType The media type to check.
   * @returns `true` if the media type is in the header (verbatim), `false` otherwise.
   */
  has(mediaType: string): boolean {
    return this.#map.has(mediaType.toLowerCase());
  }

  /**
   * Removes all media types from the header.
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
    callback: (mediaType: string, weight: number, header: Accept) => void,
    thisArg?: any,
  ): void {
    for (let [mediaType, weight] of this) {
      callback.call(thisArg, mediaType, weight, this);
    }
  }

  /**
   * The number of media types in the `Accept` header.
   */
  get size(): number {
    return this.#map.size;
  }

  toString(): string {
    let pairs: string[] = [];

    for (let [mediaType, weight] of this.#map) {
      pairs.push(`${mediaType}${weight === 1 ? '' : `;q=${weight}`}`);
    }

    return pairs.join(',');
  }
}
