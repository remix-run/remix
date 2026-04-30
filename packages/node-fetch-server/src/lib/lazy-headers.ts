import type * as http from 'node:http'
import type * as http2 from 'node:http2'

type IncomingRequest = http.IncomingMessage | http2.Http2ServerRequest
type HeadersFactory = (req: IncomingRequest) => Headers

export function createLazyHeaders(req: IncomingRequest, createHeaders: HeadersFactory): Headers {
  return new LazyHeaders(req, createHeaders)
}

class LazyHeaders implements Headers {
  #headers: Headers | undefined
  #rawEntries: [string, string][] | null | undefined
  #req: IncomingRequest
  #createHeaders: HeadersFactory

  constructor(req: IncomingRequest, createHeaders: HeadersFactory) {
    this.#req = req
    this.#createHeaders = createHeaders
  }

  #materialize(): Headers {
    return (this.#headers ??= this.#createHeaders(this.#req))
  }

  #getRawEntries(): [string, string][] | null {
    if (this.#rawEntries !== undefined) return this.#rawEntries

    if (this.#req.httpVersionMajor !== 1) {
      this.#rawEntries = null
      return null
    }

    let entries = Object.entries(this.#req.headers)

    for (let [, value] of entries) {
      if (typeof value !== 'string') {
        this.#rawEntries = null
        return null
      }
    }

    this.#rawEntries = entries as [string, string][]
    return this.#rawEntries
  }

  append(name: string, value: string): void {
    this.#materialize().append(name, value)
  }

  delete(name: string): void {
    this.#materialize().delete(name)
  }

  get(name: string): string | null {
    return this.#materialize().get(name)
  }

  getSetCookie(): string[] {
    return this.#materialize().getSetCookie()
  }

  has(name: string): boolean {
    return this.#materialize().has(name)
  }

  set(name: string, value: string): void {
    this.#materialize().set(name, value)
  }

  entries(): HeadersIterator<[string, string]> {
    return this[Symbol.iterator]()
  }

  forEach(
    callbackfn: (value: string, key: string, parent: Headers) => void,
    thisArg?: unknown,
  ): void {
    if (this.#headers != null) {
      this.#headers.forEach(callbackfn, thisArg)
      return
    }

    let rawEntries = this.#getRawEntries()
    if (rawEntries != null) {
      for (let [key, value] of rawEntries) {
        callbackfn.call(thisArg, value, key, this)
      }
      return
    }

    for (let [key, value] of Object.entries(this.#req.headers)) {
      if (key.startsWith(':') || value == null) continue
      callbackfn.call(thisArg, Array.isArray(value) ? value.join(', ') : value, key, this)
    }
  }

  keys(): HeadersIterator<string> {
    let iterator = this[Symbol.iterator]()

    return {
      [Symbol.dispose]() {},
      [Symbol.iterator]() {
        return this
      },
      next() {
        let result = iterator.next()
        if (result.done) return { done: true, value: undefined }
        return { done: false, value: result.value[0] }
      },
    }
  }

  values(): HeadersIterator<string> {
    let iterator = this[Symbol.iterator]()

    return {
      [Symbol.dispose]() {},
      [Symbol.iterator]() {
        return this
      },
      next() {
        let result = iterator.next()
        if (result.done) return { done: true, value: undefined }
        return { done: false, value: result.value[1] }
      },
    }
  }

  [Symbol.iterator](): HeadersIterator<[string, string]> {
    if (this.#headers != null) return this.#headers[Symbol.iterator]()

    let rawEntries = this.#getRawEntries()
    if (rawEntries != null) {
      return rawEntries[Symbol.iterator]()
    }

    let entries = Object.entries(this.#req.headers)
    let index = 0

    return {
      [Symbol.dispose]() {},
      [Symbol.iterator]() {
        return this
      },
      next() {
        while (index < entries.length) {
          let [key, value] = entries[index++]
          if (key.startsWith(':') || value == null) continue
          if (Array.isArray(value)) return { done: false, value: [key, value.join(', ')] }
          return { done: false, value: [key, value] }
        }

        return { done: true, value: undefined }
      },
    }
  }
}

Object.setPrototypeOf(LazyHeaders.prototype, Headers.prototype)
