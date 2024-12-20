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
   * An array of the names of the cookies in the header.
   */
  get names(): string[] {
    return Array.from(this.#map.keys());
  }

  /**
   * An array of the values of the cookies in the header.
   */
  get values(): string[] {
    return Array.from(this.#map.values());
  }

  /**
   * The number of cookies in the header.
   */
  get size(): number {
    return this.#map.size;
  }

  /**
   * Gets the value of a cookie with the given name from the header.
   * @param name The name of the cookie.
   * @returns The value of the cookie, or `null` if the cookie does not exist.
   */
  get(name: string): string | null {
    return this.#map.get(name) ?? null;
  }

  /**
   * Sets a cookie with the given name and value in the header.
   * @param name The name of the cookie.
   * @param value The value of the cookie.
   */
  set(name: string, value: string): void {
    this.#map.set(name, value);
  }

  /**
   * Removes a cookie with the given name from the header.
   * @param name The name of the cookie.
   */
  delete(name: string): void {
    this.#map.delete(name);
  }

  /**
   * True if a cookie with the given name exists in the header.
   * @param name The name of the cookie.
   * @returns True if a cookie with the given name exists in the header.
   */
  has(name: string): boolean {
    return this.#map.has(name);
  }

  /**
   * Removes all cookies from the header.
   */
  clear(): void {
    this.#map.clear();
  }

  entries(): IterableIterator<[string, string]> {
    return this.#map.entries();
  }

  [Symbol.iterator](): IterableIterator<[string, string]> {
    return this.entries();
  }

  forEach(callback: (name: string, value: string, header: Cookie) => void, thisArg?: any): void {
    for (let [name, value] of this) {
      callback.call(thisArg, name, value, this);
    }
  }

  toString(): string {
    let pairs: string[] = [];

    for (let [name, value] of this.#map) {
      pairs.push(`${name}=${quote(value)}`);
    }

    return pairs.join('; ');
  }
}
