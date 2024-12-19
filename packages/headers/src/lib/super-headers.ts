import { type AcceptLanguageInit, AcceptLanguage } from './accept-language.ts';
import { type CacheControlInit, CacheControl } from './cache-control.ts';
import { type ContentDispositionInit, ContentDisposition } from './content-disposition.ts';
import { type ContentTypeInit, ContentType } from './content-type.ts';
import { type CookieInit, Cookie } from './cookie.ts';
import { canonicalHeaderName } from './header-names.ts';
import { type HeaderValue } from './header-value.ts';
import { type SetCookieInit, SetCookie } from './set-cookie.ts';
import { isIterable, isValidDate } from './utils.ts';

const CRLF = '\r\n';
const SetCookieKey = 'set-cookie';

interface SuperHeadersPropertyInit {
  /**
   * The [`Accept-Language`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Accept-Language) header value.
   */
  acceptLanguage?: string | AcceptLanguageInit;
  /**
   * The [`Age`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Age) header value.
   */
  age?: string | number;
  /**
   * The [`Cache-Control`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control) header value.
   */
  cacheControl?: string | CacheControlInit;
  /**
   * The [`Content-Disposition`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Disposition) header value.
   */
  contentDisposition?: string | ContentDispositionInit;
  /**
   * The [`Content-Length`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Length) header value.
   */
  contentLength?: string | number;
  /**
   * The [`Content-Type`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Type) header value.
   */
  contentType?: string | ContentTypeInit;
  /**
   * The [`Cookie`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cookie) header value.
   */
  cookie?: string | CookieInit;
  /**
   * The [`Date`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Date) header value.
   */
  date?: string | Date;
  /**
   * The [`Expires`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Expires) header value.
   */
  expires?: string | Date;
  /**
   * The [`If-Modified-Since`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/If-Modified-Since) header value.
   */
  ifModifiedSince?: string | Date;
  /**
   * The [`If-Unmodified-Since`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/If-Unmodified-Since) header value.
   */
  ifUnmodifiedSince?: string | Date;
  /**
   * The [`Last-Modified`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Last-Modified) header value.
   */
  lastModified?: string | Date;
  /**
   * The [`Set-Cookie`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie) header value(s).
   */
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
      } else if (value == null) {
        return null;
      } else {
        let str = value.toString();
        return str === '' ? null : str;
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
    return this.#setCookieValues.map((value) =>
      typeof value === 'string' ? value : value.toString(),
    );
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
  set(name: string, value: string): void {
    let key = name.toLowerCase();
    if (key === SetCookieKey) {
      this.#setCookieValues = [value];
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

  set acceptLanguage(value: string | AcceptLanguageInit | undefined | null) {
    if (value != null) {
      this.#setHeaderValue('accept-language', AcceptLanguage, value);
    } else {
      this.#map.delete('accept-language');
    }
  }

  /**
   * The `Age` header contains the time in seconds an object was in a proxy cache.
   *
   * [MDN `Age` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Age)
   *
   * [HTTP/1.1 Specification](https://datatracker.ietf.org/doc/html/rfc7234#section-5.1)
   */
  get age(): number | null {
    return this.#getNumberValue('age');
  }

  set age(value: string | number | undefined | null) {
    if (value != null) {
      this.#map.set('age', value);
    } else {
      this.#map.delete('age');
    }
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

  set cacheControl(value: string | CacheControlInit | undefined | null) {
    if (value != null) {
      this.#setHeaderValue('cache-control', CacheControl, value);
    } else {
      this.#map.delete('cache-control');
    }
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

  set contentDisposition(value: string | ContentDispositionInit | undefined | null) {
    if (value != null) {
      this.#setHeaderValue('content-disposition', ContentDisposition, value);
    } else {
      this.#map.delete('content-disposition');
    }
  }

  /**
   * The `Content-Length` header indicates the size of the entity-body in bytes.
   *
   * [MDN `Content-Length` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Length)
   *
   * [HTTP/1.1 Specification](https://datatracker.ietf.org/doc/html/rfc7230#section-3.3.2)
   */
  get contentLength(): number | null {
    return this.#getNumberValue('content-length');
  }

  set contentLength(value: string | number | undefined | null) {
    if (value != null) {
      this.#map.set('content-length', value);
    } else {
      this.#map.delete('content-length');
    }
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

  set contentType(value: string | ContentTypeInit | undefined | null) {
    if (value != null) {
      this.#setHeaderValue('content-type', ContentType, value);
    } else {
      this.#map.delete('content-type');
    }
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

  set cookie(value: string | CookieInit | undefined | null) {
    if (value != null) {
      this.#setHeaderValue('cookie', Cookie, value);
    } else {
      this.#map.delete('cookie');
    }
  }

  /**
   * The `Date` header contains the date and time at which the message was sent.
   *
   * [MDN `Date` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Date)
   *
   * [HTTP/1.1 Specification](https://datatracker.ietf.org/doc/html/rfc7231#section-7.1.1.2)
   */
  get date(): Date | null {
    return this.#getDateValue('date');
  }

  set date(value: string | Date | undefined | null) {
    if (value != null) {
      this.#map.set('date', value);
    } else {
      this.#map.delete('date');
    }
  }

  /**
   * The `Expires` header contains the date/time after which the response is considered stale.
   *
   * [MDN `Expires` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Expires)
   *
   * [HTTP/1.1 Specification](https://datatracker.ietf.org/doc/html/rfc7234#section-5.3)
   */
  get expires(): Date | null {
    return this.#getDateValue('expires');
  }

  set expires(value: string | Date | undefined | null) {
    if (value != null) {
      this.#map.set('expires', value);
    } else {
      this.#map.delete('expires');
    }
  }

  /**
   * The `If-Modified-Since` header makes a request conditional on the last modification date of the
   * requested resource.
   *
   * [MDN `If-Modified-Since` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/If-Modified-Since)
   *
   * [HTTP/1.1 Specification](https://datatracker.ietf.org/doc/html/rfc7232#section-3.3)
   */
  get ifModifiedSince(): Date | null {
    return this.#getDateValue('if-modified-since');
  }

  set ifModifiedSince(value: string | Date | undefined | null) {
    if (value != null) {
      this.#map.set('if-modified-since', value);
    } else {
      this.#map.delete('if-modified-since');
    }
  }

  /**
   * The `If-Unmodified-Since` header makes a request conditional on the last modification date of the
   * requested resource.
   *
   * [MDN `If-Unmodified-Since` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/If-Unmodified-Since)
   *
   * [HTTP/1.1 Specification](https://datatracker.ietf.org/doc/html/rfc7232#section-3.4)
   */
  get ifUnmodifiedSince(): Date | null {
    return this.#getDateValue('if-unmodified-since');
  }

  set ifUnmodifiedSince(value: string | Date | undefined | null) {
    if (value != null) {
      this.#map.set('if-unmodified-since', value);
    } else {
      this.#map.delete('if-unmodified-since');
    }
  }

  /**
   * The `Last-Modified` header contains the date and time at which the resource was last modified.
   *
   * [MDN `Last-Modified` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Last-Modified)
   *
   * [HTTP/1.1 Specification](https://datatracker.ietf.org/doc/html/rfc7232#section-2.2)
   */
  get lastModified(): Date | null {
    return this.#getDateValue('last-modified');
  }

  set lastModified(value: string | Date | undefined | null) {
    if (value != null) {
      this.#map.set('last-modified', value);
    } else {
      this.#map.delete('last-modified');
    }
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

  set setCookie(values: (string | SetCookieInit)[] | string | SetCookieInit | undefined | null) {
    if (values != null) {
      if (Array.isArray(values)) {
        this.#setCookieValues = values.map((value) =>
          typeof value === 'string' || value instanceof SetCookie ? value : new SetCookie(value),
        );
      } else {
        this.#setCookieValues = [new SetCookie(values)];
      }
    } else {
      this.#setCookieValues = [];
    }
  }

  // helpers

  #getDateValue(key: string): Date | null {
    let value = this.#map.get(key);
    if (value) {
      if (value instanceof Date) {
        return value;
      }

      if (typeof value === 'string') {
        let date = new Date(value);
        if (isValidDate(date)) {
          this.#map.set(key, date); // cache the parsed date
          return date;
        } else {
          this.#map.delete(key); // bad value, remove it
        }
      }

      this.#map.delete(key); // bad value, remove it
    }

    return null;
  }

  #getNumberValue(key: string): number | null {
    let value = this.#map.get(key);
    if (value !== undefined) {
      if (typeof value === 'number') {
        return value;
      }

      if (typeof value === 'string') {
        let num = parseInt(value, 10);
        if (!isNaN(num)) {
          this.#map.set(key, num); // cache the parsed number
          return num;
        } else {
          this.#map.delete(key); // bad value, remove it
        }
      }

      this.#map.delete(key); // bad value, remove it
    }

    return null;
  }

  #getHeaderValue<T extends HeaderValue>(key: string, ctor: new (init?: string) => T): T {
    let value = this.#map.get(key);
    if (value !== undefined) {
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
