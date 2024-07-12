import { ContentDisposition } from './content-disposition.js';
import { ContentType } from './content-type.js';
import { Cookie } from './cookie.js';
import { normalizeHeaderName } from './header-names.js';
import { HeaderValue } from './header-value.js';

export type SuperHeadersInit =
  | SuperHeaders
  | Headers
  | [string, string | HeaderValue][]
  | Record<string, string | HeaderValue>;

/**
 * HTTP Headers object, with superpowers.
 */
export class SuperHeaders implements Iterable<[string, string]> {
  private map: Map<string, string | HeaderValue>;

  constructor(init?: SuperHeadersInit) {
    this.map = new Map();
    if (init) {
      if (init instanceof SuperHeaders || Array.isArray(init)) {
        for (let [name, value] of init) {
          this.append(name, value);
        }
      } else if (init instanceof Headers) {
        init.forEach((value, name) => {
          this.append(name, value);
        });
      } else if (typeof init === 'object') {
        for (let name in init) {
          if (Object.prototype.hasOwnProperty.call(init, name)) {
            this.append(name, init[name]);
          }
        }
      }
    }
  }

  append(name: string, value: string | HeaderValue): void {
    let lowerName = name.toLowerCase();
    let existingValue = this.map.get(lowerName);
    this.map.set(lowerName, existingValue ? `${existingValue}, ${value}` : value);
  }

  delete(name: string): void {
    this.map.delete(name.toLowerCase());
  }

  get(name: string): string | null {
    let value = this.map.get(name.toLowerCase());
    return value === undefined ? null : value.toString();
  }

  has(name: string): boolean {
    return this.map.has(name.toLowerCase());
  }

  set(name: string, value: string | HeaderValue): void {
    this.map.set(name.toLowerCase(), value);
  }

  *entries(): IterableIterator<[string, string]> {
    for (let [name, value] of this.map) {
      let stringValue = value.toString();
      if (stringValue !== '') {
        yield [name, stringValue];
      }
    }
  }

  *names(): IterableIterator<string> {
    for (let [name] of this) {
      yield name;
    }
  }

  *values(): IterableIterator<string> {
    for (let [, value] of this) {
      yield value;
    }
  }

  [Symbol.iterator](): IterableIterator<[string, string]> {
    return this.entries();
  }

  forEach(
    callback: (value: string, name: string, parent: SuperHeaders) => void,
    thisArg?: any
  ): void {
    for (let [name, value] of this) {
      callback.call(thisArg, value, name, this);
    }
  }

  toString(): string {
    let lines: string[] = [];
    for (let [name, value] of this) {
      lines.push(`${normalizeHeaderName(name)}: ${value}`);
    }
    return lines.join('\r\n');
  }

  // Header-specific getters and setters

  get contentDisposition(): ContentDisposition {
    return this.getHeaderValue('content-disposition', ContentDisposition) as ContentDisposition;
  }

  set contentDisposition(value: string | ContentDisposition) {
    this.map.set('content-disposition', value);
  }

  get contentType(): ContentType {
    return this.getHeaderValue('content-type', ContentType) as ContentType;
  }

  set contentType(value: string | ContentType) {
    this.map.set('content-type', value);
  }

  get cookie(): Cookie {
    return this.getHeaderValue('cookie', Cookie) as Cookie;
  }

  set cookie(value: string | Cookie) {
    this.map.set('cookie', value);
  }

  private getHeaderValue(
    key: string,
    constructor: new (initialValue: string) => HeaderValue
  ): HeaderValue {
    let value = this.map.get(key);
    if (value) {
      if (typeof value === 'string') {
        let headerValue = new constructor(value);
        this.map.set(key, headerValue);
        return headerValue;
      } else {
        return value;
      }
    } else {
      let headerValue = new constructor('');
      this.map.set(key, headerValue);
      return headerValue;
    }
  }
}
