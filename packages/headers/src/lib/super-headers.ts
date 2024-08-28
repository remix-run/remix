import { AcceptLanguageInit, AcceptLanguage } from './accept-language.js';
import { CacheControlInit, CacheControl } from './cache-control.js';
import { ContentDispositionInit, ContentDisposition } from './content-disposition.js';
import { ContentTypeInit, ContentType } from './content-type.js';
import { CookieInit, Cookie } from './cookie.js';
import { canonicalHeaderName } from './header-names.js';
import { HeaderValue } from './header-value.js';
import { SetCookieInit, SetCookie } from './set-cookie.js';
import { isIterable, isValidDate } from './utils.js';

const CRLF = '\r\n';
const SetCookieKey = 'set-cookie';

interface SuperHeadersPropertyInit {
  acceptLanguage?: string | AcceptLanguageInit;
  age?: string | number;
  cacheControl?: string | CacheControlInit;
  contentDisposition?: string | ContentDispositionInit;
  contentLength?: string | number;
  contentType?: string | ContentTypeInit;
  cookie?: string | CookieInit;
  date?: string | Date;
  expires?: string | Date;
  ifModifiedSince?: string | Date;
  ifUnmodifiedSince?: string | Date;
  lastModified?: string | Date;
  setCookie?: string | (string | SetCookieInit)[];
}

export type SuperHeadersInit =
  | Iterable<[string, string | HeaderValue]>
  | (SuperHeadersPropertyInit & Record<string, string | HeaderValue>);

/**
 * An enhanced JavaScript `Headers` interface with type-safe access.
 *
 * [API Reference](https://github.com/mjackson/headers)
 *
 * [MDN Reference for `Headers` base class](https://developer.mozilla.org/en-US/docs/Web/API/Headers)
 */
export class SuperHeaders extends Headers implements Iterable<[string, string]> {
  #map: Map<string, string | HeaderValue>;
  #setCookieValues: (string | SetCookie)[] = [];

  constructor(init?: string | SuperHeadersInit | Headers) {
    super();

    this.#map = new Map();

    if (init) {
      if (typeof init === 'string') {
        let lines = init.split(CRLF);
        for (let line of lines) {
          let match = line.match(/^([^:]+):(.*)/);
          if (match) {
            this.append(match[1].trim(), match[2].trim());
          }
        }
      } else if (isIterable(init)) {
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
            let setter = Object.getOwnPropertyDescriptor(SuperHeaders.prototype, name)?.set;
            if (setter) {
              setter.call(this, init[name]);
            } else {
              this.append(name, init[name]);
            }
          }
        }
      }
    }
  }

  append(name: string, value: string | HeaderValue): void {
    let key = name.toLowerCase();
    if (key === SetCookieKey) {
      this.#setCookieValues.push(value as string | SetCookie);
    } else {
      let existingValue = this.#map.get(key);
      this.#map.set(key, existingValue ? `${existingValue}, ${value}` : value);
    }
  }

  delete(name: string): void {
    let key = name.toLowerCase();
    if (key === SetCookieKey) {
      this.#setCookieValues = [];
    } else {
      this.#map.delete(key);
    }
  }

  get(name: string): string | null {
    let key = name.toLowerCase();
    if (key === SetCookieKey) {
      return this.#setCookieValues.map((value) => value.toString()).join(', ');
    } else {
      let value = this.#map.get(key);
      if (typeof value === 'string') {
        return value;
      } else if (value instanceof Date) {
        return value.toUTCString();
      } else if (value != null) {
        return value.toString();
      } else {
        return null;
      }
    }
  }

  getSetCookie(): string[] {
    return this.#setCookieValues.map((value) => value.toString());
  }

  has(name: string): boolean {
    let key = name.toLowerCase();
    if (key === SetCookieKey) {
      return this.#setCookieValues.length > 0;
    } else {
      return this.#map.has(key);
    }
  }

  set(name: string, value: string | HeaderValue): void {
    let key = name.toLowerCase();
    if (key === SetCookieKey) {
      this.#setCookieValues = [value as string | SetCookie];
    } else {
      this.#map.set(key, value);
    }
  }

  *entries(): IterableIterator<[string, string]> {
    for (let [key] of this.#map) {
      let stringValue = this.get(key);
      if (stringValue) {
        yield [key, stringValue];
      }
    }

    for (let value of this.#setCookieValues) {
      let stringValue = value.toString();
      if (stringValue) {
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
    thisArg?: any,
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

  get acceptLanguage(): AcceptLanguage {
    return this.#getHeaderValue('accept-language', AcceptLanguage);
  }

  set acceptLanguage(value: string | AcceptLanguageInit) {
    this.#setHeaderValue('accept-language', AcceptLanguage, value);
  }

  get age(): number | undefined {
    return this.#getNumberValue('age');
  }

  set age(value: string | number) {
    this.#map.set('age', value);
  }

  get cacheControl(): CacheControl {
    return this.#getHeaderValue('cache-control', CacheControl);
  }

  set cacheControl(value: string | CacheControlInit) {
    this.#setHeaderValue('cache-control', CacheControl, value);
  }

  get contentDisposition(): ContentDisposition {
    return this.#getHeaderValue('content-disposition', ContentDisposition);
  }

  set contentDisposition(value: string | ContentDispositionInit) {
    this.#setHeaderValue('content-disposition', ContentDisposition, value);
  }

  get contentLength(): number | undefined {
    return this.#getNumberValue('content-length');
  }

  set contentLength(value: string | number) {
    this.#map.set('content-length', value);
  }

  get contentType(): ContentType {
    return this.#getHeaderValue('content-type', ContentType);
  }

  set contentType(value: string | ContentTypeInit) {
    this.#setHeaderValue('content-type', ContentType, value);
  }

  get cookie(): Cookie {
    return this.#getHeaderValue('cookie', Cookie);
  }

  set cookie(value: string | CookieInit) {
    this.#setHeaderValue('cookie', Cookie, value);
  }

  get date(): Date | undefined {
    return this.#getDateValue('date');
  }

  set date(value: string | Date) {
    this.#map.set('date', value);
  }

  get expires(): Date | undefined {
    return this.#getDateValue('expires');
  }

  set expires(value: string | Date) {
    this.#map.set('expires', value);
  }

  get ifModifiedSince(): Date | undefined {
    return this.#getDateValue('if-modified-since');
  }

  set ifModifiedSince(value: string | Date) {
    this.#map.set('if-modified-since', value);
  }

  get ifUnmodifiedSince(): Date | undefined {
    return this.#getDateValue('if-unmodified-since');
  }

  set ifUnmodifiedSince(value: string | Date) {
    this.#map.set('if-unmodified-since', value);
  }

  get lastModified(): Date | undefined {
    return this.#getDateValue('last-modified');
  }

  set lastModified(value: string | Date) {
    this.#map.set('last-modified', value);
  }

  get setCookie(): SetCookie[] {
    for (let i = 0; i < this.#setCookieValues.length; ++i) {
      let value = this.#setCookieValues[i];
      if (typeof value === 'string') {
        this.#setCookieValues[i] = new SetCookie(value);
      }
    }

    return this.#setCookieValues as SetCookie[];
  }

  set setCookie(values: string | (string | SetCookieInit)[]) {
    if (typeof values === 'string') {
      this.#setCookieValues = [values];
    } else {
      this.#setCookieValues = values.map((value) => {
        if (typeof value === 'string' || value instanceof SetCookie) {
          return value;
        } else {
          return new SetCookie(value);
        }
      });
    }
  }

  // helpers

  #getDateValue(key: string): Date | undefined {
    let value = this.#map.get(key);
    if (value) {
      if (typeof value === 'string') {
        let date = new Date(value);
        if (isValidDate(date)) {
          this.#map.set(key, date); // cache the parsed date
          return date;
        } else {
          this.#map.delete(key); // bad value, remove it
        }
      } else if (value instanceof Date) {
        return value;
      } else {
        this.#map.delete(key); // bad value, remove it
      }
    }
  }

  #getNumberValue(key: string): number | undefined {
    let value = this.#map.get(key);
    if (value) {
      if (typeof value === 'string') {
        let v = parseInt(value, 10);
        if (!isNaN(v)) {
          this.#map.set(key, v); // cache the parsed number
          return v;
        } else {
          this.#map.delete(key); // bad value, remove it
        }
      } else if (typeof value === 'number') {
        return value;
      } else {
        this.#map.delete(key); // bad value, remove it
      }
    }
  }

  #getHeaderValue<T extends HeaderValue>(key: string, ctor: new (init?: string) => T): T {
    let value = this.#map.get(key);
    if (value) {
      if (typeof value === 'string') {
        let headerValue = new ctor(value);
        this.#map.set(key, headerValue);
        return headerValue;
      } else {
        return value as T;
      }
    } else {
      let headerValue = new ctor();
      this.#map.set(key, headerValue);
      return headerValue;
    }
  }

  #setHeaderValue<T>(
    key: string,
    ctor: new (init?: string | T) => HeaderValue,
    value: string | T,
  ): void {
    if (typeof value === 'string' || value instanceof ctor) {
      this.#map.set(key, value);
    } else {
      this.#map.set(key, new ctor(value));
    }
  }
}
