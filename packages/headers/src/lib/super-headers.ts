import { type AcceptInit, Accept } from './accept.ts'
import { type AcceptEncodingInit, AcceptEncoding } from './accept-encoding.ts'
import { type AcceptLanguageInit, AcceptLanguage } from './accept-language.ts'
import { type CacheControlInit, CacheControl } from './cache-control.ts'
import { type ContentDispositionInit, ContentDisposition } from './content-disposition.ts'
import { type ContentRangeInit, ContentRange } from './content-range.ts'
import { type ContentTypeInit, ContentType } from './content-type.ts'
import { type CookieInit, Cookie } from './cookie.ts'
import { type HeaderValue } from './header-value.ts'
import { type IfMatchInit, IfMatch } from './if-match.ts'
import { type IfNoneMatchInit, IfNoneMatch } from './if-none-match.ts'
import { IfRange } from './if-range.ts'
import { type RangeInit, Range } from './range.ts'
import { type SetCookieInit, SetCookie } from './set-cookie.ts'
import { type VaryInit, Vary } from './vary.ts'
import { isIterable, quoteEtag } from './utils.ts'

type DateInit = number | Date
type StringInit = string | readonly string[]
type SetCookieValue = string | SetCookieInit
type SetCookieList = SetCookie[] & {
  push(...items: SetCookieValue[]): number
  splice(start: number, deleteCount?: number, ...items: SetCookieValue[]): SetCookie[]
  unshift(...items: SetCookieValue[]): number
}

/**
 * Property-based initializer for {@link SuperHeaders}.
 */
export interface SuperHeadersPropertyInit {
  accept?: string | AcceptInit | null
  acceptCharset?: StringInit | null
  acceptEncoding?: string | AcceptEncodingInit | null
  acceptLanguage?: string | AcceptLanguageInit | null
  acceptPatch?: StringInit | null
  acceptPost?: StringInit | null
  acceptRanges?: StringInit | null
  accessControlAllowCredentials?: string | null
  accessControlAllowHeaders?: StringInit | null
  accessControlAllowMethods?: StringInit | null
  accessControlAllowOrigin?: string | null
  accessControlExposeHeaders?: StringInit | null
  accessControlMaxAge?: string | number | null
  accessControlRequestHeaders?: StringInit | null
  accessControlRequestMethod?: string | null
  age?: string | number | null
  allow?: StringInit | null
  altSvc?: string | null
  authorization?: string | null
  cacheControl?: string | CacheControlInit | null
  cdnCacheControl?: StringInit | null
  clearSiteData?: StringInit | null
  connection?: StringInit | null
  contentDisposition?: string | ContentDispositionInit | null
  contentEncoding?: StringInit | null
  contentLanguage?: StringInit | null
  contentLength?: string | number | null
  contentLocation?: string | null
  contentRange?: string | ContentRangeInit | null
  contentSecurityPolicy?: string | null
  contentSecurityPolicyReportOnly?: string | null
  contentType?: string | ContentTypeInit | null
  cookie?: string | CookieInit | null
  crossOriginEmbedderPolicy?: string | null
  crossOriginOpenerPolicy?: string | null
  crossOriginResourcePolicy?: string | null
  date?: string | DateInit | null
  deviceMemory?: string | number | null
  digest?: string | null
  dnt?: string | null
  earlyData?: string | number | null
  etag?: string | null
  expect?: string | null
  expectCt?: string | null
  expires?: string | DateInit | null
  forwarded?: string | null
  from?: string | null
  host?: string | null
  ifMatch?: string | string[] | IfMatchInit | null
  ifModifiedSince?: string | DateInit | null
  ifNoneMatch?: string | string[] | IfNoneMatchInit | null
  ifRange?: string | Date | null
  ifUnmodifiedSince?: string | DateInit | null
  keepAlive?: string | null
  lastModified?: string | DateInit | null
  link?: StringInit | null
  location?: string | null
  maxForwards?: string | number | null
  nel?: string | null
  origin?: string | null
  originAgentCluster?: string | null
  pragma?: StringInit | null
  priority?: string | null
  proxyAuthenticate?: StringInit | null
  proxyAuthorization?: string | null
  range?: string | RangeInit | null
  referer?: string | null
  referrerPolicy?: string | null
  refresh?: string | null
  retryAfter?: string | null
  secFetchDest?: string | null
  secFetchMode?: string | null
  secFetchSite?: string | null
  secFetchUser?: string | null
  secWebSocketAccept?: string | null
  secWebSocketExtensions?: StringInit | null
  secWebSocketKey?: string | null
  secWebSocketProtocol?: StringInit | null
  secWebSocketVersion?: string | number | null
  server?: string | null
  serverTiming?: StringInit | null
  serviceWorkerAllowed?: string | null
  setCookie?: SetCookieValue | readonly SetCookieValue[] | null
  sourcemap?: string | null
  strictTransportSecurity?: string | null
  te?: StringInit | null
  timingAllowOrigin?: StringInit | null
  trailer?: StringInit | null
  transferEncoding?: StringInit | null
  upgrade?: StringInit | null
  upgradeInsecureRequests?: string | number | null
  userAgent?: string | null
  vary?: string | string[] | VaryInit | null
  via?: StringInit | null
  wantDigest?: StringInit | null
  wwwAuthenticate?: StringInit | null
  xContentTypeOptions?: string | null
  xDnsPrefetchControl?: string | null
  xFrameOptions?: string | null
  xPermittedCrossDomainPolicies?: string | null
  xPoweredBy?: string | null
  xRequestedWith?: string | null
  xRobotsTag?: StringInit | null
  xXssProtection?: string | null
}

/**
 * Initializer for {@link SuperHeaders}.
 */
export type SuperHeadersInit =
  | Headers
  | Iterable<[string, string]>
  | (SuperHeadersPropertyInit & Record<string, unknown>)

interface ObjectHeaderDescriptor {
  kind: 'object'
  property: string
  name: string
  from(value: unknown): HeaderValue
  mutatingMethods: ReadonlySet<string>
}

interface StringHeaderDescriptor {
  kind: 'string'
  property: string
  name: string
  list: boolean
  transform?(value: string): string
}

interface NumberHeaderDescriptor {
  kind: 'number'
  property: string
  name: string
}

interface DateHeaderDescriptor {
  kind: 'date'
  property: string
  name: string
}

interface SetCookieHeaderDescriptor {
  kind: 'set-cookie'
  property: 'setCookie'
  name: 'Set-Cookie'
}

type HeaderDescriptor =
  | ObjectHeaderDescriptor
  | StringHeaderDescriptor
  | NumberHeaderDescriptor
  | DateHeaderDescriptor
  | SetCookieHeaderDescriptor

interface CachedHeaderValue {
  raw: string | null
  revision: number
  value: HeaderValue
}

interface CachedSetCookieValue {
  raw: readonly string[]
  revision: number
  value: SetCookieList
}

type OnChange = () => void

const SetCookieKey = 'set-cookie'

const ArrayMutatingMethods = new Set([
  'copyWithin',
  'fill',
  'pop',
  'push',
  'reverse',
  'shift',
  'sort',
  'splice',
  'unshift',
])

const ObjectHeaderDescriptors: readonly ObjectHeaderDescriptor[] = [
  objectHeader<AcceptInit, Accept>('accept', 'Accept', (value) => Accept.from(value), [
    'clear',
    'delete',
    'set',
  ]),
  objectHeader<AcceptEncodingInit, AcceptEncoding>(
    'acceptEncoding',
    'Accept-Encoding',
    (value) => AcceptEncoding.from(value),
    ['clear', 'delete', 'set'],
  ),
  objectHeader<AcceptLanguageInit, AcceptLanguage>(
    'acceptLanguage',
    'Accept-Language',
    (value) => AcceptLanguage.from(value),
    ['clear', 'delete', 'set'],
  ),
  objectHeader<CacheControlInit, CacheControl>('cacheControl', 'Cache-Control', (value) =>
    CacheControl.from(value),
  ),
  objectHeader<ContentDispositionInit, ContentDisposition>(
    'contentDisposition',
    'Content-Disposition',
    (value) => ContentDisposition.from(value),
  ),
  objectHeader<ContentRangeInit, ContentRange>('contentRange', 'Content-Range', (value) =>
    ContentRange.from(value),
  ),
  objectHeader<ContentTypeInit, ContentType>('contentType', 'Content-Type', (value) =>
    ContentType.from(value),
  ),
  objectHeader<CookieInit, Cookie>('cookie', 'Cookie', (value) => Cookie.from(value), [
    'clear',
    'delete',
    'set',
  ]),
  objectHeader<string[] | IfMatchInit, IfMatch>('ifMatch', 'If-Match', (value) =>
    IfMatch.from(value),
  ),
  objectHeader<string[] | IfNoneMatchInit, IfNoneMatch>('ifNoneMatch', 'If-None-Match', (value) =>
    IfNoneMatch.from(value),
  ),
  objectHeader<Date, IfRange>('ifRange', 'If-Range', (value) => IfRange.from(value)),
  objectHeader<RangeInit, Range>('range', 'Range', (value) => Range.from(value)),
  objectHeader<string[] | VaryInit, Vary>('vary', 'Vary', (value) => Vary.from(value), [
    'add',
    'clear',
    'delete',
  ]),
]

const StringHeaderDescriptors: readonly StringHeaderDescriptor[] = [
  stringHeader('acceptCharset', 'Accept-Charset', true),
  stringHeader('acceptPatch', 'Accept-Patch', true),
  stringHeader('acceptPost', 'Accept-Post', true),
  stringHeader('acceptRanges', 'Accept-Ranges', true),
  stringHeader('accessControlAllowCredentials', 'Access-Control-Allow-Credentials'),
  stringHeader('accessControlAllowHeaders', 'Access-Control-Allow-Headers', true),
  stringHeader('accessControlAllowMethods', 'Access-Control-Allow-Methods', true),
  stringHeader('accessControlAllowOrigin', 'Access-Control-Allow-Origin'),
  stringHeader('accessControlExposeHeaders', 'Access-Control-Expose-Headers', true),
  stringHeader('accessControlRequestHeaders', 'Access-Control-Request-Headers', true),
  stringHeader('accessControlRequestMethod', 'Access-Control-Request-Method'),
  stringHeader('allow', 'Allow', true),
  stringHeader('altSvc', 'Alt-Svc'),
  stringHeader('authorization', 'Authorization'),
  stringHeader('cdnCacheControl', 'CDN-Cache-Control', true),
  stringHeader('clearSiteData', 'Clear-Site-Data', true),
  stringHeader('connection', 'Connection', true),
  stringHeader('contentEncoding', 'Content-Encoding', true),
  stringHeader('contentLanguage', 'Content-Language', true),
  stringHeader('contentLocation', 'Content-Location'),
  stringHeader('contentSecurityPolicy', 'Content-Security-Policy'),
  stringHeader('contentSecurityPolicyReportOnly', 'Content-Security-Policy-Report-Only'),
  stringHeader('crossOriginEmbedderPolicy', 'Cross-Origin-Embedder-Policy'),
  stringHeader('crossOriginOpenerPolicy', 'Cross-Origin-Opener-Policy'),
  stringHeader('crossOriginResourcePolicy', 'Cross-Origin-Resource-Policy'),
  stringHeader('digest', 'Digest'),
  stringHeader('dnt', 'DNT'),
  stringHeader('etag', 'ETag', false, quoteEtag),
  stringHeader('expect', 'Expect'),
  stringHeader('expectCt', 'Expect-CT'),
  stringHeader('forwarded', 'Forwarded'),
  stringHeader('from', 'From'),
  stringHeader('host', 'Host'),
  stringHeader('keepAlive', 'Keep-Alive'),
  stringHeader('link', 'Link', true),
  stringHeader('location', 'Location'),
  stringHeader('nel', 'NEL'),
  stringHeader('origin', 'Origin'),
  stringHeader('originAgentCluster', 'Origin-Agent-Cluster'),
  stringHeader('pragma', 'Pragma', true),
  stringHeader('priority', 'Priority'),
  stringHeader('proxyAuthenticate', 'Proxy-Authenticate', true),
  stringHeader('proxyAuthorization', 'Proxy-Authorization'),
  stringHeader('referer', 'Referer'),
  stringHeader('referrerPolicy', 'Referrer-Policy'),
  stringHeader('refresh', 'Refresh'),
  stringHeader('retryAfter', 'Retry-After'),
  stringHeader('secFetchDest', 'Sec-Fetch-Dest'),
  stringHeader('secFetchMode', 'Sec-Fetch-Mode'),
  stringHeader('secFetchSite', 'Sec-Fetch-Site'),
  stringHeader('secFetchUser', 'Sec-Fetch-User'),
  stringHeader('secWebSocketAccept', 'Sec-WebSocket-Accept'),
  stringHeader('secWebSocketExtensions', 'Sec-WebSocket-Extensions', true),
  stringHeader('secWebSocketKey', 'Sec-WebSocket-Key'),
  stringHeader('secWebSocketProtocol', 'Sec-WebSocket-Protocol', true),
  stringHeader('server', 'Server'),
  stringHeader('serverTiming', 'Server-Timing', true),
  stringHeader('serviceWorkerAllowed', 'Service-Worker-Allowed'),
  stringHeader('sourcemap', 'Sourcemap'),
  stringHeader('strictTransportSecurity', 'Strict-Transport-Security'),
  stringHeader('te', 'TE', true),
  stringHeader('timingAllowOrigin', 'Timing-Allow-Origin', true),
  stringHeader('trailer', 'Trailer', true),
  stringHeader('transferEncoding', 'Transfer-Encoding', true),
  stringHeader('upgrade', 'Upgrade', true),
  stringHeader('userAgent', 'User-Agent'),
  stringHeader('via', 'Via', true),
  stringHeader('wantDigest', 'Want-Digest', true),
  stringHeader('wwwAuthenticate', 'WWW-Authenticate', true),
  stringHeader('xContentTypeOptions', 'X-Content-Type-Options'),
  stringHeader('xDnsPrefetchControl', 'X-DNS-Prefetch-Control'),
  stringHeader('xFrameOptions', 'X-Frame-Options'),
  stringHeader('xPermittedCrossDomainPolicies', 'X-Permitted-Cross-Domain-Policies'),
  stringHeader('xPoweredBy', 'X-Powered-By'),
  stringHeader('xRequestedWith', 'X-Requested-With'),
  stringHeader('xRobotsTag', 'X-Robots-Tag', true),
  stringHeader('xXssProtection', 'X-XSS-Protection'),
]

const NumberHeaderDescriptors: readonly NumberHeaderDescriptor[] = [
  numberHeader('accessControlMaxAge', 'Access-Control-Max-Age'),
  numberHeader('age', 'Age'),
  numberHeader('contentLength', 'Content-Length'),
  numberHeader('deviceMemory', 'Device-Memory'),
  numberHeader('earlyData', 'Early-Data'),
  numberHeader('maxForwards', 'Max-Forwards'),
  numberHeader('secWebSocketVersion', 'Sec-WebSocket-Version'),
  numberHeader('upgradeInsecureRequests', 'Upgrade-Insecure-Requests'),
]

const DateHeaderDescriptors: readonly DateHeaderDescriptor[] = [
  dateHeader('date', 'Date'),
  dateHeader('expires', 'Expires'),
  dateHeader('ifModifiedSince', 'If-Modified-Since'),
  dateHeader('ifUnmodifiedSince', 'If-Unmodified-Since'),
  dateHeader('lastModified', 'Last-Modified'),
]

const SetCookieHeaderDescriptor: SetCookieHeaderDescriptor = {
  kind: 'set-cookie',
  property: 'setCookie',
  name: 'Set-Cookie',
}

const HeaderDescriptors: readonly HeaderDescriptor[] = [
  ...ObjectHeaderDescriptors,
  ...StringHeaderDescriptors,
  ...NumberHeaderDescriptors,
  ...DateHeaderDescriptors,
  SetCookieHeaderDescriptor,
]

const HeaderDescriptorByProperty = new Map(
  HeaderDescriptors.map((descriptor) => [descriptor.property, descriptor]),
)

/**
 * An enhanced JavaScript `Headers` interface with lazy, type-safe property accessors.
 */
export class SuperHeaders extends Headers {
  #cache = new Map<string, CachedHeaderValue>()
  #revisions = new Map<string, number>()
  #setCookieCache: CachedSetCookieValue | undefined

  constructor(init?: SuperHeadersInit) {
    super()

    if (init !== undefined) {
      this.#initialize(init)
    }
  }

  override append(name: string, value: string): void {
    Headers.prototype.append.call(this, name, value)
    this.#invalidate(name)
  }

  override delete(name: string): void {
    Headers.prototype.delete.call(this, name)
    this.#invalidate(name)
  }

  override set(name: string, value: string): void {
    Headers.prototype.set.call(this, name, value)
    this.#invalidate(name)
  }

  #initialize(init: SuperHeadersInit): void {
    if (typeof init === 'string') {
      throw new TypeError('SuperHeaders does not parse raw header strings; use parse() instead')
    }

    if (isIterable<[string, string]>(init)) {
      for (let [name, value] of init) {
        Headers.prototype.append.call(this, name, value)
      }
      return
    }

    for (let name of Object.getOwnPropertyNames(init)) {
      let value = init[name]
      let descriptor = HeaderDescriptorByProperty.get(name)

      if (descriptor) {
        this.#setHeaderDescriptorValue(descriptor, value)
      } else if (value != null) {
        Headers.prototype.set.call(this, name, String(value))
      }
    }
  }

  #getHeaderDescriptorValue(descriptor: HeaderDescriptor): unknown {
    switch (descriptor.kind) {
      case 'object':
        return this.#getObjectHeaderValue(descriptor)
      case 'string':
        return this.#getStringHeaderValue(descriptor)
      case 'number':
        return this.#getNumberHeaderValue(descriptor)
      case 'date':
        return this.#getDateHeaderValue(descriptor)
      case 'set-cookie':
        return this.#getSetCookieHeaderValue()
    }
  }

  #setHeaderDescriptorValue(descriptor: HeaderDescriptor, value: unknown): void {
    switch (descriptor.kind) {
      case 'object':
        this.#setObjectHeaderValue(descriptor, value)
        break
      case 'string':
        this.#setStringHeaderValue(descriptor, value)
        break
      case 'number':
        this.#setNumberHeaderValue(descriptor, value)
        break
      case 'date':
        this.#setDateHeaderValue(descriptor, value)
        break
      case 'set-cookie':
        this.#setSetCookieHeaderValue(value)
        break
    }
  }

  #getObjectHeaderValue(descriptor: ObjectHeaderDescriptor): HeaderValue {
    let key = descriptor.name.toLowerCase()
    let raw = Headers.prototype.get.call(this, descriptor.name)
    let revision = this.#getRevision(key)
    let cached = this.#cache.get(key)

    if (cached && cached.raw === raw && cached.revision === revision) {
      return cached.value
    }

    let value = descriptor.from(raw)
    let observed = observeMutations(value, descriptor.mutatingMethods, () => {
      this.#syncObjectHeaderValue(descriptor, value, revision)
    })

    this.#cache.set(key, {
      raw,
      revision,
      value: observed,
    })

    return observed
  }

  #setObjectHeaderValue(descriptor: ObjectHeaderDescriptor, value: unknown): void {
    if (value == null) {
      Headers.prototype.delete.call(this, descriptor.name)
    } else if (typeof value === 'string') {
      Headers.prototype.set.call(this, descriptor.name, value)
    } else {
      let headerValue = descriptor.from(value)
      let stringValue = headerValue.toString()

      if (stringValue === '') {
        Headers.prototype.delete.call(this, descriptor.name)
      } else {
        Headers.prototype.set.call(this, descriptor.name, stringValue)
      }
    }

    this.#invalidate(descriptor.name)
  }

  #syncObjectHeaderValue(
    descriptor: ObjectHeaderDescriptor,
    value: HeaderValue,
    revision: number,
  ): void {
    let key = descriptor.name.toLowerCase()
    if (this.#getRevision(key) !== revision) return

    let stringValue = value.toString()
    if (stringValue === '') {
      Headers.prototype.delete.call(this, descriptor.name)
    } else {
      Headers.prototype.set.call(this, descriptor.name, stringValue)
    }

    let cached = this.#cache.get(key)
    if (cached?.revision === revision) {
      cached.raw = Headers.prototype.get.call(this, descriptor.name)
    }
  }

  #getStringHeaderValue(descriptor: StringHeaderDescriptor): string | null {
    return Headers.prototype.get.call(this, descriptor.name)
  }

  #setStringHeaderValue(descriptor: StringHeaderDescriptor, value: unknown): void {
    if (value == null) {
      Headers.prototype.delete.call(this, descriptor.name)
    } else {
      let stringValue =
        descriptor.list && Array.isArray(value) ? value.map(String).join(', ') : String(value)
      Headers.prototype.set.call(
        this,
        descriptor.name,
        descriptor.transform ? descriptor.transform(stringValue) : stringValue,
      )
    }

    this.#invalidate(descriptor.name)
  }

  #getNumberHeaderValue(descriptor: NumberHeaderDescriptor): number | null {
    let value = Headers.prototype.get.call(this, descriptor.name)
    return value === null ? null : parseInt(value, 10)
  }

  #setNumberHeaderValue(descriptor: NumberHeaderDescriptor, value: unknown): void {
    if (value == null) {
      Headers.prototype.delete.call(this, descriptor.name)
    } else {
      Headers.prototype.set.call(this, descriptor.name, String(value))
    }

    this.#invalidate(descriptor.name)
  }

  #getDateHeaderValue(descriptor: DateHeaderDescriptor): Date | null {
    let value = Headers.prototype.get.call(this, descriptor.name)
    return value === null ? null : new Date(value)
  }

  #setDateHeaderValue(descriptor: DateHeaderDescriptor, value: unknown): void {
    if (value == null) {
      Headers.prototype.delete.call(this, descriptor.name)
    } else if (typeof value === 'string') {
      Headers.prototype.set.call(this, descriptor.name, value)
    } else {
      let date = typeof value === 'number' ? new Date(value) : value
      if (!(date instanceof Date)) {
        throw new TypeError(
          `${descriptor.property} must be a string, number, Date, null, or undefined`,
        )
      }
      Headers.prototype.set.call(this, descriptor.name, date.toUTCString())
    }

    this.#invalidate(descriptor.name)
  }

  #getSetCookieHeaderValue(): SetCookieList {
    let raw = getNativeSetCookie(this)
    let revision = this.#getRevision(SetCookieKey)
    let cached = this.#setCookieCache

    if (cached && cached.revision === revision && arraysEqual(cached.raw, raw)) {
      return cached.value
    }

    let values = raw.map((value) => SetCookie.from(value))
    let observed = observeMutations(values, new Set(), () => {
      this.#syncSetCookieHeaderValue(values, revision)
    }) as SetCookieList

    this.#setCookieCache = {
      raw,
      revision,
      value: observed,
    }

    return observed
  }

  #setSetCookieHeaderValue(value: unknown): void {
    if (value == null) {
      Headers.prototype.delete.call(this, SetCookieHeaderDescriptor.name)
    } else {
      let values = Array.isArray(value) ? value : [value]
      this.#replaceNativeSetCookie(values.map(stringifySetCookieValue))
    }

    this.#invalidate(SetCookieHeaderDescriptor.name)
  }

  #syncSetCookieHeaderValue(values: SetCookieValue[], revision: number): void {
    if (this.#getRevision(SetCookieKey) !== revision) return

    normalizeSetCookieValues(values)
    this.#replaceNativeSetCookie(values.map(stringifySetCookieValue))

    if (this.#setCookieCache?.revision === revision) {
      this.#setCookieCache.raw = getNativeSetCookie(this)
    }
  }

  #replaceNativeSetCookie(values: readonly string[]): void {
    Headers.prototype.delete.call(this, SetCookieHeaderDescriptor.name)

    for (let value of values) {
      if (value !== '') {
        Headers.prototype.append.call(this, SetCookieHeaderDescriptor.name, value)
      }
    }
  }

  #invalidate(name: string): void {
    let key = name.toLowerCase()
    this.#revisions.set(key, this.#getRevision(key) + 1)
    this.#cache.delete(key)

    if (key === SetCookieKey) {
      this.#setCookieCache = undefined
    }
  }

  #getRevision(key: string): number {
    return this.#revisions.get(key) ?? 0
  }

  static {
    for (let descriptor of HeaderDescriptors) {
      Object.defineProperty(this.prototype, descriptor.property, {
        configurable: true,
        get(this: SuperHeaders) {
          return this.#getHeaderDescriptorValue(descriptor)
        },
        set(this: SuperHeaders, value: unknown) {
          this.#setHeaderDescriptorValue(descriptor, value)
        },
      })
    }
  }
}

export interface SuperHeaders {
  get accept(): Accept
  set accept(value: string | AcceptInit | null | undefined)
  get acceptCharset(): string | null
  set acceptCharset(value: StringInit | null | undefined)
  get acceptEncoding(): AcceptEncoding
  set acceptEncoding(value: string | AcceptEncodingInit | null | undefined)
  get acceptLanguage(): AcceptLanguage
  set acceptLanguage(value: string | AcceptLanguageInit | null | undefined)
  get acceptPatch(): string | null
  set acceptPatch(value: StringInit | null | undefined)
  get acceptPost(): string | null
  set acceptPost(value: StringInit | null | undefined)
  get acceptRanges(): string | null
  set acceptRanges(value: StringInit | null | undefined)
  get accessControlAllowCredentials(): string | null
  set accessControlAllowCredentials(value: string | null | undefined)
  get accessControlAllowHeaders(): string | null
  set accessControlAllowHeaders(value: StringInit | null | undefined)
  get accessControlAllowMethods(): string | null
  set accessControlAllowMethods(value: StringInit | null | undefined)
  get accessControlAllowOrigin(): string | null
  set accessControlAllowOrigin(value: string | null | undefined)
  get accessControlExposeHeaders(): string | null
  set accessControlExposeHeaders(value: StringInit | null | undefined)
  get accessControlMaxAge(): number | null
  set accessControlMaxAge(value: string | number | null | undefined)
  get accessControlRequestHeaders(): string | null
  set accessControlRequestHeaders(value: StringInit | null | undefined)
  get accessControlRequestMethod(): string | null
  set accessControlRequestMethod(value: string | null | undefined)
  get age(): number | null
  set age(value: string | number | null | undefined)
  get allow(): string | null
  set allow(value: StringInit | null | undefined)
  get altSvc(): string | null
  set altSvc(value: string | null | undefined)
  get authorization(): string | null
  set authorization(value: string | null | undefined)
  get cacheControl(): CacheControl
  set cacheControl(value: string | CacheControlInit | null | undefined)
  get cdnCacheControl(): string | null
  set cdnCacheControl(value: StringInit | null | undefined)
  get clearSiteData(): string | null
  set clearSiteData(value: StringInit | null | undefined)
  get connection(): string | null
  set connection(value: StringInit | null | undefined)
  get contentDisposition(): ContentDisposition
  set contentDisposition(value: string | ContentDispositionInit | null | undefined)
  get contentEncoding(): string | null
  set contentEncoding(value: StringInit | null | undefined)
  get contentLanguage(): string | null
  set contentLanguage(value: StringInit | null | undefined)
  get contentLength(): number | null
  set contentLength(value: string | number | null | undefined)
  get contentLocation(): string | null
  set contentLocation(value: string | null | undefined)
  get contentRange(): ContentRange
  set contentRange(value: string | ContentRangeInit | null | undefined)
  get contentSecurityPolicy(): string | null
  set contentSecurityPolicy(value: string | null | undefined)
  get contentSecurityPolicyReportOnly(): string | null
  set contentSecurityPolicyReportOnly(value: string | null | undefined)
  get contentType(): ContentType
  set contentType(value: string | ContentTypeInit | null | undefined)
  get cookie(): Cookie
  set cookie(value: string | CookieInit | null | undefined)
  get crossOriginEmbedderPolicy(): string | null
  set crossOriginEmbedderPolicy(value: string | null | undefined)
  get crossOriginOpenerPolicy(): string | null
  set crossOriginOpenerPolicy(value: string | null | undefined)
  get crossOriginResourcePolicy(): string | null
  set crossOriginResourcePolicy(value: string | null | undefined)
  get date(): Date | null
  set date(value: string | DateInit | null | undefined)
  get deviceMemory(): number | null
  set deviceMemory(value: string | number | null | undefined)
  get digest(): string | null
  set digest(value: string | null | undefined)
  get dnt(): string | null
  set dnt(value: string | null | undefined)
  get earlyData(): number | null
  set earlyData(value: string | number | null | undefined)
  get etag(): string | null
  set etag(value: string | null | undefined)
  get expect(): string | null
  set expect(value: string | null | undefined)
  get expectCt(): string | null
  set expectCt(value: string | null | undefined)
  get expires(): Date | null
  set expires(value: string | DateInit | null | undefined)
  get forwarded(): string | null
  set forwarded(value: string | null | undefined)
  get from(): string | null
  set from(value: string | null | undefined)
  get host(): string | null
  set host(value: string | null | undefined)
  get ifMatch(): IfMatch
  set ifMatch(value: string | string[] | IfMatchInit | null | undefined)
  get ifModifiedSince(): Date | null
  set ifModifiedSince(value: string | DateInit | null | undefined)
  get ifNoneMatch(): IfNoneMatch
  set ifNoneMatch(value: string | string[] | IfNoneMatchInit | null | undefined)
  get ifRange(): IfRange
  set ifRange(value: string | Date | null | undefined)
  get ifUnmodifiedSince(): Date | null
  set ifUnmodifiedSince(value: string | DateInit | null | undefined)
  get keepAlive(): string | null
  set keepAlive(value: string | null | undefined)
  get lastModified(): Date | null
  set lastModified(value: string | DateInit | null | undefined)
  get link(): string | null
  set link(value: StringInit | null | undefined)
  get location(): string | null
  set location(value: string | null | undefined)
  get maxForwards(): number | null
  set maxForwards(value: string | number | null | undefined)
  get nel(): string | null
  set nel(value: string | null | undefined)
  get origin(): string | null
  set origin(value: string | null | undefined)
  get originAgentCluster(): string | null
  set originAgentCluster(value: string | null | undefined)
  get pragma(): string | null
  set pragma(value: StringInit | null | undefined)
  get priority(): string | null
  set priority(value: string | null | undefined)
  get proxyAuthenticate(): string | null
  set proxyAuthenticate(value: StringInit | null | undefined)
  get proxyAuthorization(): string | null
  set proxyAuthorization(value: string | null | undefined)
  get range(): Range
  set range(value: string | RangeInit | null | undefined)
  get referer(): string | null
  set referer(value: string | null | undefined)
  get referrerPolicy(): string | null
  set referrerPolicy(value: string | null | undefined)
  get refresh(): string | null
  set refresh(value: string | null | undefined)
  get retryAfter(): string | null
  set retryAfter(value: string | null | undefined)
  get secFetchDest(): string | null
  set secFetchDest(value: string | null | undefined)
  get secFetchMode(): string | null
  set secFetchMode(value: string | null | undefined)
  get secFetchSite(): string | null
  set secFetchSite(value: string | null | undefined)
  get secFetchUser(): string | null
  set secFetchUser(value: string | null | undefined)
  get secWebSocketAccept(): string | null
  set secWebSocketAccept(value: string | null | undefined)
  get secWebSocketExtensions(): string | null
  set secWebSocketExtensions(value: StringInit | null | undefined)
  get secWebSocketKey(): string | null
  set secWebSocketKey(value: string | null | undefined)
  get secWebSocketProtocol(): string | null
  set secWebSocketProtocol(value: StringInit | null | undefined)
  get secWebSocketVersion(): number | null
  set secWebSocketVersion(value: string | number | null | undefined)
  get server(): string | null
  set server(value: string | null | undefined)
  get serverTiming(): string | null
  set serverTiming(value: StringInit | null | undefined)
  get serviceWorkerAllowed(): string | null
  set serviceWorkerAllowed(value: string | null | undefined)
  get setCookie(): SetCookieList
  set setCookie(value: SetCookieValue | readonly SetCookieValue[] | null | undefined)
  get sourcemap(): string | null
  set sourcemap(value: string | null | undefined)
  get strictTransportSecurity(): string | null
  set strictTransportSecurity(value: string | null | undefined)
  get te(): string | null
  set te(value: StringInit | null | undefined)
  get timingAllowOrigin(): string | null
  set timingAllowOrigin(value: StringInit | null | undefined)
  get trailer(): string | null
  set trailer(value: StringInit | null | undefined)
  get transferEncoding(): string | null
  set transferEncoding(value: StringInit | null | undefined)
  get upgrade(): string | null
  set upgrade(value: StringInit | null | undefined)
  get upgradeInsecureRequests(): number | null
  set upgradeInsecureRequests(value: string | number | null | undefined)
  get userAgent(): string | null
  set userAgent(value: string | null | undefined)
  get vary(): Vary
  set vary(value: string | string[] | VaryInit | null | undefined)
  get via(): string | null
  set via(value: StringInit | null | undefined)
  get wantDigest(): string | null
  set wantDigest(value: StringInit | null | undefined)
  get wwwAuthenticate(): string | null
  set wwwAuthenticate(value: StringInit | null | undefined)
  get xContentTypeOptions(): string | null
  set xContentTypeOptions(value: string | null | undefined)
  get xDnsPrefetchControl(): string | null
  set xDnsPrefetchControl(value: string | null | undefined)
  get xFrameOptions(): string | null
  set xFrameOptions(value: string | null | undefined)
  get xPermittedCrossDomainPolicies(): string | null
  set xPermittedCrossDomainPolicies(value: string | null | undefined)
  get xPoweredBy(): string | null
  set xPoweredBy(value: string | null | undefined)
  get xRequestedWith(): string | null
  set xRequestedWith(value: string | null | undefined)
  get xRobotsTag(): string | null
  set xRobotsTag(value: StringInit | null | undefined)
  get xXssProtection(): string | null
  set xXssProtection(value: string | null | undefined)
}

function objectHeader<init, value extends HeaderValue>(
  property: string,
  name: string,
  from: (value: string | init | null) => value,
  mutatingMethods: readonly string[] = [],
): ObjectHeaderDescriptor {
  return {
    kind: 'object',
    property,
    name,
    from(value: unknown): HeaderValue {
      return from(value as string | init | null)
    },
    mutatingMethods: new Set(mutatingMethods),
  }
}

function stringHeader(
  property: string,
  name: string,
  list = false,
  transform?: (value: string) => string,
): StringHeaderDescriptor {
  return {
    kind: 'string',
    property,
    name,
    list,
    transform,
  }
}

function numberHeader(property: string, name: string): NumberHeaderDescriptor {
  return {
    kind: 'number',
    property,
    name,
  }
}

function dateHeader(property: string, name: string): DateHeaderDescriptor {
  return {
    kind: 'date',
    property,
    name,
  }
}

function observeMutations<value extends object>(
  value: value,
  mutatingMethods: ReadonlySet<string>,
  onChange: OnChange,
): value {
  let proxies = new WeakMap<object, object>()

  function observe<item extends object>(item: item): item {
    if (item instanceof Date) return item

    let cached = proxies.get(item)
    if (cached) return cached as item

    let proxy = new Proxy(item, {
      get(target, property) {
        let member = Reflect.get(target, property, target)

        if (typeof member === 'function') {
          if (
            typeof property === 'string' &&
            (mutatingMethods.has(property) ||
              (Array.isArray(target) && ArrayMutatingMethods.has(property)))
          ) {
            return (...args: unknown[]) => {
              let result = member.apply(target, args)
              onChange()
              return result
            }
          }

          return member.bind(target)
        }

        if (member !== null && typeof member === 'object') {
          return observe(member)
        }

        return member
      },
      set(target, property, newValue) {
        let result = Reflect.set(target, property, newValue, target)
        onChange()
        return result
      },
      deleteProperty(target, property) {
        let result = Reflect.deleteProperty(target, property)
        onChange()
        return result
      },
    })

    proxies.set(item, proxy)
    return proxy
  }

  return observe(value)
}

function getNativeSetCookie(headers: Headers): string[] {
  return Headers.prototype.getSetCookie.call(headers)
}

function stringifySetCookieValue(value: SetCookieValue): string {
  return typeof value === 'string' ? value : SetCookie.from(value).toString()
}

function normalizeSetCookieValues(values: SetCookieValue[]): void {
  for (let i = 0; i < values.length; i++) {
    let value = values[i]
    values[i] = typeof value === 'string' ? SetCookie.from(value) : SetCookie.from(value)
  }
}

function arraysEqual(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false

  for (let i = 0; i < left.length; i++) {
    if (left[i] !== right[i]) return false
  }

  return true
}
