/**
 * A key/value interface for storing `File` objects.
 */
export interface FileStorage {
  /**
   * Returns `true` if a file with the given key exists, `false` otherwise.
   */
  has(key: string): boolean | Promise<boolean>;
  /**
   * Puts a file in storage at the given key.
   */
  set(key: string, file: File): void | Promise<void>;
  /**
   * Returns the file with the given key, or `null` if no such key exists.
   */
  get(key: string): File | null | Promise<File | null>;
  /**
   * Removes the file with the given key from storage.
   */
  remove(key: string): void | Promise<void>;
}
