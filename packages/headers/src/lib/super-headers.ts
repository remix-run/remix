import { type AcceptInit, Accept } from './accept.ts';
import { type AcceptLanguageInit, AcceptLanguage } from './accept-language.ts';
import { type CacheControlInit, CacheControl } from './cache-control.ts';
import { type ContentDispositionInit, ContentDisposition } from './content-disposition.ts';
import { type ContentTypeInit, ContentType } from './content-type.ts';
import { type CookieInit, Cookie } from './cookie.ts';
import { canonicalHeaderName } from './header-names.ts';
import { type HeaderValue } from './header-value.ts';
import { type SetCookieInit, SetCookie } from './set-cookie.ts';
import { isIterable } from './utils.ts';

const CRLF = '\r\n';
const SetCookieKey = 'set-cookie';

type DateInit = number | Date;

interface SuperHeadersPropertyInit {
  /**
   * The [`Accept`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Accept) header value.
   */
  accept?: string | AcceptInit;
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
  date?: string | DateInit;
  /**
   * The [`Expires`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Expires) header value.
   */
  expires?: string | DateInit;
  /**
   * The [`If-Modified-Since`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/If-Modified-Since) header value.
   */
  ifModifiedSince?: string | DateInit;
  /**
   * The [`If-Unmodified-Since`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/If-Unmodified-Since) header value.
   */
  ifUnmodifiedSince?: string | DateInit;
  /**
   * The [`Last-Modified`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Last-Modified) header value.
   */
  lastModified?: string | DateInit;
  /**
   * The [`Set-Cookie`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie) header value(s).
   */
  setCookie?: string | (string | SetCookieInit)[];
}

export type SuperHeadersInit =
  | Iterable<[string, string]>
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
        for (let name of Object.getOwnPropertyNames(init)) {
          let value = init[name];

          if (typeof value === 'string') {
            this.set(name, value);
          } else {
            let descriptor = Object.getOwnPropertyDescriptor(SuperHeaders.prototype, name);
            if (descriptor?.set) {
              descriptor.set.call(this, value);
            } else {
              this.set(name, value.toString());
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
  append(name: string, value: string): void {
    let key = name.toLowerCase();
    if (key === SetCookieKey) {
      this.#setCookieValues.push(value);
    } else {
      let existingValue = this.#map.get(key);
      // TODO: check if it's an empty string
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
      return this.getSetCookie().join(', ');
    } else {
      let value = this.#map.get(key);
      if (typeof value === 'string') {
        return value;
      } else if (value != null) {
        let str = value.toString();
        return str === '' ? null : str;
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
      let str = this.get(key);
      if (str) {
        yield [key, str];
      }
    }

    for (let value of this.getSetCookie()) {
      yield [SetCookieKey, value];
    }
  }

  [Symbol.iterator](): IterableIterator<[string, string]> {
    return this.entries();
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

  /**
   * Invokes the `callback` for each header key/value pair.
   *
   * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/Headers/forEach)
   */
  forEach(
    callback: (value: string, key: string, headers: SuperHeaders) => void,
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
   * The `Accept` header is used by clients to indicate the media types that are acceptable
   * in the response.
   *
   * [MDN `Accept` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Accept)
   *
   * [HTTP/1.1 Specification](https://datatracker.ietf.org/doc/html/rfc7231#section-5.3.2)
   */
  get accept(): Accept {
    return this.#getHeaderValue('accept', Accept);
  }

  set accept(value: string | AcceptInit | undefined | null) {
    this.#setHeaderValue('accept', Accept, value);
  }

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
    this.#setHeaderValue('accept-language', AcceptLanguage, value);
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
    this.#setNumberValue('age', value);
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
    this.#setHeaderValue('cache-control', CacheControl, value);
  }

  /**
   * The `Connection` header controls whether the network connection stays open after the current
   * transaction finishes.
   *
   * [MDN `Connection` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Connection)
   *
   * [HTTP/1.1 Specification](https://datatracker.ietf.org/doc/html/rfc7230#section-6.1)
   */
  get connection(): string | null {
    return this.get('connection');
  }

  set connection(value: string | undefined | null) {
    this.#setValue('connection', value);
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
    this.#setHeaderValue('content-disposition', ContentDisposition, value);
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
    this.#setNumberValue('content-length', value);
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

  set cookie(value: string | CookieInit | undefined | null) {
    this.#setHeaderValue('cookie', Cookie, value);
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

  set date(value: string | DateInit | undefined | null) {
    this.#setDateValue('date', value);
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

  set expires(value: string | DateInit | undefined | null) {
    this.#setDateValue('expires', value);
  }

  /**
   * The `Host` header specifies the domain name of the server and (optionally) the TCP port number.
   *
   * [MDN `Host` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Host)
   *
   * [HTTP/1.1 Specification](https://datatracker.ietf.org/doc/html/rfc7230#section-5.4)
   */
  get host(): string | null {
    return this.get('host');
  }

  set host(value: string | undefined | null) {
    this.#setValue('host', value);
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

  set ifModifiedSince(value: string | DateInit | undefined | null) {
    this.#setDateValue('if-modified-since', value);
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

  set ifUnmodifiedSince(value: string | DateInit | undefined | null) {
    this.#setDateValue('if-unmodified-since', value);
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

  set lastModified(value: string | DateInit | undefined | null) {
    this.#setDateValue('last-modified', value);
  }

  /**
   * The `Referer` header contains the address of the previous web page from which a link to the
   * currently requested page was followed.
   *
   * [MDN `Referer` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Referer)
   *
   * [HTTP/1.1 Specification](https://datatracker.ietf.org/doc/html/rfc7231#section-5.5.2)
   */
  get referer(): string | null {
    return this.get('referer');
  }

  set referer(value: string | undefined | null) {
    this.#setValue('referer', value);
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

  #setValue(key: string, value: string | undefined | null): void {
    if (value != null) {
      this.#map.set(key, value);
    } else {
      this.#map.delete(key);
    }
  }

  #getHeaderValue<T extends HeaderValue>(key: string, ctor: new (init?: any) => T): T {
    let value = this.#map.get(key);

    if (value !== undefined) {
      if (typeof value === 'string') {
        let obj = new ctor(value);
        this.#map.set(key, obj); // cache the new object
        return obj;
      } else {
        return value as T;
      }
    }

    let obj = new ctor();
    this.#map.set(key, obj); // cache the new object
    return obj;
  }

  #setHeaderValue(key: string, ctor: new (init?: string) => HeaderValue, value: any): void {
    if (value != null) {
      this.#map.set(key, typeof value === 'string' ? value : new ctor(value));
    } else {
      this.#map.delete(key);
    }
  }

  #getDateValue(key: string): Date | null {
    let value = this.#map.get(key);
    return value === undefined ? null : new Date(value as string);
  }

  #setDateValue(key: string, value: string | DateInit | undefined | null): void {
    if (value != null) {
      this.#map.set(
        key,
        typeof value === 'string'
          ? value
          : (typeof value === 'number' ? new Date(value) : value).toUTCString(),
      );
    } else {
      this.#map.delete(key);
    }
  }

  #getNumberValue(key: string): number | null {
    let value = this.#map.get(key);
    return value === undefined ? null : parseInt(value as string, 10);
  }

  #setNumberValue(key: string, value: string | number | undefined | null): void {
    if (value != null) {
      this.#map.set(key, typeof value === 'string' ? value : value.toString());
    } else {
      this.#map.delete(key);
    }
  }
}
