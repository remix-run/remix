import { ContentDisposition } from './content-disposition.js';
import { ContentType } from './content-type.js';
import { Cookie } from './cookie.js';
import { canonicalHeaderName } from './header-names.js';
import { HeaderValue } from './header-value.js';
import { SetCookie } from './set-cookie.js';

const CRLF = '\r\n';
const SetCookieKey = 'set-cookie';

export type SuperHeadersInit =
  | SuperHeaders
  | Headers
  | [string, string | HeaderValue][]
  | Record<string, string | HeaderValue>;

/**
 * A Headers object, with superpowers.
 */
export class SuperHeaders extends Headers implements Iterable<[string, string]> {
  private map: Map<string, string | HeaderValue>;
  private setCookieValues: (string | SetCookie)[] = [];

  constructor(init?: string | SuperHeadersInit) {
    super();

    this.map = new Map();

    if (init) {
      if (typeof init === 'string') {
        let lines = init.split(CRLF);
        for (let line of lines) {
          let match = line.match(/^([^:]+):(.*)/);
          if (match) {
            this.append(match[1].trim(), match[2].trim());
          }
        }
      } else if (init instanceof SuperHeaders || Array.isArray(init)) {
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
    let key = name.toLowerCase();
    if (key === SetCookieKey) {
      this.setCookieValues.push(value as string | SetCookie);
    } else {
      let existingValue = this.map.get(key);
      this.map.set(key, existingValue ? `${existingValue}, ${value}` : value);
    }
  }

  delete(name: string): void {
    let key = name.toLowerCase();
    if (key === SetCookieKey) {
      this.setCookieValues = [];
    } else {
      this.map.delete(key);
    }
  }

  get(name: string): string | null {
    let key = name.toLowerCase();
    if (key === SetCookieKey) {
      return this.setCookieValues.map((value) => value.toString()).join(', ');
    } else {
      let value = this.map.get(key);
      return value === undefined ? null : value.toString();
    }
  }

  getSetCookie(): string[] {
    return this.setCookieValues.map((value) => value.toString());
  }

  has(name: string): boolean {
    let key = name.toLowerCase();
    if (key === SetCookieKey) {
      return this.setCookieValues.length > 0;
    } else {
      return this.map.has(key);
    }
  }

  set(name: string, value: string | HeaderValue): void {
    let key = name.toLowerCase();
    if (key === SetCookieKey) {
      this.setCookieValues = [value as string | SetCookie];
    } else {
      this.map.set(key, value);
    }
  }

  *entries(): IterableIterator<[string, string]> {
    for (let [key, value] of this.map) {
      let stringValue = value.toString();
      if (stringValue !== '') {
        yield [key, stringValue];
      }
    }

    for (let value of this.setCookieValues) {
      let stringValue = value.toString();
      if (stringValue !== '') {
        yield [SetCookieKey, stringValue];
      }
    }
  }

  *keys(): IterableIterator<string> {
    for (let [key] of this) {
      yield key;
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
    callback: (value: string, key: string, parent: SuperHeaders) => void,
    thisArg?: any
  ): void {
    for (let [key, value] of this) {
      callback.call(thisArg, value, key, this);
    }
  }

  toString(): string {
    let lines: string[] = [];

    for (let [key, value] of this) {
      lines.push(`${canonicalHeaderName(key)}: ${value}`);
    }

    return lines.join(CRLF);
  }

  // Header-specific getters and setters

  get contentDisposition(): ContentDisposition {
    return this.getHeaderValue('content-disposition', ContentDisposition);
  }

  set contentDisposition(value: string | ContentDisposition) {
    this.map.set('content-disposition', value);
  }

  get contentLength(): number {
    let value = this.map.get('content-length');
    if (typeof value === 'number') return value;
    return value ? parseInt(value.toString(), 10) : NaN;
  }

  set contentLength(value: number) {
    this.map.set('content-length', value);
  }

  get contentType(): ContentType {
    return this.getHeaderValue('content-type', ContentType);
  }

  set contentType(value: string | ContentType) {
    this.map.set('content-type', value);
  }

  get cookie(): Cookie {
    return this.getHeaderValue('cookie', Cookie);
  }

  set cookie(value: string | Cookie) {
    this.map.set('cookie', value);
  }

  get setCookie(): SetCookie[] {
    for (let i = 0; i < this.setCookieValues.length; i++) {
      let value = this.setCookieValues[i];
      if (typeof value === 'string') {
        this.setCookieValues[i] = new SetCookie(value);
      }
    }

    return this.setCookieValues as SetCookie[];
  }

  set setCookie(values: string | (string | SetCookie)[]) {
    if (typeof values === 'string') {
      this.setCookieValues = [values];
    } else {
      this.setCookieValues = values.slice(0);
    }
  }

  private getHeaderValue<T extends HeaderValue>(
    key: string,
    ctor: new (initialValue: string) => T
  ): T {
    let value = this.map.get(key);
    if (value) {
      if (typeof value === 'string') {
        let headerValue = new ctor(value);
        this.map.set(key, headerValue);
        return headerValue;
      } else {
        return value as T;
      }
    } else {
      let headerValue = new ctor('');
      this.map.set(key, headerValue);
      return headerValue;
    }
  }
}
