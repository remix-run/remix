import type { Params } from '@remix-run/route-pattern'

interface ContextKey<T> {
  defaultValue?: T
}

type ContextValue<TKey> = TKey extends ContextKey<infer T> ? T : never

export class AppContext {
  #map: Map<ContextKey<any>, ContextValue<any>> = new Map()

  get<K extends ContextKey<any>>(key: K): ContextValue<K> {
    if (!this.#map.has(key)) {
      if (key.defaultValue) {
        return key.defaultValue
      }

      throw new Error(`Missing context value for key ${key}`)
    }

    return this.#map.get(key) as ContextValue<K>
  }

  set<K extends ContextKey<any>>(key: K, value: ContextValue<K>): void {
    this.#map.set(key, value)
  }
}

export class RequestContext<T extends string> {
  readonly context: AppContext
  readonly request: Request
  readonly params: Params<T>
  readonly url: URL

  constructor(request: Request, params: Params<T>, url: URL) {
    this.context = new AppContext()
    this.request = request
    this.params = params
    this.url = url
  }
}
