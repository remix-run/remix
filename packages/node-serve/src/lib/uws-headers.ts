export function createUwsHeaders(entries: [string, string][]): Headers {
  return new UwsHeaders(entries)
}

class UwsHeaders implements Headers {
  #headers: Headers | undefined
  #entries: [string, string][]

  constructor(entries: [string, string][]) {
    this.#entries = entries
  }

  #materialize(): Headers {
    return (this.#headers ??= new Headers(this.#entries))
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
    if (this.#headers != null) return this.#headers.getSetCookie()

    let values: string[] = []
    for (let [key, value] of this.#entries) {
      if (key.toLowerCase() === 'set-cookie') values.push(value)
    }
    return values
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

    for (let [key, value] of this.#entries) {
      callbackfn.call(thisArg, value, key, this)
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
    return this.#entries[Symbol.iterator]()
  }
}

Object.setPrototypeOf(UwsHeaders.prototype, Headers.prototype)
