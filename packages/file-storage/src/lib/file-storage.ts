/**
 * A key/value interface for storing `File` objects.
 */
export interface FileStorage {
  /**
   * Get a [`File`](https://developer.mozilla.org/en-US/docs/Web/API/File) at the given key.
   *
   * @param key The key to look up
   * @returns The file with the given key, or `null` if no such key exists
   */
  get(key: string): File | null | Promise<File | null>
  /**
   * Check if a file with the given key exists.
   *
   * @param key The key to look up
   * @returns `true` if a file with the given key exists, `false` otherwise
   */
  has(key: string): boolean | Promise<boolean>
  /**
   * List the files in storage.
   *
   * The following `options` are available:
   *
   * - `cursor`: An opaque string that allows you to paginate over the keys in storage
   * - `includeMetadata`: If `true`, include file metadata in the result
   * - `limit`: The maximum number of files to return
   * - `prefix`: Only return keys that start with this string
   *
   * For example, to list all files under keys that start with `user123/`:
   *
   * ```ts
   * let result = await storage.list({ prefix: 'user123/' });
   * console.log(result.files);
   * // [
   * //   { key: "user123/..." },
   * //   { key: "user123/..." },
   * //   ...
   * // ]
   * ```
   *
   * `result.files` will be an array of `{ key: string }` objects. To include metadata about each
   * file, use `includeMetadata: true`.
   *
   * ```ts
   * let result = await storage.list({ prefix: 'user123/', includeMetadata: true });
   * console.log(result.files);
   * // [
   * //   {
   * //     key: "user123/...",
   * //     lastModified: 1737955705270,
   * //     name: "hello.txt",
   * //     size: 16,
   * //     type: "text/plain"
   * //   },
   * //   ...
   * // ]
   * ```
   *
   * Pagination is done via an opaque `cursor` property in the list result object. If it is not
   * `undefined`, there are more files to list. You can list them by passing the `cursor` back in
   * the `options` object on the next call.
   *
   * ```ts
   * let result = await storage.list();
   *
   * console.log(result.files);
   *
   * if (result.cursor !== undefined) {
   *   let result2 = await storage.list({ cursor: result.cursor });
   * }
   * ```
   *
   * Use the `limit` option to limit how many results you get back in the `files` array.
   *
   * @param options Options for the list operation
   * @returns An object with an array of `files` and an optional `cursor` property
   */
  list<T extends ListOptions>(options?: T): ListResult<T> | Promise<ListResult<T>>
  /**
   * Put a [`File`](https://developer.mozilla.org/en-US/docs/Web/API/File) in storage and return a
   * new file backed by this storage.
   *
   * @param key The key to store the file under
   * @param file The file to store
   * @returns A new `File` object backed by this storage
   */
  put(key: string, file: File): File | Promise<File>
  /**
   * Remove the file with the given key from storage.
   *
   * @param key The key to remove
   */
  remove(key: string): void | Promise<void>
  /**
   * Put a [`File`](https://developer.mozilla.org/en-US/docs/Web/API/File) in storage at the given
   * key.
   *
   * @param key The key to store the file under
   * @param file The file to store
   */
  set(key: string, file: File): void | Promise<void>
}

/**
 * A reference to a file in storage by its key.
 */
export interface FileKey {
  /**
   * The key of the file in storage.
   */
  key: string
}

/**
 * Metadata about a file in storage.
 */
export interface FileMetadata extends FileKey {
  /**
   * The last modified time of the file (in ms since the Unix epoch).
   */
  lastModified: number
  /**
   * The name of the file.
   */
  name: string
  /**
   * The size of the file in bytes.
   */
  size: number
  /**
   * The MIME type of the file.
   */
  type: string
}

/**
 * Options for listing files in storage.
 */
export interface ListOptions {
  /**
   * An opaque string that allows you to paginate over the keys in storage.
   */
  cursor?: string
  /**
   * If `true`, include file metadata in the result.
   */
  includeMetadata?: boolean
  /**
   * The maximum number of files to return.
   */
  limit?: number
  /**
   * Only return files with keys that start with this prefix.
   */
  prefix?: string
}

/**
 * The result of listing files in storage.
 */
export interface ListResult<T extends ListOptions> {
  /**
   * An opaque string that allows you to paginate over the keys in storage. Pass this back in the
   * `options` object on the next `list()` call to get the next page of results.
   */
  cursor?: string
  /**
   * A list of the files in storage.
   */
  files: (T extends { includeMetadata: true } ? FileMetadata : FileKey)[]
}
