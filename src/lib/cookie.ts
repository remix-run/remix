import { HeaderValue } from './header-value.js';

/**
 * Represents the value of a `Cookie` HTTP header.
 */
export class Cookie implements HeaderValue, Iterable<[string, string]> {
  private cookies: Map<string, string>;

  constructor(initialValue: string) {
    this.cookies = new Map();
    let pairs = initialValue.split(';').map((pair) => pair.trim());
    for (let pair of pairs) {
      let [name, value] = splitNameValue(pair);
      if (name) {
        this.cookies.set(name, value);
      }
    }
  }

  get(name: string): string | undefined {
    return this.cookies.get(name);
  }

  set(name: string, value: string): void {
    this.cookies.set(name, value);
  }

  delete(name: string): boolean {
    return this.cookies.delete(name);
  }

  has(name: string): boolean {
    return this.cookies.has(name);
  }

  clear(): void {
    this.cookies.clear();
  }

  [Symbol.iterator](): IterableIterator<[string, string]> {
    return this.cookies.entries();
  }

  entries(): IterableIterator<[string, string]> {
    return this.cookies.entries();
  }

  names(): IterableIterator<string> {
    return this.cookies.keys();
  }

  values(): IterableIterator<string> {
    return this.cookies.values();
  }

  forEach(
    callbackfn: (value: string, key: string, map: Map<string, string>) => void,
    thisArg?: any
  ): void {
    this.cookies.forEach(callbackfn, thisArg);
  }

  get size(): number {
    return this.cookies.size;
  }

  toString(): string {
    let pairs: string[] = [];
    for (let [name, value] of this.cookies) {
      pairs.push(`${name}=${value}`);
    }
    return pairs.join('; ');
  }
}

function splitNameValue(pair: string): [string, string] {
  let equalsIndex = pair.indexOf('=');
  if (equalsIndex === -1) {
    return [pair, ''];
  }
  return [pair.substring(0, equalsIndex).trim(), pair.substring(equalsIndex + 1).trim()];
}
