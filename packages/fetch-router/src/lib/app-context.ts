/**
 * Creates a context key with an optional default value.
 *
 * @param defaultValue The default value for the context
 * @returns The new context key
 */
export function createKey<T>(defaultValue?: T): ContextKey<T> {
  return { defaultValue }
}

export interface ContextKey<T> {
  defaultValue?: T
}

export type ContextValue<TKey> = TKey extends ContextKey<infer T> ? T : never

/**
 * Type-safe storage for application-specific context values.
 */
export class AppContext {
  #map: Map<ContextKey<any>, ContextValue<any>> = new Map()

  get<K extends ContextKey<any>>(key: K): ContextValue<K> {
    if (!this.#map.has(key)) {
      if (key.defaultValue === undefined) {
        throw new Error(`Missing context value for key ${key}`)
      }

      return key.defaultValue
    }

    return this.#map.get(key) as ContextValue<K>
  }

  set<K extends ContextKey<any>>(key: K, value: ContextValue<K>): void {
    this.#map.set(key, value)
  }
}
