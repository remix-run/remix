/**
 * Create a storage key with an optional default value.
 *
 * @param defaultValue The default value for the storage key
 * @returns The new storage key
 */
export function createStorageKey<value>(defaultValue?: value): StorageKey<value> {
  return { defaultValue }
}

/**
 * A type-safe key for storing and retrieving values from `RequestContext`.
 */
export interface StorageKey<value> {
  /**
   * The default value for this key if no value has been set.
   */
  defaultValue?: value
}

export type StorageValue<key> = key extends StorageKey<infer value> ? value : never
