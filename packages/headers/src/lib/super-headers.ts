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
 * [API Reference](https://github.com/mjackson/remix-the-web/tree/main/packages/headers)
 *
 * [MDN `Headers` Base Class Reference](https://developer.mozilla.org/en-US/docs/Web/API/Headers)
 */
export class SuperHeaders extends Headers {
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

  /**
   * Appends a new header value to the existing set of values for a header,
   * or adds the header if it does not already exist.
   *
   * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/Headers/append)
   */
  append(name: string, value: string | HeaderValue): void {
    let key = name.toLowerCase();
    if (key === SetCookieKey) {
      this.#setCookieValues.push(value as string | SetCookie);
    } else {
      let existingValue = this.#map.get(key);
      this.#map.set(key, existingValue ? `${existingValue}, ${value}` : value);
    }
  }

  /**
   * Removes a header.
   *
   * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/Headers/delete)
   */
  delete(name: string): void {
    let key = name.toLowerCase();
    if (key === SetCookieKey) {
      this.#setCookieValues = [];
    } else {
      this.#map.delete(key);
    }
  }

  /**
   * Returns a string of all the values for a header, or `null` if the header does not exist.
   *
   * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/Headers/get)
   */
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

  /**
   * Returns an array of all values associated with the `Set-Cookie` header. This is
   * useful when building headers for a HTTP response since multiple `Set-Cookie` headers
   * must be sent on separate lines.
   *
   * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/Headers/getSetCookie)
   */
  getSetCookie(): string[] {
    return this.#setCookieValues.map((value) => value.toString());
  }

  /**
   * Returns `true` if the header is present in the list of headers.
   *
   * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/Headers/has)
   */
  has(name: string): boolean {
    let key = name.toLowerCase();
    if (key === SetCookieKey) {
      return this.#setCookieValues.length > 0;
    } else {
      return this.#map.has(key);
    }
  }

  /**
   * Sets a new value for the given header. If the header already exists, the new value
   * will replace the existing value.
   *
   * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/Headers/set)
   */
  set(name: string, value: string | HeaderValue): void {
    let key = name.toLowerCase();
    if (key === SetCookieKey) {
      this.#setCookieValues = [value as string | SetCookie];
    } else {
      this.#map.set(key, value);
    }
  }

  /**
   * Returns an iterator of all header key/value pairs.
   *
   * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/Headers/entries)
   */
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

  /**
   * Returns an iterator of all header keys (lowercase).
   *
   * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/Headers/keys)
   */
  *keys(): IterableIterator<string> {
    for (let [key] of this) {
      yield key;
    }
  }

  /**
   * Returns an iterator of all header values.
   *
   * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/Headers/values)
   */
  *values(): IterableIterator<string> {
    for (let [, value] of this) {
      yield value;
    }
  }

  [Symbol.iterator](): IterableIterator<[string, string]> {
    return this.entries();
  }

  /**
   * Invokes the `callback` for each header key/value pair.
   *
   * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/Headers/forEach)
   */
  forEach(
    callback: (value: string, key: string, parent: SuperHeaders) => void,
    thisArg?: any,
  ): void {
    for (let [key, value] of this) {
      callback.call(thisArg, value, key, this);
    }
  }

  /**
   * Returns a string representation of the headers suitable for use in a HTTP message.
   */
  toString(): string {
    let lines: string[] = [];

    for (let [key, value] of this) {
      lines.push(`${canonicalHeaderName(key)}: ${value}`);
    }

    return lines.join(CRLF);
  }

  // Header-specific getters and setters

  /**
   * The `Accept-Language` header contains information about preferred natural language for the
   * response.
   *
   * [MDN `Accept-Language` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Accept-Language)
   *
   * [HTTP/1.1 Specification](https://datatracker.ietf.org/doc/html/rfc7231#section-5.3.5)
   */
  get acceptLanguage(): AcceptLanguage {
    return this.#getHeaderValue('accept-language', AcceptLanguage);
  }

  set acceptLanguage(value: string | AcceptLanguageInit) {
    this.#setHeaderValue('accept-language', AcceptLanguage, value);
  }

  /**
   * The `Age` header contains the time in seconds an object was in a proxy cache.
   *
   * [MDN `Age` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Age)
   *
   * [HTTP/1.1 Specification](https://datatracker.ietf.org/doc/html/rfc7234#section-5.1)
   */
  get age(): number | undefined {
    return this.#getNumberValue('age');
  }

  set age(value: string | number) {
    this.#map.set('age', value);
  }

  /**
   * The `Cache-Control` header contains directives for caching mechanisms in both requests and responses.
   *
   * [MDN `Cache-Control` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control)
   *
   * [HTTP/1.1 Specification](https://datatracker.ietf.org/doc/html/rfc7234#section-5.2)
   */
  get cacheControl(): CacheControl {
    return this.#getHeaderValue('cache-control', CacheControl);
  }

  set cacheControl(value: string | CacheControlInit) {
    this.#setHeaderValue('cache-control', CacheControl, value);
  }

  /**
   * The `Content-Disposition` header is a response-type header that describes how the payload is displayed.
   *
   * [MDN `Content-Disposition` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Disposition)
   *
   * [RFC 6266](https://datatracker.ietf.org/doc/html/rfc6266)
   */
  get contentDisposition(): ContentDisposition {
    return this.#getHeaderValue('content-disposition', ContentDisposition);
  }

  set contentDisposition(value: string | ContentDispositionInit) {
    this.#setHeaderValue('content-disposition', ContentDisposition, value);
  }

  /**
   * The `Content-Length` header indicates the size of the entity-body in bytes.
   *
   * [MDN `Content-Length` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Length)
   *
   * [HTTP/1.1 Specification](https://datatracker.ietf.org/doc/html/rfc7230#section-3.3.2)
   */
  get contentLength(): number | undefined {
    return this.#getNumberValue('content-length');
  }

  set contentLength(value: string | number) {
    this.#map.set('content-length', value);
  }

  /**
   * The `Content-Type` header indicates the media type of the resource.
   *
   * [MDN `Content-Type` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Type)
   *
   * [HTTP/1.1 Specification](https://datatracker.ietf.org/doc/html/rfc7231#section-3.1.1.5)
   */
  get contentType(): ContentType {
    return this.#getHeaderValue('content-type', ContentType);
  }

  set contentType(value: string | ContentTypeInit) {
    this.#setHeaderValue('content-type', ContentType, value);
  }

  /**
   * The `Cookie` request header contains stored HTTP cookies previously sent by the server with
   * the `Set-Cookie` header.
   *
   * [MDN `Cookie` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cookie)
   *
   * [HTTP/1.1 Specification](https://datatracker.ietf.org/doc/html/rfc6265#section-5.4)
   */
  get cookie(): Cookie {
    return this.#getHeaderValue('cookie', Cookie);
  }

  set cookie(value: string | CookieInit) {
    this.#setHeaderValue('cookie', Cookie, value);
  }

  /**
   * The `Date` header contains the date and time at which the message was sent.
   *
   * [MDN `Date` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Date)
   *
   * [HTTP/1.1 Specification](https://datatracker.ietf.org/doc/html/rfc7231#section-7.1.1.2)
   */
  get date(): Date | undefined {
    return this.#getDateValue('date');
  }

  set date(value: string | Date) {
    this.#map.set('date', value);
  }

  /**
   * The `Expires` header contains the date/time after which the response is considered stale.
   *
   * [MDN `Expires` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Expires)
   *
   * [HTTP/1.1 Specification](https://datatracker.ietf.org/doc/html/rfc7234#section-5.3)
   */
  get expires(): Date | undefined {
    return this.#getDateValue('expires');
  }

  set expires(value: string | Date) {
    this.#map.set('expires', value);
  }

  /**
   * The `If-Modified-Since` header makes a request conditional on the last modification date of the
   * requested resource.
   *
   * [MDN `If-Modified-Since` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/If-Modified-Since)
   *
   * [HTTP/1.1 Specification](https://datatracker.ietf.org/doc/html/rfc7232#section-3.3)
   */
  get ifModifiedSince(): Date | undefined {
    return this.#getDateValue('if-modified-since');
  }

  set ifModifiedSince(value: string | Date) {
    this.#map.set('if-modified-since', value);
  }

  /**
   * The `If-Unmodified-Since` header makes a request conditional on the last modification date of the
   * requested resource.
   *
   * [MDN `If-Unmodified-Since` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/If-Unmodified-Since)
   *
   * [HTTP/1.1 Specification](https://datatracker.ietf.org/doc/html/rfc7232#section-3.4)
   */
  get ifUnmodifiedSince(): Date | undefined {
    return this.#getDateValue('if-unmodified-since');
  }

  set ifUnmodifiedSince(value: string | Date) {
    this.#map.set('if-unmodified-since', value);
  }

  /**
   * The `Last-Modified` header contains the date and time at which the resource was last modified.
   *
   * [MDN `Last-Modified` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Last-Modified)
   *
   * [HTTP/1.1 Specification](https://datatracker.ietf.org/doc/html/rfc7232#section-2.2)
   */
  get lastModified(): Date | undefined {
    return this.#getDateValue('last-modified');
  }

  set lastModified(value: string | Date) {
    this.#map.set('last-modified', value);
  }

  /**
   * The `Set-Cookie` header is used to send cookies from the server to the user agent.
   *
   * [MDN `Set-Cookie` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie)
   *
   * [HTTP/1.1 Specification](https://datatracker.ietf.org/doc/html/rfc6265#section-4.1)
   */
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
