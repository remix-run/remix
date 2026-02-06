/**
 * Type-safe storage for application-specific values.
 */
export declare class AppStorage {
    #private;
    /**
     * Check if a value is stored for the given key.
     *
     * @param key The key to check
     * @returns `true` if a value is stored for the given key, `false` otherwise
     */
    has<key extends StorageKey<any>>(key: key): boolean;
    /**
     * Get a value from storage.
     *
     * @param key The key to get
     * @returns The value for the given key
     */
    get<key extends StorageKey<any>>(key: key): StorageValue<key>;
    /**
     * Set a value in storage.
     *
     * @param key The key to set
     * @param value The value to set
     */
    set<key extends StorageKey<any>>(key: key, value: StorageValue<key>): void;
}
/**
 * Create a storage key with an optional default value.
 *
 * @param defaultValue The default value for the storage key
 * @returns The new storage key
 */
export declare function createStorageKey<T>(defaultValue?: T): StorageKey<T>;
/**
 * A type-safe key for storing and retrieving values from `AppStorage`.
 */
export interface StorageKey<T> {
    /**
     * The default value for this key if no value has been set.
     */
    defaultValue?: T;
}
export type StorageValue<T> = T extends StorageKey<infer V> ? V : never;
//# sourceMappingURL=app-storage.d.ts.map