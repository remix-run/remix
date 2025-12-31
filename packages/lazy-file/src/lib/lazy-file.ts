import { type ByteRange, getByteLength, getIndexes } from './byte-range.ts'

/**
 * A streaming interface for blob/file content.
 */
export interface LazyContent {
  /**
   * The total length of the content.
   */
  byteLength: number
  /**
   * Returns a stream that can be used to read the content. When given, the `start` index is
   * inclusive indicating the index of the first byte to read. The `end` index is exclusive
   * indicating the index of the first byte not to read.
   *
   * @param start The start index (inclusive)
   * @param end The end index (exclusive)
   * @returns A readable stream of the content
   */
  stream(start?: number, end?: number): ReadableStream<Uint8Array<ArrayBuffer>>
}

/**
 * Options for creating a `LazyBlob`.
 */
export interface LazyBlobOptions {
  /**
   * The range of bytes to include from the content. If not specified, all content is included.
   */
  range?: ByteRange
  /**
   * The MIME type of the content.
   *
   * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/Blob/Blob#type)
   *
   * @default ''
   */
  type?: string
}

/**
 * A lazy, streaming alternative to [`Blob`](https://developer.mozilla.org/en-US/docs/Web/API/Blob).
 *
 * **Important:** Since `LazyBlob` is not a `Blob` subclass, you cannot pass it directly to APIs
 * that expect a real `Blob` (like `new Response(blob)` or `formData.append('file', blob)`).
 * Instead, use one of:
 *
 * - `.stream()` - Returns a `ReadableStream` for `Response` and other streaming APIs
 * - `.toBlob()` - Returns a `Promise<Blob>` for non-streaming APIs that require a complete `Blob` (e.g. `FormData`)
 *
 * [MDN `Blob` Reference](https://developer.mozilla.org/en-US/docs/Web/API/Blob)
 */
export class LazyBlob {
  readonly #content: BlobContent

  /**
   * @param parts The blob parts or lazy content
   * @param options Options for the blob
   */
  constructor(parts: BlobPartLike[] | LazyContent, options?: LazyBlobOptions) {
    this.#content = new BlobContent(parts, options)
  }

  get [Symbol.toStringTag](): string {
    return 'LazyBlob'
  }

  /**
   * Returns the blob's contents as an [`ArrayBuffer`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/ArrayBuffer).
   *
   * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/Blob/arrayBuffer)
   *
   * @returns A promise that resolves to an `ArrayBuffer`
   */
  arrayBuffer(): Promise<ArrayBuffer> {
    return this.#content.arrayBuffer()
  }

  /**
   * Returns the blob's contents as a byte array.
   *
   * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/Blob/bytes)
   *
   * @returns A promise that resolves to a `Uint8Array`
   */
  bytes(): Promise<Uint8Array<ArrayBuffer>> {
    return this.#content.bytes()
  }

  /**
   * The size of the blob in bytes.
   *
   * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/Blob/size)
   */
  get size(): number {
    return this.#content.size
  }

  /**
   * The MIME type of the blob.
   *
   * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/Blob/type)
   */
  get type(): string {
    return this.#content.type
  }

  /**
   * Returns a new `LazyBlob` that contains the data in the specified range.
   *
   * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/Blob/slice)
   *
   * @param start The start index (inclusive)
   * @param end The end index (exclusive)
   * @param contentType The content type of the new blob
   * @returns A new `LazyBlob` containing the sliced data
   */
  slice(start?: number, end?: number, contentType?: string): LazyBlob {
    return this.#content.slice(start, end, contentType)
  }

  /**
   * Returns a stream that can be used to read the blob's contents.
   *
   * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/Blob/stream)
   *
   * @returns A readable stream of the blob's contents
   */
  stream(): ReadableStream<Uint8Array<ArrayBuffer>> {
    return this.#content.stream()
  }

  /**
   * Returns the blob's contents as a string.
   *
   * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/Blob/text)
   *
   * @returns A promise that resolves to the blob's contents as a string
   */
  text(): Promise<string> {
    return this.#content.text()
  }

  /**
   * Converts this `LazyBlob` to a native `Blob`.
   *
   * **Warning:** This reads the entire content into memory, which defeats the purpose of using
   * a lazy blob for large files. Only use this for non-streaming APIs that require a complete `Blob`.
   * Use `.stream()` to get a `ReadableStream` for `Response` and other streaming APIs.
   *
   * @returns A promise that resolves to a native `Blob`
   */
  async toBlob(): Promise<Blob> {
    return new Blob([await this.bytes()], { type: this.type })
  }

  /**
   * @throws Always throws a TypeError. LazyBlob cannot be implicitly converted to a string.
   * Use `.stream()` to get a `ReadableStream` for `Response` and other streaming APIs, or `.toBlob()` for non-streaming APIs that require a complete `Blob` (e.g. `FormData`). Always prefer `.stream()` when possible.
   */
  toString(): never {
    throw new TypeError(
      'Cannot convert LazyBlob to string. Use .stream() to get a ReadableStream for Response and other streaming APIs, or .toBlob() for non-streaming APIs that require a complete Blob (e.g. FormData). Always prefer .stream() when possible.',
    )
  }
}

/**
 * Options for creating a `LazyFile`.
 */
export interface LazyFileOptions extends LazyBlobOptions {
  /**
   * The last modified timestamp of the file in milliseconds.
   *
   * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/File/File#lastmodified)
   *
   * @default `Date.now()`
   */
  lastModified?: number
}

/**
 * A lazy, streaming alternative to [`File`](https://developer.mozilla.org/en-US/docs/Web/API/File).
 *
 * **Important:** Since `LazyFile` is not a `File` subclass, you cannot pass it directly to APIs
 * that expect a real `File` (like `new Response(file)` or `formData.append('file', file)`).
 * Instead, use one of:
 *
 * - `.stream()` - Returns a `ReadableStream` for `Response` and other streaming APIs
 * - `.toFile()` - Returns a `Promise<File>` for non-streaming APIs that require a complete `File` (e.g. `FormData`)
 * - `.toBlob()` - Returns a `Promise<Blob>` for non-streaming APIs that require a complete `Blob` (e.g. `FormData`)
 *
 * [MDN `File` Reference](https://developer.mozilla.org/en-US/docs/Web/API/File)
 */
export class LazyFile {
  readonly #content: BlobContent

  /**
   * The name of the file.
   *
   * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/File/name)
   */
  readonly name: string

  /**
   * The last modified timestamp of the file in milliseconds.
   *
   * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/File/lastModified)
   */
  readonly lastModified: number

  /**
   * Always empty string. This property exists only for structural compatibility with the native
   * `File` interface. It's a browser-specific property for files selected via `<input type="file">`
   * with the `webkitdirectory` attribute, which doesn't apply to programmatically created files.
   *
   * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/File/webkitRelativePath)
   */
  readonly webkitRelativePath = ''

  /**
   * @param parts The file parts or lazy content
   * @param name The name of the file
   * @param options Options for the file
   */
  constructor(parts: BlobPartLike[] | LazyContent, name: string, options?: LazyFileOptions) {
    this.#content = new BlobContent(parts, options)
    this.name = name
    this.lastModified = options?.lastModified ?? Date.now()
  }

  get [Symbol.toStringTag](): string {
    return 'LazyFile'
  }

  /**
   * Returns the file's content as an [`ArrayBuffer`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/ArrayBuffer).
   *
   * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/Blob/arrayBuffer)
   *
   * @returns A promise that resolves to an `ArrayBuffer`
   */
  arrayBuffer(): Promise<ArrayBuffer> {
    return this.#content.arrayBuffer()
  }

  /**
   * Returns the file's contents as a byte array.
   *
   * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/Blob/bytes)
   *
   * @returns A promise that resolves to a `Uint8Array`
   */
  bytes(): Promise<Uint8Array<ArrayBuffer>> {
    return this.#content.bytes()
  }

  /**
   * The size of the file in bytes.
   *
   * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/Blob/size)
   */
  get size(): number {
    return this.#content.size
  }

  /**
   * The MIME type of the file.
   *
   * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/Blob/type)
   */
  get type(): string {
    return this.#content.type
  }

  /**
   * Returns a new `LazyBlob` that contains the data in the specified range.
   *
   * Note: Like the native `File.slice()`, this returns a `Blob` (not a `File`).
   *
   * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/Blob/slice)
   *
   * @param start The start index (inclusive)
   * @param end The end index (exclusive)
   * @param contentType The content type of the new blob
   * @returns A new `LazyBlob` containing the sliced data
   */
  slice(start?: number, end?: number, contentType?: string): LazyBlob {
    return this.#content.slice(start, end, contentType)
  }

  /**
   * Returns a stream that can be used to read the file's contents.
   *
   * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/Blob/stream)
   *
   * @returns A readable stream of the file's contents
   */
  stream(): ReadableStream<Uint8Array<ArrayBuffer>> {
    return this.#content.stream()
  }

  /**
   * Returns the file's contents as a string.
   *
   * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/Blob/text)
   *
   * @returns A promise that resolves to the file's contents as a string
   */
  text(): Promise<string> {
    return this.#content.text()
  }

  /**
   * Converts this `LazyFile` to a native `Blob`.
   *
   * **Warning:** This reads the entire content into memory, which defeats the purpose of using
   * a lazy file for large files. Only use this for non-streaming APIs that require a complete `Blob`.
   * Use `.stream()` to get a `ReadableStream` for `Response` and other streaming APIs.
   *
   * @returns A promise that resolves to a native `Blob`
   */
  async toBlob(): Promise<Blob> {
    return new Blob([await this.bytes()], { type: this.type })
  }

  /**
   * Converts this `LazyFile` to a native `File`.
   *
   * **Warning:** This reads the entire content into memory, which defeats the purpose of using
   * a lazy file for large files. Only use this for non-streaming APIs that require a complete `File`
   * (e.g. `FormData`). For streaming, use `.stream()` instead.
   *
   * @returns A promise that resolves to a native `File`
   */
  async toFile(): Promise<File> {
    return new File([await this.bytes()], this.name, {
      type: this.type,
      lastModified: this.lastModified,
    })
  }

  /**
   * @throws Always throws a TypeError. LazyFile cannot be implicitly converted to a string.
   * Use `.stream()` to get a `ReadableStream` for `Response` and other streaming APIs, or `.toFile()`/`.toBlob()` for non-streaming APIs that require a complete `File`/`Blob` (e.g. `FormData`). Always prefer `.stream()` when possible.
   */
  toString(): never {
    throw new TypeError(
      'Cannot convert LazyFile to string. Use .stream() to get a ReadableStream for Response and other streaming APIs, or .toFile()/.toBlob() for non-streaming APIs that require a complete File/Blob (e.g. FormData). Always prefer .stream() when possible.',
    )
  }
}

/**
 * Union of Blob and lazy blob types.
 */
type BlobLike = Blob | LazyBlob | LazyFile

/**
 * Union of BlobPart and lazy blob types. Used for constructor signatures.
 */
type BlobPartLike = BlobPart | LazyBlob | LazyFile

function isBlobLike(value: unknown): value is BlobLike {
  return value instanceof Blob || value instanceof LazyBlob || value instanceof LazyFile
}

class BlobContent {
  readonly source: (BlobLike | Uint8Array<ArrayBuffer>)[] | LazyContent
  readonly totalSize: number
  readonly range?: ByteRange
  readonly type: string

  constructor(parts: BlobPartLike[] | LazyContent, options?: LazyBlobOptions) {
    if (Array.isArray(parts)) {
      this.source = []
      this.totalSize = 0

      for (let part of parts) {
        if (isBlobLike(part)) {
          this.source.push(part)
          this.totalSize += part.size
        } else {
          let array: Uint8Array
          if (typeof part === 'string') {
            array = new TextEncoder().encode(part)
          } else if (ArrayBuffer.isView(part)) {
            array = new Uint8Array(part.buffer, part.byteOffset, part.byteLength)
          } else {
            array = new Uint8Array(part)
          }

          this.source.push(array as Uint8Array<ArrayBuffer>)
          this.totalSize += array.byteLength
        }
      }
    } else {
      this.source = parts
      this.totalSize = parts.byteLength
    }

    this.range = options?.range
    this.type = options?.type ?? ''
  }

  async arrayBuffer(): Promise<ArrayBuffer> {
    return (await this.bytes()).buffer as ArrayBuffer
  }

  async bytes(): Promise<Uint8Array<ArrayBuffer>> {
    let result = new Uint8Array(this.size)

    let offset = 0
    for await (let chunk of this.stream()) {
      result.set(chunk, offset)
      offset += chunk.length
    }

    return result
  }

  get size(): number {
    return this.range != null ? getByteLength(this.range, this.totalSize) : this.totalSize
  }

  slice(start = 0, end?: number, contentType = ''): LazyBlob {
    let range: ByteRange =
      this.range != null
        ? // file.slice().slice() is additive
          { start: this.range.start + start, end: this.range.end + (end ?? 0) }
        : { start, end: end ?? this.size }

    return new LazyBlob(this.source, { range, type: contentType })
  }

  stream(): ReadableStream<Uint8Array<ArrayBuffer>> {
    if (this.range != null) {
      let [start, end] = getIndexes(this.range, this.totalSize)
      return Array.isArray(this.source)
        ? streamContentArray(this.source, start, end)
        : this.source.stream(start, end)
    }

    return Array.isArray(this.source) ? streamContentArray(this.source) : this.source.stream()
  }

  async text(): Promise<string> {
    return new TextDecoder('utf-8').decode(await this.bytes())
  }
}

function streamContentArray(
  content: (Blob | Uint8Array<ArrayBuffer>)[],
  start = 0,
  end = Infinity,
): ReadableStream<Uint8Array<ArrayBuffer>> {
  let index = 0
  let bytesRead = 0

  return new ReadableStream({
    async pull(controller) {
      if (index >= content.length) {
        controller.close()
        return
      }

      let hasPushed = false

      function pushChunk(chunk: Uint8Array<ArrayBuffer>) {
        let chunkLength = chunk.byteLength

        if (!(bytesRead + chunkLength < start || bytesRead >= end)) {
          let startIndex = Math.max(start - bytesRead, 0)
          let endIndex = Math.min(end - bytesRead, chunkLength)
          controller.enqueue(chunk.subarray(startIndex, endIndex))
          hasPushed = true
        }

        bytesRead += chunkLength
      }

      async function pushPart(part: Blob | Uint8Array<ArrayBuffer>) {
        if (isBlobLike(part)) {
          if (bytesRead + part.size <= start) {
            // We can skip this part entirely.
            bytesRead += part.size
            return
          }

          for await (let chunk of part.stream()) {
            pushChunk(chunk)

            if (bytesRead >= end) {
              // We can stop reading now.
              break
            }
          }
        } else {
          pushChunk(part)
        }
      }

      while (!hasPushed && index < content.length) {
        await pushPart(content[index++])

        if (bytesRead >= end) {
          controller.close()
          break
        }
      }
    },
  })
}
