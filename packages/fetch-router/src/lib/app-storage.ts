/**
 * Type-safe storage for application-specific values.
 */
export class AppStorage {
  #map: Map<StorageKey<any>, StorageValue<any>> = new Map()

  get<K extends StorageKey<any>>(key: K): StorageValue<K> {
    if (!this.#map.has(key)) {
      if (key.defaultValue === undefined) {
        throw new Error(`Missing storage value for key ${key}`)
      }

      return key.defaultValue
    }

    return this.#map.get(key) as StorageValue<K>
  }

  set<K extends StorageKey<any>>(key: K, value: StorageValue<K>): void {
    this.#map.set(key, value)
  }
}

/**
 * Create a storage key with an optional default value.
 *
 * @param defaultValue The default value for the storage key
 * @returns The new storage key
 */
export function createStorageKey<T>(defaultValue?: T): StorageKey<T> {
  return { defaultValue }
}

export interface StorageKey<T> {
  defaultValue?: T
}

export type StorageValue<TKey> = TKey extends StorageKey<infer T> ? T : never
