/**
 * Type-safe storage for application-specific values.
 */
export class AppStorage {
    #map = new Map();
    /**
     * Check if a value is stored for the given key.
     *
     * @param key The key to check
     * @returns `true` if a value is stored for the given key, `false` otherwise
     */
    has(key) {
        return this.#map.has(key);
    }
    /**
     * Get a value from storage.
     *
     * @param key The key to get
     * @returns The value for the given key
     */
    get(key) {
        if (!this.#map.has(key)) {
            if (key.defaultValue === undefined) {
                throw new Error(`Missing default value in storage for key ${key}`);
            }
            return key.defaultValue;
        }
        return this.#map.get(key);
    }
    /**
     * Set a value in storage.
     *
     * @param key The key to set
     * @param value The value to set
     */
    set(key, value) {
        this.#map.set(key, value);
    }
}
/**
 * Create a storage key with an optional default value.
 *
 * @param defaultValue The default value for the storage key
 * @returns The new storage key
 */
export function createStorageKey(defaultValue) {
    return { defaultValue };
}
