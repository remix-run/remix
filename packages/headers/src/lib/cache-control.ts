import { type HeaderValue } from './header-value.ts'
import { parseParams } from './param-values.ts'

// Taken from https://github.com/jjenzz/pretty-cache-header by jjenzz
// License: MIT https://github.com/jjenzz/pretty-cache-header/blob/main/LICENSE

/**
 * Initializer for a `Cache-Control` header value.
 */
export interface CacheControlInit {
  /**
   * The `max-age=N` **request directive** indicates that the client allows a stored response that
   * is generated on the origin server within _N_ seconds — where _N_ may be any non-negative
   * integer (including `0`).
   *
   * The `max-age=N` **response directive** indicates that the response remains
   * [fresh](https://developer.mozilla.org/en-US/docs/Web/HTTP/Caching#fresh_and_stale_based_on_age)
   * until _N_ seconds after the response is generated.
   *
   * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control#max-age)
   */
  maxAge?: number
  /**
   * The `max-stale=N` **request directive** indicates that the client allows a stored response
   * that is [stale](https://developer.mozilla.org/en-US/docs/Web/HTTP/Caching#fresh_and_stale_based_on_age)
   * within _N_ seconds.
   *
   * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control#max-stale)
   */
  maxStale?: number
  /**
   * The `min-fresh=N` **request directive** indicates that the client allows a stored response
   * that is [fresh](https://developer.mozilla.org/en-US/docs/Web/HTTP/Caching#fresh_and_stale_based_on_age)
   * for at least _N_ seconds.
   *
   * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control#min-fresh)
   */
  minFresh?: number
  /**
   * The `s-maxage` **response directive** also indicates how long the response is
   * [fresh](https://developer.mozilla.org/en-US/docs/Web/HTTP/Caching#fresh_and_stale_based_on_age) for (similar to `max-age`) —
   * but it is specific to shared caches, and they will ignore `max-age` when it is present.
   *
   * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control#s-maxage)
   */
  sMaxage?: number
  /**
   * The `no-cache` **request directive** asks caches to validate the response with the origin
   * server before reuse. If you want caches to always check for content updates while reusing
   * stored content, `no-cache` is the directive to use.
   *
   * The `no-cache` **response directive** indicates that the response can be stored in caches, but
   * the response must be validated with the origin server before each reuse, even when the cache
   * is disconnected from the origin server.
   *
   * `no-cache` allows clients to request the most up-to-date response even if the cache has a
   * [fresh](https://developer.mozilla.org/en-US/docs/Web/HTTP/Caching#fresh_and_stale_based_on_age)
   * response.
   *
   * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control#no-cache)
   */
  noCache?: true
  /**
   * The `no-store` **request directive** allows a client to request that caches refrain from
   * storing the request and corresponding response — even if the origin server's response could
   * be stored.
   *
   * The `no-store` **response directive** indicates that any caches of any kind (private or shared)
   * should not store this response.
   *
   * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control#no-store)
   */
  noStore?: true
  /**
   * `no-transform` indicates that any intermediary (regardless of whether it implements a cache)
   * shouldn't transform the response contents.
   *
   * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control#no-transform)
   */
  noTransform?: true
  /**
   * The client indicates that cache should obtain an already-cached response. If a cache has
   * stored a response, it's reused.
   *
   * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control#only-if-cached)
   */
  onlyIfCached?: true
  /**
   * The `must-revalidate` **response directive** indicates that the response can be stored in
   * caches and can be reused while [fresh](https://developer.mozilla.org/en-US/docs/Web/HTTP/Caching#fresh_and_stale_based_on_age).
   * If the response becomes [stale](https://developer.mozilla.org/en-US/docs/Web/HTTP/Caching#fresh_and_stale_based_on_age),
   * it must be validated with the origin server before reuse.
   *
   * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control#must-revalidate)
   */
  mustRevalidate?: true
  /**
   * The `proxy-revalidate` **response directive** is the equivalent of `must-revalidate`, but
   * specifically for shared caches only.
   *
   * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control#proxy-revalidate)
   */
  proxyRevalidate?: true
  /**
   * The `must-understand` **response directive** indicates that a cache should store the response
   * only if it understands the requirements for caching based on status code.
   *
   * `must-understand` should be coupled with `no-store` for fallback behavior.
   *
   * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control#must-understand)
   */
  mustUnderstand?: true
  /**
   * The `private` **response directive** indicates that the response can be stored only in a
   * private cache (e.g. local caches in browsers).
   *
   * You should add the `private` directive for user-personalized content, especially for responses
   * received after login and for sessions managed via cookies.
   *
   * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control#private)
   */
  private?: true
  /**
   * The `public` **response directive** indicates that the response can be stored in a shared
   * cache. Responses for requests with `Authorization` header fields must not be stored in a
   * shared cache; however, the `public` directive will cause such responses to be stored in a
   * shared cache.
   *
   * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control#public)
   */
  public?: true
  /**
   * The `immutable` **response directive** indicates that the response will not be updated while
   * it's [fresh](https://developer.mozilla.org/en-US/docs/Web/HTTP/Caching#fresh_and_stale_based_on_age).
   *
   * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control#public)
   */
  immutable?: true
  /**
   * The `stale-while-revalidate` **response directive** indicates that the cache could reuse a
   * stale response while it revalidates it to a cache.
   *
   * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control#stale-while-revalidate)
   */
  staleWhileRevalidate?: number
  /**
   * The `stale-if-error` **response directive** indicates that the cache can reuse a
   * [stale response](https://developer.mozilla.org/en-US/docs/Web/HTTP/Caching#fresh_and_stale_based_on_age)
   * when an upstream server generates an error, or when the error is generated locally. Here, an
   * error is considered any response with a status code of 500, 502, 503, or 504.
   *
   * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control#stale-if-error)
   */
  staleIfError?: number
}

/**
 * The value of a `Cache-Control` HTTP header.
 *
 * [MDN `Cache-Control` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control)
 *
 * [HTTP/1.1 Specification](https://datatracker.ietf.org/doc/html/rfc7234#section-5.2)
 */
export class CacheControl implements HeaderValue, CacheControlInit {
  maxAge?: number
  maxStale?: number
  minFresh?: number
  sMaxage?: number
  noCache?: true
  noStore?: true
  noTransform?: true
  onlyIfCached?: true
  mustRevalidate?: true
  proxyRevalidate?: true
  mustUnderstand?: true
  private?: true
  public?: true
  immutable?: true
  staleWhileRevalidate?: number
  staleIfError?: number

  constructor(init?: string | CacheControlInit) {
    if (init) return CacheControl.from(init)
  }

  /**
   * Returns the string representation of the header value.
   *
   * @returns The header value as a string
   */
  toString(): string {
    let parts = []

    if (this.public) {
      parts.push('public')
    }
    if (this.private) {
      parts.push('private')
    }
    if (typeof this.maxAge === 'number') {
      parts.push(`max-age=${this.maxAge}`)
    }
    if (typeof this.sMaxage === 'number') {
      parts.push(`s-maxage=${this.sMaxage}`)
    }
    if (this.noCache) {
      parts.push('no-cache')
    }
    if (this.noStore) {
      parts.push('no-store')
    }
    if (this.noTransform) {
      parts.push('no-transform')
    }
    if (this.onlyIfCached) {
      parts.push('only-if-cached')
    }
    if (this.mustRevalidate) {
      parts.push('must-revalidate')
    }
    if (this.proxyRevalidate) {
      parts.push('proxy-revalidate')
    }
    if (this.mustUnderstand) {
      parts.push('must-understand')
    }
    if (this.immutable) {
      parts.push('immutable')
    }
    if (typeof this.staleWhileRevalidate === 'number') {
      parts.push(`stale-while-revalidate=${this.staleWhileRevalidate}`)
    }
    if (typeof this.staleIfError === 'number') {
      parts.push(`stale-if-error=${this.staleIfError}`)
    }
    if (typeof this.maxStale === 'number') {
      parts.push(`max-stale=${this.maxStale}`)
    }
    if (typeof this.minFresh === 'number') {
      parts.push(`min-fresh=${this.minFresh}`)
    }

    return parts.join(', ')
  }

  /**
   * Parse a Cache-Control header value.
   *
   * @param value The header value (string, init object, or null)
   * @returns A CacheControl instance (empty if null)
   */
  static from(value: string | CacheControlInit | null): CacheControl {
    let header = new CacheControl()

    if (value !== null) {
      if (typeof value === 'string') {
        let params = parseParams(value, ',')
        if (params.length > 0) {
          for (let [name, val] of params) {
            switch (name) {
              case 'max-age':
                header.maxAge = Number(val)
                break
              case 'max-stale':
                header.maxStale = Number(val)
                break
              case 'min-fresh':
                header.minFresh = Number(val)
                break
              case 's-maxage':
                header.sMaxage = Number(val)
                break
              case 'no-cache':
                header.noCache = true
                break
              case 'no-store':
                header.noStore = true
                break
              case 'no-transform':
                header.noTransform = true
                break
              case 'only-if-cached':
                header.onlyIfCached = true
                break
              case 'must-revalidate':
                header.mustRevalidate = true
                break
              case 'proxy-revalidate':
                header.proxyRevalidate = true
                break
              case 'must-understand':
                header.mustUnderstand = true
                break
              case 'private':
                header.private = true
                break
              case 'public':
                header.public = true
                break
              case 'immutable':
                header.immutable = true
                break
              case 'stale-while-revalidate':
                header.staleWhileRevalidate = Number(val)
                break
              case 'stale-if-error':
                header.staleIfError = Number(val)
                break
            }
          }
        }
      } else {
        header.maxAge = value.maxAge
        header.maxStale = value.maxStale
        header.minFresh = value.minFresh
        header.sMaxage = value.sMaxage
        header.noCache = value.noCache
        header.noStore = value.noStore
        header.noTransform = value.noTransform
        header.onlyIfCached = value.onlyIfCached
        header.mustRevalidate = value.mustRevalidate
        header.proxyRevalidate = value.proxyRevalidate
        header.mustUnderstand = value.mustUnderstand
        header.private = value.private
        header.public = value.public
        header.immutable = value.immutable
        header.staleWhileRevalidate = value.staleWhileRevalidate
        header.staleIfError = value.staleIfError
      }
    }

    return header
  }
}
