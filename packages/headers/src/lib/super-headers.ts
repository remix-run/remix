import { type AcceptInit, Accept } from './accept.ts'
import { type AcceptEncodingInit, AcceptEncoding } from './accept-encoding.ts'
import { type AcceptLanguageInit, AcceptLanguage } from './accept-language.ts'
import { type CacheControlInit, CacheControl } from './cache-control.ts'
import { type ContentDispositionInit, ContentDisposition } from './content-disposition.ts'
import { type ContentRangeInit, ContentRange } from './content-range.ts'
import { type ContentTypeInit, ContentType } from './content-type.ts'
import { type CookieInit, Cookie } from './cookie.ts'
import { canonicalHeaderName } from './header-names.ts'
import { type HeaderValue } from './header-value.ts'
import { type IfMatchInit, IfMatch } from './if-match.ts'
import { type IfNoneMatchInit, IfNoneMatch } from './if-none-match.ts'
import { IfRange } from './if-range.ts'
import { type RangeInit, Range } from './range.ts'
import { type SetCookieInit, SetCookie } from './set-cookie.ts'
import { type VaryInit, Vary } from './vary.ts'
import { isIterable, quoteEtag } from './utils.ts'

type DateInit = number | Date

/**
 * Property-based initializer for `SuperHeaders`.
 */
interface SuperHeadersPropertyInit {
  /**
   * The [`Accept`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Accept) header value.
   */
  accept?: string | AcceptInit
  /**
   * The [`Accept-Encoding`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Accept-Encoding) header value.
   */
  acceptEncoding?: string | AcceptEncodingInit
  /**
   * The [`Accept-Language`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Accept-Language) header value.
   */
  acceptLanguage?: string | AcceptLanguageInit
  /**
   * The [`Accept-Ranges`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Accept-Ranges) header value.
   */
  acceptRanges?: string
  /**
   * The [`Age`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Age) header value.
   */
  age?: string | number
  /**
   * The [`Allow`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Allow) header value.
   */
  allow?: string | string[]
  /**
   * The [`Cache-Control`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control) header value.
   */
  cacheControl?: string | CacheControlInit
  /**
   * The [`Connection`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Connection) header value.
   */
  connection?: string
  /**
   * The [`Content-Disposition`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Disposition) header value.
   */
  contentDisposition?: string | ContentDispositionInit
  /**
   * The [`Content-Encoding`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Encoding) header value.
   */
  contentEncoding?: string | string[]
  /**
   * The [`Content-Language`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Language) header value.
   */
  contentLanguage?: string | string[]
  /**
   * The [`Content-Length`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Length) header value.
   */
  contentLength?: string | number
  /**
   * The [`Content-Range`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Range) header value.
   */
  contentRange?: string | ContentRangeInit
  /**
   * The [`Content-Type`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Type) header value.
   */
  contentType?: string | ContentTypeInit
  /**
   * The [`Cookie`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cookie) header value.
   */
  cookie?: string | CookieInit
  /**
   * The [`Date`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Date) header value.
   */
  date?: string | DateInit
  /**
   * The [`ETag`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/ETag) header value.
   */
  etag?: string
  /**
   * The [`Expires`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Expires) header value.
   */
  expires?: string | DateInit
  /**
   * The [`Host`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Host) header value.
   */
  host?: string
  /**
   * The [`If-Modified-Since`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/If-Modified-Since) header value.
   */
  ifModifiedSince?: string | DateInit
  /**
   * The [`If-Match`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/If-Match) header value.
   */
  ifMatch?: string | string[] | IfMatchInit
  /**
   * The [`If-None-Match`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/If-None-Match) header value.
   */
  ifNoneMatch?: string | string[] | IfNoneMatchInit
  /**
   * The [`If-Range`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/If-Range) header value.
   */
  ifRange?: string | Date
  /**
   * The [`If-Unmodified-Since`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/If-Unmodified-Since) header value.
   */
  ifUnmodifiedSince?: string | DateInit
  /**
   * The [`Last-Modified`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Last-Modified) header value.
   */
  lastModified?: string | DateInit
  /**
   * The [`Location`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Location) header value.
   */
  location?: string
  /**
   * The [`Range`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Range) header value.
   */
  range?: string | RangeInit
  /**
   * The [`Referer`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Referer) header value.
   */
  referer?: string
  /**
   * The [`Set-Cookie`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie) header value(s).
   */
  setCookie?: string | (string | SetCookieInit)[]
  /**
   * The [`Vary`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Vary) header value.
   */
  vary?: string | string[] | VaryInit
}

/**
 * Initializer for `SuperHeaders`.
 */
export type SuperHeadersInit =
  | Iterable<[string, string]>
  | (SuperHeadersPropertyInit & Record<string, string | HeaderValue>)

const CRLF = '\r\n'

const AcceptKey = 'accept'
const AcceptEncodingKey = 'accept-encoding'
const AcceptLanguageKey = 'accept-language'
const AcceptRangesKey = 'accept-ranges'
const AgeKey = 'age'
const AllowKey = 'allow'
const CacheControlKey = 'cache-control'
const ConnectionKey = 'connection'
const ContentDispositionKey = 'content-disposition'
const ContentEncodingKey = 'content-encoding'
const ContentLanguageKey = 'content-language'
const ContentLengthKey = 'content-length'
const ContentRangeKey = 'content-range'
const ContentTypeKey = 'content-type'
const CookieKey = 'cookie'
const DateKey = 'date'
const ETagKey = 'etag'
const ExpiresKey = 'expires'
const HostKey = 'host'
const IfMatchKey = 'if-match'
const IfModifiedSinceKey = 'if-modified-since'
const IfNoneMatchKey = 'if-none-match'
const IfRangeKey = 'if-range'
const IfUnmodifiedSinceKey = 'if-unmodified-since'
const LastModifiedKey = 'last-modified'
const LocationKey = 'location'
const RangeKey = 'range'
const RefererKey = 'referer'
const SetCookieKey = 'set-cookie'
const VaryKey = 'vary'

/**
 * An enhanced JavaScript `Headers` interface with type-safe access.
 *
 * [API Reference](https://github.com/remix-run/remix/tree/main/packages/headers)
 *
 * [MDN `Headers` Base Class Reference](https://developer.mozilla.org/en-US/docs/Web/API/Headers)
 */
export class SuperHeaders extends Headers {
  #map: Map<string, string | HeaderValue>
  #setCookies: (string | SetCookie)[] = []

  /**
   * @param init A string, iterable, object, or `Headers` instance to initialize with
   */
  constructor(init?: string | SuperHeadersInit | Headers) {
    super()

    this.#map = new Map()

    if (init) {
      if (typeof init === 'string') {
        let lines = init.split(CRLF)
        for (let line of lines) {
          let match = line.match(/^([^:]+):(.*)/)
          if (match) {
            this.append(match[1].trim(), match[2].trim())
          }
        }
      } else if (isIterable(init)) {
        for (let [name, value] of init) {
          this.append(name, value)
        }
      } else if (typeof init === 'object') {
        for (let name of Object.getOwnPropertyNames(init)) {
          let value = init[name]

          let descriptor = Object.getOwnPropertyDescriptor(SuperHeaders.prototype, name)
          if (descriptor?.set) {
            descriptor.set.call(this, value)
          } else {
            this.set(name, value.toString())
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
   *
   * @param name The name of the header to append to
   * @param value The value to append
   */
  append(name: string, value: string): void {
    let key = name.toLowerCase()
    if (key === SetCookieKey) {
      this.#setCookies.push(value)
    } else {
      let existingValue = this.#map.get(key)
      this.#map.set(key, existingValue ? `${existingValue}, ${value}` : value)
    }
  }

  /**
   * Removes a header.
   *
   * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/Headers/delete)
   *
   * @param name The name of the header to delete
   */
  delete(name: string): void {
    let key = name.toLowerCase()
    if (key === SetCookieKey) {
      this.#setCookies = []
    } else {
      this.#map.delete(key)
    }
  }

  /**
   * Returns a string of all the values for a header, or `null` if the header does not exist.
   *
   * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/Headers/get)
   *
   * @param name The name of the header to get
   * @returns The header value, or `null` if not found
   */
  get(name: string): string | null {
    let key = name.toLowerCase()
    if (key === SetCookieKey) {
      return this.getSetCookie().join(', ')
    } else {
      let value = this.#map.get(key)
      if (typeof value === 'string') {
        return value
      } else if (value != null) {
        let str = value.toString()
        return str === '' ? null : str
      } else {
        return null
      }
    }
  }

  /**
   * Returns an array of all values associated with the `Set-Cookie` header. This is
   * useful when building headers for a HTTP response since multiple `Set-Cookie` headers
   * must be sent on separate lines.
   *
   * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/Headers/getSetCookie)
   *
   * @returns An array of `Set-Cookie` header values
   */
  getSetCookie(): string[] {
    return this.#setCookies.map((v) => (typeof v === 'string' ? v : v.toString()))
  }

  /**
   * Returns `true` if the header is present in the list of headers.
   *
   * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/Headers/has)
   *
   * @param name The name of the header to check
   * @returns `true` if the header is present, `false` otherwise
   */
  has(name: string): boolean {
    let key = name.toLowerCase()
    return key === SetCookieKey ? this.#setCookies.length > 0 : this.get(key) != null
  }

  /**
   * Sets a new value for the given header. If the header already exists, the new value
   * will replace the existing value.
   *
   * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/Headers/set)
   *
   * @param name The name of the header to set
   * @param value The value to set
   */
  set(name: string, value: string): void {
    let key = name.toLowerCase()
    if (key === SetCookieKey) {
      this.#setCookies = [value]
    } else {
      this.#map.set(key, value)
    }
  }

  /**
   * Returns an iterator of all header keys (lowercase).
   *
   * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/Headers/keys)
   *
   * @returns An iterator of header keys
   */
  *keys(): HeadersIterator<string> {
    for (let [key] of this) yield key
  }

  /**
   * Returns an iterator of all header values.
   *
   * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/Headers/values)
   *
   * @returns An iterator of header values
   */
  *values(): HeadersIterator<string> {
    for (let [, value] of this) yield value
  }

  /**
   * Returns an iterator of all header key/value pairs.
   *
   * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/Headers/entries)
   *
   * @returns An iterator of `[key, value]` tuples
   */
  *entries(): HeadersIterator<[string, string]> {
    for (let [key] of this.#map) {
      let str = this.get(key)
      if (str) yield [key, str]
    }

    for (let value of this.getSetCookie()) {
      yield [SetCookieKey, value]
    }
  }

  [Symbol.iterator](): HeadersIterator<[string, string]> {
    return this.entries()
  }

  /**
   * Invokes the `callback` for each header key/value pair.
   *
   * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/Headers/forEach)
   *
   * @param callback The function to call for each pair
   * @param thisArg The value to use as `this` when calling the callback
   */
  forEach(callback: (value: string, key: string, parent: Headers) => void, thisArg?: any): void {
    for (let [key, value] of this) {
      callback.call(thisArg, value, key, this)
    }
  }

  /**
   * Returns a string representation of the headers suitable for use in a HTTP message.
   *
   * @returns The headers formatted for HTTP
   */
  toString(): string {
    let lines: string[] = []

    for (let [key, value] of this) {
      lines.push(`${canonicalHeaderName(key)}: ${value}`)
    }

    return lines.join(CRLF)
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
    return this.#getHeaderValue(AcceptKey, Accept)
  }

  set accept(value: string | AcceptInit | undefined | null) {
    this.#setHeaderValue(AcceptKey, Accept, value)
  }

  /**
   * The `Accept-Encoding` header contains information about the content encodings that the client
   * is willing to accept in the response.
   *
   * [MDN `Accept-Encoding` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Accept-Encoding)
   *
   * [HTTP/1.1 Specification](https://datatracker.ietf.org/doc/html/rfc7231#section-5.3.4)
   */
  get acceptEncoding(): AcceptEncoding {
    return this.#getHeaderValue(AcceptEncodingKey, AcceptEncoding)
  }

  set acceptEncoding(value: string | AcceptEncodingInit | undefined | null) {
    this.#setHeaderValue(AcceptEncodingKey, AcceptEncoding, value)
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
    return this.#getHeaderValue(AcceptLanguageKey, AcceptLanguage)
  }

  set acceptLanguage(value: string | AcceptLanguageInit | undefined | null) {
    this.#setHeaderValue(AcceptLanguageKey, AcceptLanguage, value)
  }

  /**
   * The `Accept-Ranges` header indicates the server's acceptance of range requests.
   *
   * [MDN `Accept-Ranges` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Accept-Ranges)
   *
   * [HTTP/1.1 Specification](https://datatracker.ietf.org/doc/html/rfc7233#section-2.3)
   */
  get acceptRanges(): string | null {
    return this.#getStringValue(AcceptRangesKey)
  }

  set acceptRanges(value: string | undefined | null) {
    this.#setStringValue(AcceptRangesKey, value)
  }

  /**
   * The `Age` header contains the time in seconds an object was in a proxy cache.
   *
   * [MDN `Age` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Age)
   *
   * [HTTP/1.1 Specification](https://datatracker.ietf.org/doc/html/rfc7234#section-5.1)
   */
  get age(): number | null {
    return this.#getNumberValue(AgeKey)
  }

  set age(value: string | number | undefined | null) {
    this.#setNumberValue(AgeKey, value)
  }

  /**
   * The `Allow` header lists the HTTP methods that are supported by the resource.
   *
   * [MDN `Allow` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Allow)
   *
   * [HTTP/1.1 Specification](https://httpwg.org/specs/rfc9110.html#field.allow)
   */
  get allow(): string | null {
    return this.#getStringValue(AllowKey)
  }

  set allow(value: string | string[] | undefined | null) {
    this.#setStringValue(AllowKey, Array.isArray(value) ? value.join(', ') : value)
  }

  /**
   * The `Cache-Control` header contains directives for caching mechanisms in both requests and responses.
   *
   * [MDN `Cache-Control` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control)
   *
   * [HTTP/1.1 Specification](https://datatracker.ietf.org/doc/html/rfc7234#section-5.2)
   */
  get cacheControl(): CacheControl {
    return this.#getHeaderValue(CacheControlKey, CacheControl)
  }

  set cacheControl(value: string | CacheControlInit | undefined | null) {
    this.#setHeaderValue(CacheControlKey, CacheControl, value)
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
    return this.#getStringValue(ConnectionKey)
  }

  set connection(value: string | undefined | null) {
    this.#setStringValue(ConnectionKey, value)
  }

  /**
   * The `Content-Disposition` header is a response-type header that describes how the payload is displayed.
   *
   * [MDN `Content-Disposition` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Disposition)
   *
   * [RFC 6266](https://datatracker.ietf.org/doc/html/rfc6266)
   */
  get contentDisposition(): ContentDisposition {
    return this.#getHeaderValue(ContentDispositionKey, ContentDisposition)
  }

  set contentDisposition(value: string | ContentDispositionInit | undefined | null) {
    this.#setHeaderValue(ContentDispositionKey, ContentDisposition, value)
  }

  /**
   * The `Content-Encoding` header specifies the encoding of the resource.
   *
   * Note: If multiple encodings have been used, this value may be a comma-separated list. However, most often this
   * header will only contain a single value.
   *
   * [MDN `Content-Encoding` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Encoding)
   *
   * [HTTP/1.1 Specification](https://httpwg.org/specs/rfc9110.html#field.content-encoding)
   */
  get contentEncoding(): string | null {
    return this.#getStringValue(ContentEncodingKey)
  }

  set contentEncoding(value: string | string[] | undefined | null) {
    this.#setStringValue(ContentEncodingKey, Array.isArray(value) ? value.join(', ') : value)
  }

  /**
   * The `Content-Language` header describes the natural language(s) of the intended audience for the response content.
   *
   * Note: If the response content is intended for multiple audiences, this value may be a comma-separated list. However,
   * most often this header will only contain a single value.
   *
   * [MDN `Content-Language` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Language)
   *
   * [HTTP/1.1 Specification](https://httpwg.org/specs/rfc9110.html#field.content-language)
   */
  get contentLanguage(): string | null {
    return this.#getStringValue(ContentLanguageKey)
  }

  set contentLanguage(value: string | string[] | undefined | null) {
    this.#setStringValue(ContentLanguageKey, Array.isArray(value) ? value.join(', ') : value)
  }

  /**
   * The `Content-Length` header indicates the size of the entity-body in bytes.
   *
   * [MDN `Content-Length` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Length)
   *
   * [HTTP/1.1 Specification](https://datatracker.ietf.org/doc/html/rfc7230#section-3.3.2)
   */
  get contentLength(): number | null {
    return this.#getNumberValue(ContentLengthKey)
  }

  set contentLength(value: string | number | undefined | null) {
    this.#setNumberValue(ContentLengthKey, value)
  }

  /**
   * The `Content-Range` header indicates where the content of a response body
   * belongs in relation to a complete resource.
   *
   * [MDN `Content-Range` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Range)
   *
   * [HTTP/1.1 Specification](https://httpwg.org/specs/rfc9110.html#field.content-range)
   */
  get contentRange(): ContentRange {
    return this.#getHeaderValue(ContentRangeKey, ContentRange)
  }

  set contentRange(value: string | ContentRangeInit | undefined | null) {
    this.#setHeaderValue(ContentRangeKey, ContentRange, value)
  }

  /**
   * The `Content-Type` header indicates the media type of the resource.
   *
   * [MDN `Content-Type` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Type)
   *
   * [HTTP/1.1 Specification](https://datatracker.ietf.org/doc/html/rfc7231#section-3.1.1.5)
   */
  get contentType(): ContentType {
    return this.#getHeaderValue(ContentTypeKey, ContentType)
  }

  set contentType(value: string | ContentTypeInit | undefined | null) {
    this.#setHeaderValue(ContentTypeKey, ContentType, value)
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
    return this.#getHeaderValue(CookieKey, Cookie)
  }

  set cookie(value: string | CookieInit | undefined | null) {
    this.#setHeaderValue(CookieKey, Cookie, value)
  }

  /**
   * The `Date` header contains the date and time at which the message was sent.
   *
   * [MDN `Date` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Date)
   *
   * [HTTP/1.1 Specification](https://datatracker.ietf.org/doc/html/rfc7231#section-7.1.1.2)
   */
  get date(): Date | null {
    return this.#getDateValue(DateKey)
  }

  set date(value: string | DateInit | undefined | null) {
    this.#setDateValue(DateKey, value)
  }

  /**
   * The `ETag` header provides a unique identifier for the current version of the resource.
   *
   * [MDN `ETag` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/ETag)
   *
   * [HTTP/1.1 Specification](https://datatracker.ietf.org/doc/html/rfc7232#section-2.3)
   */
  get etag(): string | null {
    return this.#getStringValue(ETagKey)
  }

  set etag(value: string | undefined | null) {
    this.#setStringValue(ETagKey, typeof value === 'string' ? quoteEtag(value) : value)
  }

  /**
   * The `Expires` header contains the date/time after which the response is considered stale.
   *
   * [MDN `Expires` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Expires)
   *
   * [HTTP/1.1 Specification](https://datatracker.ietf.org/doc/html/rfc7234#section-5.3)
   */
  get expires(): Date | null {
    return this.#getDateValue(ExpiresKey)
  }

  set expires(value: string | DateInit | undefined | null) {
    this.#setDateValue(ExpiresKey, value)
  }

  /**
   * The `Host` header specifies the domain name of the server and (optionally) the TCP port number.
   *
   * [MDN `Host` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Host)
   *
   * [HTTP/1.1 Specification](https://datatracker.ietf.org/doc/html/rfc7230#section-5.4)
   */
  get host(): string | null {
    return this.#getStringValue(HostKey)
  }

  set host(value: string | undefined | null) {
    this.#setStringValue(HostKey, value)
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
    return this.#getDateValue(IfModifiedSinceKey)
  }

  set ifModifiedSince(value: string | DateInit | undefined | null) {
    this.#setDateValue(IfModifiedSinceKey, value)
  }

  /**
   * The `If-Match` header makes a request conditional on the presence of a matching ETag.
   *
   * [MDN `If-Match` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/If-Match)
   *
   * [HTTP/1.1 Specification](https://datatracker.ietf.org/doc/html/rfc7232#section-3.1)
   */
  get ifMatch(): IfMatch {
    return this.#getHeaderValue(IfMatchKey, IfMatch)
  }

  set ifMatch(value: string | string[] | IfMatchInit | undefined | null) {
    this.#setHeaderValue(IfMatchKey, IfMatch, value)
  }

  /**
   * The `If-None-Match` header makes a request conditional on the absence of a matching ETag.
   *
   * [MDN `If-None-Match` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/If-None-Match)
   *
   * [HTTP/1.1 Specification](https://datatracker.ietf.org/doc/html/rfc7232#section-3.2)
   */
  get ifNoneMatch(): IfNoneMatch {
    return this.#getHeaderValue(IfNoneMatchKey, IfNoneMatch)
  }

  set ifNoneMatch(value: string | string[] | IfNoneMatchInit | undefined | null) {
    this.#setHeaderValue(IfNoneMatchKey, IfNoneMatch, value)
  }

  /**
   * The `If-Range` header makes a range request conditional on the resource state.
   * Can contain either an entity tag (ETag) or an HTTP date.
   *
   * [MDN `If-Range` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/If-Range)
   *
   * [HTTP/1.1 Specification](https://datatracker.ietf.org/doc/html/rfc7233#section-3.2)
   */
  get ifRange(): IfRange {
    return this.#getHeaderValue(IfRangeKey, IfRange)
  }

  set ifRange(value: string | Date | undefined | null) {
    this.#setHeaderValue(IfRangeKey, IfRange, value)
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
    return this.#getDateValue(IfUnmodifiedSinceKey)
  }

  set ifUnmodifiedSince(value: string | DateInit | undefined | null) {
    this.#setDateValue(IfUnmodifiedSinceKey, value)
  }

  /**
   * The `Last-Modified` header contains the date and time at which the resource was last modified.
   *
   * [MDN `Last-Modified` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Last-Modified)
   *
   * [HTTP/1.1 Specification](https://datatracker.ietf.org/doc/html/rfc7232#section-2.2)
   */
  get lastModified(): Date | null {
    return this.#getDateValue(LastModifiedKey)
  }

  set lastModified(value: string | DateInit | undefined | null) {
    this.#setDateValue(LastModifiedKey, value)
  }

  /**
   * The `Location` header indicates the URL to redirect to.
   *
   * [MDN `Location` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Location)
   *
   * [HTTP/1.1 Specification](https://datatracker.ietf.org/doc/html/rfc7231#section-7.1.2)
   */
  get location(): string | null {
    return this.#getStringValue(LocationKey)
  }

  set location(value: string | undefined | null) {
    this.#setStringValue(LocationKey, value)
  }

  /**
   * The `Range` header indicates the part of a resource that the client wants to receive.
   *
   * [MDN `Range` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Range)
   *
   * [HTTP/1.1 Specification](https://httpwg.org/specs/rfc9110.html#field.range)
   */
  get range(): Range {
    return this.#getHeaderValue(RangeKey, Range)
  }

  set range(value: string | RangeInit | undefined | null) {
    this.#setHeaderValue(RangeKey, Range, value)
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
    return this.#getStringValue(RefererKey)
  }

  set referer(value: string | undefined | null) {
    this.#setStringValue(RefererKey, value)
  }

  /**
   * The `Set-Cookie` header is used to send cookies from the server to the user agent.
   *
   * [MDN `Set-Cookie` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie)
   *
   * [HTTP/1.1 Specification](https://datatracker.ietf.org/doc/html/rfc6265#section-4.1)
   */
  get setCookie(): SetCookie[] {
    let setCookies = this.#setCookies

    for (let i = 0; i < setCookies.length; ++i) {
      if (typeof setCookies[i] === 'string') {
        setCookies[i] = new SetCookie(setCookies[i])
      }
    }

    return setCookies as SetCookie[]
  }

  set setCookie(value: (string | SetCookieInit)[] | string | SetCookieInit | undefined | null) {
    if (value != null) {
      this.#setCookies = (Array.isArray(value) ? value : [value]).map((v) =>
        typeof v === 'string' ? v : new SetCookie(v),
      )
    } else {
      this.#setCookies = []
    }
  }

  /**
   * The `Vary` header indicates the set of request headers that determine whether
   * a cached response can be used rather than requesting a fresh response from the origin server.
   *
   * Common values include `Accept-Encoding`, `Accept-Language`, `Accept`, `User-Agent`, etc.
   *
   * [MDN `Vary` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Vary)
   *
   * [HTTP/1.1 Specification](https://httpwg.org/specs/rfc9110.html#field.vary)
   */
  get vary(): Vary {
    return this.#getHeaderValue(VaryKey, Vary)
  }

  set vary(value: string | string[] | VaryInit | undefined | null) {
    this.#setHeaderValue(VaryKey, Vary, value)
  }

  // Helpers

  #getHeaderValue<T extends HeaderValue>(key: string, ctor: new (init?: any) => T): T {
    let value = this.#map.get(key)

    if (value !== undefined) {
      if (typeof value === 'string') {
        let obj = new ctor(value)
        this.#map.set(key, obj) // cache the new object
        return obj
      } else {
        return value as T
      }
    }

    let obj = new ctor()
    this.#map.set(key, obj) // cache the new object
    return obj
  }

  #setHeaderValue(key: string, ctor: new (init?: string) => HeaderValue, value: any): void {
    if (value != null) {
      this.#map.set(key, typeof value === 'string' ? value : new ctor(value))
    } else {
      this.#map.delete(key)
    }
  }

  #getDateValue(key: string): Date | null {
    let value = this.#map.get(key)
    return value === undefined ? null : new Date(value as string)
  }

  #setDateValue(key: string, value: string | DateInit | undefined | null): void {
    if (value != null) {
      this.#map.set(
        key,
        typeof value === 'string'
          ? value
          : (typeof value === 'number' ? new Date(value) : value).toUTCString(),
      )
    } else {
      this.#map.delete(key)
    }
  }

  #getNumberValue(key: string): number | null {
    let value = this.#map.get(key)
    return value === undefined ? null : parseInt(value as string, 10)
  }

  #setNumberValue(key: string, value: string | number | undefined | null): void {
    if (value != null) {
      this.#map.set(key, typeof value === 'string' ? value : value.toString())
    } else {
      this.#map.delete(key)
    }
  }

  #getStringValue(key: string): string | null {
    let value = this.#map.get(key)
    return value === undefined ? null : (value as string)
  }

  #setStringValue(key: string, value: string | undefined | null): void {
    if (value != null) {
      this.#map.set(key, value)
    } else {
      this.#map.delete(key)
    }
  }
}
