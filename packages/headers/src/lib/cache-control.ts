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

  /**
   * @param init A string or object to initialize the header
   */
  constructor(init?: string | CacheControlInit) {
    if (init) {
      if (typeof init === 'string') {
        let params = parseParams(init, ',')
        if (params.length > 0) {
          for (let [name, value] of params) {
            switch (name) {
              case 'max-age':
                this.maxAge = Number(value)
                break
              case 'max-stale':
                this.maxStale = Number(value)
                break
              case 'min-fresh':
                this.minFresh = Number(value)
                break
              case 's-maxage':
                this.sMaxage = Number(value)
                break
              case 'no-cache':
                this.noCache = true
                break
              case 'no-store':
                this.noStore = true
                break
              case 'no-transform':
                this.noTransform = true
                break
              case 'only-if-cached':
                this.onlyIfCached = true
                break
              case 'must-revalidate':
                this.mustRevalidate = true
                break
              case 'proxy-revalidate':
                this.proxyRevalidate = true
                break
              case 'must-understand':
                this.mustUnderstand = true
                break
              case 'private':
                this.private = true
                break
              case 'public':
                this.public = true
                break
              case 'immutable':
                this.immutable = true
                break
              case 'stale-while-revalidate':
                this.staleWhileRevalidate = Number(value)
                break
              case 'stale-if-error':
                this.staleIfError = Number(value)
                break
            }
          }
        }
      } else {
        this.maxAge = init.maxAge
        this.maxStale = init.maxStale
        this.minFresh = init.minFresh
        this.sMaxage = init.sMaxage
        this.noCache = init.noCache
        this.noStore = init.noStore
        this.noTransform = init.noTransform
        this.onlyIfCached = init.onlyIfCached
        this.mustRevalidate = init.mustRevalidate
        this.proxyRevalidate = init.proxyRevalidate
        this.mustUnderstand = init.mustUnderstand
        this.private = init.private
        this.public = init.public
        this.immutable = init.immutable
        this.staleWhileRevalidate = init.staleWhileRevalidate
        this.staleIfError = init.staleIfError
      }
    }
  }

  /**
   * Returns the string representation of the header value.
   *
   * @return The header value as a string
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
}
