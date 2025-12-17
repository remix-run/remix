import { type HeaderValue } from './header-value.ts'
import { observeDeepProxy } from './observe-deep-proxy.ts'
import { type SetCookieInit, SetCookie } from './set-cookie.ts'

/**
 * Detect if the runtime bypasses JS Headers iteration when creating a Response.
 * In Bun, Response reads from native C++ storage instead of calling JS methods,
 * so we need to sync all mutations to native storage.
 */
let needsNativeSyncHeaderStorage = (() => {
  let iteratorCalled = false
  class TestHeaders extends Headers {
    *[Symbol.iterator](): HeadersIterator<[string, string]> {
      iteratorCalled = true
      yield* super[Symbol.iterator]()
    }
  }
  let h = new TestHeaders()
  h.set('x-test', 'value')
  new Response('', { headers: h })
  return !iteratorCalled
})()

/**
 * Abstraction for header storage that handles runtime differences.
 * - Bun: Syncs to native Headers storage, wraps values in mutation-tracking proxies
 * - Other runtimes: Uses internal Map, caches parsed objects
 *
 * All keys are normalized to lowercase internally.
 * Headers iterate in lexicographical (sorted) order by name.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Headers#iteration_methods
 */
export interface HeaderStorage {
  // Basic string operations (mirrors native Headers API)

  /** Returns the header value, or null if not present. */
  get(key: string): string | null
  /** Sets a header, replacing any existing value. */
  set(key: string, value: string): void
  /** Removes a header. */
  delete(key: string): void
  /** Appends a value to a header (comma-separated for most, multi-value for Set-Cookie). */
  append(key: string, value: string): void
  /** Returns true if the header is present. */
  has(key: string): boolean
  /** Returns an iterable of header names in sorted order. */
  keys(): Iterable<string>
  /** Returns all Set-Cookie header values as strings. */
  getSetCookie(): string[]

  // Rich header value operations (typed object access with caching)

  /** Returns a typed header value object, creating and caching if needed. */
  getHeaderValue<T extends HeaderValue>(key: string, ctor: new (init?: any) => T): T
  /** Sets a header from a typed value or string. */
  setHeaderValue(key: string, ctor: new (init?: any) => HeaderValue, value: any): void
  /** Returns Set-Cookie values as SetCookie objects. */
  getSetCookieObjects(): SetCookie[]
}

/**
 * Stores header values in a private JavaScript Map.
 * Maintains a single cached object instance per header that's kept in sync via reset().
 *
 * Used in Node.js and other runtimes where Response reads headers via JS iteration.
 */
class PrivateDataHeaderStorage implements HeaderStorage {
  #map = new Map<string, string | HeaderValue>()
  #setCookies: (string | SetCookie | SetCookieInit)[] = []

  /**
   * Sets or resets a header value. If a cached object exists, resets it.
   * If value is undefined, clears the header.
   */
  #setOrReset(key: string, value?: string): void {
    let existing = this.#map.get(key)
    if (existing !== undefined && typeof existing !== 'string') {
      existing.reset(value)
    } else if (value !== undefined) {
      this.#map.set(key, value)
    } else {
      this.#map.delete(key)
    }
  }

  get(key: string): string | null {
    key = key.toLowerCase()
    let value = this.#map.get(key)
    if (value === undefined) return null
    // Return null for empty string (header cleared but object cached)
    return typeof value === 'string' ? value : value.toString() || null
  }

  set(key: string, value: string): void {
    key = key.toLowerCase()
    if (key === 'set-cookie') {
      this.#setCookies = [value]
    } else {
      this.#setOrReset(key, value)
    }
  }

  delete(key: string): void {
    key = key.toLowerCase()
    if (key === 'set-cookie') {
      this.#setCookies = []
    } else {
      this.#setOrReset(key, undefined)
    }
  }

  append(key: string, value: string): void {
    key = key.toLowerCase()
    if (key === 'set-cookie') {
      this.#setCookies.push(value)
    } else {
      let existing = this.get(key)
      this.#setOrReset(key, existing ? `${existing}, ${value}` : value)
    }
  }

  has(key: string): boolean {
    key = key.toLowerCase()
    if (key === 'set-cookie') {
      return this.#setCookies.length > 0
    }
    return this.get(key) != null
  }

  getHeaderValue<T extends HeaderValue>(key: string, ctor: new (init?: any) => T): T {
    key = key.toLowerCase()
    let value = this.#map.get(key)
    if (value !== undefined) {
      if (typeof value === 'string') {
        // Upgrade string to object, cache it
        let obj = new ctor(value)
        this.#map.set(key, obj)
        return obj
      }
      // Return cached object
      return value as T
    }
    // Create new empty object, cache it
    let obj = new ctor()
    this.#map.set(key, obj)
    return obj
  }

  setHeaderValue(key: string, ctor: new (init?: any) => HeaderValue, value: any): void {
    key = key.toLowerCase()
    if (value != null) {
      let str = typeof value === 'string' ? value : new ctor(value).toString()
      this.#setOrReset(key, str)
    } else {
      this.delete(key)
    }
  }

  getSetCookie(): string[] {
    return this.#setCookies.map((c, i) => {
      if (typeof c === 'string') {
        return c
      }
      if (!(c instanceof SetCookie)) {
        c = new SetCookie(c)
        this.#setCookies[i] = c // Cache the conversion
      }
      return c.toString()
    })
  }

  getSetCookieObjects(): SetCookie[] {
    // Lazily convert strings/plain objects to SetCookie, cache in place
    for (let i = 0; i < this.#setCookies.length; i++) {
      let c = this.#setCookies[i]
      if (typeof c === 'string' || !(c instanceof SetCookie)) {
        this.#setCookies[i] = new SetCookie(c)
      }
    }
    return this.#setCookies as SetCookie[]
  }

  keys(): Iterable<string> {
    return [...this.#map.keys()].sort()
  }
}

/**
 * Syncs all operations to native Headers storage via Headers.prototype methods.
 * Native storage is the source of truth. Wraps values in proxies to track mutations.
 * Maintains a single cached object instance per header that's kept in sync via reset().
 *
 * Used in Bun where Response reads from native C++ Headers, bypassing JS iteration.
 */
class NativeSyncHeaderStorage implements HeaderStorage {
  #headers: Headers
  #cache = new Map<string, HeaderValue>()
  #setCookies: (string | SetCookie | SetCookieInit)[] | null = null
  #syncing = false // Prevents re-entrant sync when reset() triggers proxy onChange

  constructor(headers: Headers) {
    this.#headers = headers
  }

  /**
   * Resets a cached header value object if it exists.
   * Uses #syncing flag to prevent the proxy from double-syncing.
   */
  #resetCached(key: string, value?: string): void {
    let cached = this.#cache.get(key)
    if (cached !== undefined) {
      this.#syncing = true
      cached.reset(value)
      this.#syncing = false
    }
  }

  get(key: string): string | null {
    key = key.toLowerCase()
    // Check cache first - if we have a cached object, use its string value
    let cached = this.#cache.get(key)
    if (cached !== undefined) {
      return cached.toString() || null
    }
    return Headers.prototype.get.call(this.#headers, key)
  }

  set(key: string, value: string): void {
    key = key.toLowerCase()
    Headers.prototype.set.call(this.#headers, key, value)
    this.#resetCached(key, value)
    if (key === 'set-cookie') {
      this.#setCookies = [value]
    }
  }

  delete(key: string): void {
    key = key.toLowerCase()
    Headers.prototype.delete.call(this.#headers, key)
    this.#resetCached(key, undefined)
    if (key === 'set-cookie') {
      this.#setCookies = []
    }
  }

  append(key: string, value: string): void {
    key = key.toLowerCase()
    Headers.prototype.append.call(this.#headers, key, value)
    this.#resetCached(key, Headers.prototype.get.call(this.#headers, key) ?? undefined)
    if (key === 'set-cookie' && this.#setCookies !== null) {
      this.#setCookies.push(value)
    }
  }

  has(key: string): boolean {
    return Headers.prototype.has.call(this.#headers, key.toLowerCase())
  }

  getHeaderValue<T extends HeaderValue>(key: string, ctor: new (init?: any) => T): T {
    key = key.toLowerCase()
    let cached = this.#cache.get(key)
    if (cached !== undefined) {
      return cached as T
    }

    // Read from native and create object
    let value = Headers.prototype.get.call(this.#headers, key)
    let obj = value ? new ctor(value) : new ctor()

    // Wrap in proxy that syncs mutations back to native storage
    let proxy = observeDeepProxy(obj, () => {
      // Skip if we're in the middle of a set/delete/append (reset was called internally)
      if (this.#syncing) return
      let str = obj.toString()
      if (str === '') {
        Headers.prototype.delete.call(this.#headers, key)
      } else {
        Headers.prototype.set.call(this.#headers, key, str)
      }
    }) as T

    // Cache the proxy, not the raw object
    this.#cache.set(key, proxy)
    return proxy
  }

  setHeaderValue(key: string, ctor: new (init?: any) => HeaderValue, value: any): void {
    key = key.toLowerCase()
    if (value != null) {
      let str = typeof value === 'string' ? value : new ctor(value).toString()
      this.set(key, str)
    } else {
      this.delete(key)
    }
  }

  getSetCookie(): string[] {
    // If we have our array, convert to strings. Otherwise read from native.
    if (this.#setCookies !== null) {
      return this.#setCookies.map((c, i) => {
        if (typeof c === 'string') return c
        if (!(c instanceof SetCookie)) {
          c = new SetCookie(c)
          this.#setCookies![i] = c
        }
        return c.toString()
      })
    }
    return Headers.prototype.getSetCookie.call(this.#headers)
  }

  getSetCookieObjects(): SetCookie[] {
    // Initialize from native on first access
    if (this.#setCookies === null) {
      this.#setCookies = Headers.prototype.getSetCookie.call(this.#headers)
    }

    // Lazily convert strings/plain objects to SetCookie, cache in place
    for (let i = 0; i < this.#setCookies.length; i++) {
      let c = this.#setCookies[i]
      if (typeof c === 'string' || !(c instanceof SetCookie)) {
        this.#setCookies[i] = new SetCookie(c)
      }
    }

    // Wrap in proxy to sync mutations back to native storage
    return observeDeepProxy(this.#setCookies as SetCookie[], () => {
      Headers.prototype.delete.call(this.#headers, 'set-cookie')
      for (let c of this.#setCookies!) {
        let str =
          c instanceof SetCookie ? c.toString() : new SetCookie(c as SetCookieInit).toString()
        Headers.prototype.append.call(this.#headers, 'set-cookie', str)
      }
    })
  }

  keys(): Iterable<string> {
    return Headers.prototype.keys.call(this.#headers)
  }
}

export function createHeaderStorage(headers: Headers): HeaderStorage {
  return needsNativeSyncHeaderStorage
    ? new NativeSyncHeaderStorage(headers)
    : new PrivateDataHeaderStorage()
}
