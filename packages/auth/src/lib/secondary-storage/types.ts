/**
 * Secondary storage interface for ephemeral data (rate limits, etc.)
 *
 * Unlike the main storage (for users, accounts), this is a simple key-value
 * store with optional TTL support.
 */
export interface SecondaryStorage {
  /**
   * Get a value by key
   * @returns The value as a string, or null if not found/expired
   */
  get(key: string): Promise<string | null>

  /**
   * Set a value with optional TTL
   * @param key The key to set
   * @param value The value (will be stored as string)
   * @param ttl Time-to-live in seconds (optional)
   */
  set(key: string, value: string, ttl?: number): Promise<void>

  /**
   * Delete a value by key
   */
  delete(key: string): Promise<void>
}
