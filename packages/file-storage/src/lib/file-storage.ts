/**
 * A key/value interface for storing `File` objects.
 */
export interface FileStorage {
  /**
   * Checks if a file with the given key exists.
   * @param key The key to look up
   * @returns `true` if a file with the given key exists, `false` otherwise
   */
  has(key: string): boolean | Promise<boolean>;
  /**
   * Puts a [`File`](https://developer.mozilla.org/en-US/docs/Web/API/File) in storage at the given key.
   * @param key The key to store the file under
   * @param file The file to store
   * @returns A promise that resolves when the file has been stored
   */
  set(key: string, file: File): void | Promise<void>;
  /**
   * Gets the [`File`](https://developer.mozilla.org/en-US/docs/Web/API/File) with a given key.
   * @param key The key to look up
   * @returns The file with the given key, or `null` if no such key exists
   */
  get(key: string): File | null | Promise<File | null>;
  /**
   * Puts a [`File`](https://developer.mozilla.org/en-US/docs/Web/API/File) in storage and returns
   * a new file backed by this storage.
   * @param key The key to store the file under
   * @param file The file to store
   * @returns A new File object backed by this storage
   */
  put(key: string, file: File): File | Promise<File>;
  /**
   * Removes the file with the given key from storage.
   * @param key The key to remove
   * @returns A promise that resolves when the file has been removed
   */
  remove(key: string): void | Promise<void>;
}
