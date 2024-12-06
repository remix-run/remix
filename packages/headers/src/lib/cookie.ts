import { type HeaderValue } from './header-value.ts';
import { parseParams, quote } from './param-values.ts';
import { isIterable } from './utils.ts';

export type CookieInit = Iterable<[string, string]> | Record<string, string>;

/**
 * The value of a `Cookie` HTTP header.
 *
 * [MDN `Cookie` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cookie)
 *
 * [HTTP/1.1 Specification](https://datatracker.ietf.org/doc/html/rfc6265#section-4.2)
 */
export class Cookie implements HeaderValue, Iterable<[string, string]> {
  #map: Map<string, string>;

  constructor(init?: string | CookieInit) {
    this.#map = new Map();
    if (init) {
      if (typeof init === 'string') {
        let params = parseParams(init);
        for (let [name, value] of params) {
          this.#map.set(name, value || '');
        }
      } else if (isIterable(init)) {
        for (let [name, value] of init) {
          this.#map.set(name, value);
        }
      } else {
        for (let name in init) {
          if (Object.prototype.hasOwnProperty.call(init, name)) {
            this.#map.set(name, init[name]);
          }
        }
      }
    }
  }

  /**
   * Gets the value of a cookie with the given name from the `Cookie` header.
   */
  get(name: string): string | undefined {
    return this.#map.get(name);
  }

  /**
   * Sets a cookie with the given name and value in the `Cookie` header.
   */
  set(name: string, value: string): void {
    this.#map.set(name, value);
  }

  /**
   * Removes a cookie with the given name from the `Cookie` header.
   */
  delete(name: string): boolean {
    return this.#map.delete(name);
  }

  /**
   * True if a cookie with the given name exists in the `Cookie` header.
   */
  has(name: string): boolean {
    return this.#map.has(name);
  }

  /**
   * Removes all cookies from the `Cookie` header.
   */
  clear(): void {
    this.#map.clear();
  }

  entries(): IterableIterator<[string, string]> {
    return this.#map.entries();
  }

  names(): IterableIterator<string> {
    return this.#map.keys();
  }

  values(): IterableIterator<string> {
    return this.#map.values();
  }

  [Symbol.iterator](): IterableIterator<[string, string]> {
    return this.entries();
  }

  forEach(
    callback: (value: string, key: string, map: Map<string, string>) => void,
    thisArg?: any,
  ): void {
    this.#map.forEach(callback, thisArg);
  }

  /**
   * The number of cookies in the `Cookie` header.
   */
  get size(): number {
    return this.#map.size;
  }

  toString(): string {
    let pairs: string[] = [];

    for (let [name, value] of this.#map) {
      pairs.push(`${name}=${quote(value)}`);
    }

    return pairs.join('; ');
  }
}
