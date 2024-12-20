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
          let quality = 1;

          for (let i = 1; i < params.length; i++) {
            let [key, value] = params[i];
            if (key === 'q') {
              quality = Number(value);
              break;
            }
          }

          this.#map.set(mediaType, quality);
        }
      } else if (isIterable(init)) {
        for (let mediaType of init) {
          if (Array.isArray(mediaType)) {
            this.#map.set(mediaType[0], mediaType[1]);
          } else {
            this.#map.set(mediaType, 1);
          }
        }
      } else {
        for (let mediaType of Object.getOwnPropertyNames(init)) {
          this.#map.set(mediaType, init[mediaType]);
        }
      }

      this.#sort();
    }
  }

  #sort() {
    this.#map = new Map([...this.#map].sort(([, a], [, b]) => b - a));
  }

  /**
   * An array of media types in the `Accept` header.
   */
  get mediaTypes(): string[] {
    return Array.from(this.#map.keys());
  }

  /**
   * An array of quality values in the `Accept` header.
   */
  get qualities(): number[] {
    return Array.from(this.#map.values());
  }

  /**
   * Gets the quality of a given media type from the `Accept` header.
   */
  get(mediaType: string): number | undefined {
    return this.#map.get(mediaType);
  }

  /**
   * Sets a media type with the given quality (defaults to 1) in the `Accept` header.
   */
  set(mediaType: string, quality = 1): void {
    this.#map.set(mediaType, quality);
    this.#sort();
  }

  /**
   * Removes a given mediaType from the `Accept` header.
   */
  delete(mediaType: string): boolean {
    return this.#map.delete(mediaType);
  }

  /**
   * True if a given media type is present in the `Accept` header.
   */
  has(mediaType: string): boolean {
    return this.#map.has(mediaType);
  }

  /**
   * Removes all media types from the `Accept` header.
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
    callback: (mediaType: string, quality: number, header: Accept) => void,
    thisArg?: any,
  ): void {
    for (let [mediaType, quality] of this) {
      callback.call(thisArg, mediaType, quality, this);
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

    for (let [mediaType, quality] of this.#map) {
      pairs.push(`${mediaType}${quality === 1 ? '' : `;q=${quality}`}`);
    }

    return pairs.join(',');
  }
}
