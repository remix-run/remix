/**
 * The `FileStorage` interface provides methods for storing and retrieving `File` objects.
 */
export interface FileStorage {
  /**
   * Returns `true` if a file with the given key exists, `false` otherwise.
   */
  has(key: string): boolean | Promise<boolean>;
  /**
   * Stores a file with the given key.
   */
  put(key: string, file: File): void | Promise<void>;
  /**
   * Returns the file with the given key, or `null` if no such key exists.
   */
  get(key: string): File | null | Promise<File | null>;
  /**
   * Removes the file with the given key from storage.
   */
  remove(key: string): void | Promise<void>;
}
