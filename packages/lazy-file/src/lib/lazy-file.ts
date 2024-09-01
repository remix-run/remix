import { ByteRange, getByteLength, getIndexes } from './byte-range.js';

/**
 * A streaming interface for blob/file content.
 */
export interface LazyContent {
  /**
   * The total length of the content.
   */
  byteLength: number;
  /**
   * Returns a stream that can be used to read the content. When given, the `start` index is
   * inclusive indicating the index of the first byte to read. The `end` index is exclusive
   * indicating the index of the first byte not to read.
   */
  stream(start?: number, end?: number): ReadableStream<Uint8Array>;
}

export interface LazyBlobOptions {
  /**
   * The range of bytes to include from the content. If not specified, all content is included.
   */
  range?: ByteRange;
  /**
   * The MIME type of the content. The default is an empty string.
   *
   * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/Blob/Blob#type)
   */
  type?: string;
}

/**
 * A `Blob` that may be backed by a stream of data. This is useful for working with large blobs that
 * would be impractical to load into memory all at once.
 *
 * This class is an extension of JavaScript's built-in `Blob` class with the following additions:
 *
 * - The constructor may accept a `LazyContent` object instead of a `BlobPart[]` array
 * - The constructor may accept a `range` in the options to specify a subset of the content
 *
 * In normal usage you shouldn't have to specify the `range` yourself. The `slice()` method
 * automatically takes care of creating new `LazyBlob` instances with the correct range.
 *
 * [MDN `Blob` Reference](https://developer.mozilla.org/en-US/docs/Web/API/Blob)
 */
export class LazyBlob extends Blob {
  readonly #content: BlobContent;

  constructor(parts: BlobPart[] | LazyContent, options?: LazyBlobOptions) {
    super([], options);
    this.#content = new BlobContent(parts, options);
  }

  /**
   * Returns the blob's contents as an `ArrayBuffer`.
   *
   * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/Blob/arrayBuffer)
   */
  async arrayBuffer(): Promise<ArrayBuffer> {
    return this.#content.arrayBuffer();
  }

  /**
   * Returns the blob's contents as a byte array.
   *
   * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/Blob/bytes)
   */
  async bytes(): Promise<Uint8Array> {
    return this.#content.bytes();
  }

  /**
   * The size of the blob in bytes.
   *
   * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/Blob/size)
   */
  get size(): number {
    return this.#content.size;
  }

  /**
   * Returns a new `Blob` that contains the data in the specified range.
   *
   * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/Blob/slice)
   */
  slice(start?: number, end?: number, contentType?: string): Blob {
    return this.#content.slice(start, end, contentType);
  }

  /**
   * Returns a stream that can be used to read the blob's contents.
   *
   * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/Blob/stream)
   */
  stream(): ReadableStream<Uint8Array> {
    return this.#content.stream();
  }

  /**
   * Returns the blob's contents as a string.
   *
   * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/Blob/text)
   */
  async text(): Promise<string> {
    return this.#content.text();
  }
}

export interface LazyFileOptions extends LazyBlobOptions {
  /**
   * The last modified timestamp of the file in milliseconds. Defaults to `Date.now()`.
   *
   * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/File/File#lastmodified)
   */
  lastModified?: number;
}

/**
 * A `File` that may be backed by a stream of data. This is useful for working with large files that
 * would be impractical to load into memory all at once.
 *
 * This class is an extension of JavaScript's built-in `File` class with the following additions:
 *
 * - The constructor may accept a `LazyContent` object instead of a `BlobPart[]` array
 * - The constructor may accept a `range` in the options to specify a subset of the content
 *
 * In normal usage you shouldn't have to specify the `range` yourself. The `slice()` method
 * automatically takes care of creating new `LazyBlob` instances with the correct range.
 *
 * [MDN `File` Reference](https://developer.mozilla.org/en-US/docs/Web/API/File)
 */
export class LazyFile extends File {
  readonly #content: BlobContent;

  constructor(parts: BlobPart[] | LazyContent, name: string, options?: LazyFileOptions) {
    super([], name, options);
    this.#content = new BlobContent(parts, options);
  }

  /**
   * Returns the file's content as an `ArrayBuffer`.
   *
   * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/Blob/arrayBuffer)
   */
  async arrayBuffer(): Promise<ArrayBuffer> {
    return this.#content.arrayBuffer();
  }

  /**
   * Returns the file's contents as a byte array.
   *
   * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/Blob/bytes)
   */
  async bytes(): Promise<Uint8Array> {
    return this.#content.bytes();
  }

  /**
   * The size of the file in bytes.
   *
   * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/Blob/size)
   */
  get size(): number {
    return this.#content.size;
  }

  /**
   * Returns a new `Blob` that contains the data in the specified range.
   *
   * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/Blob/slice)
   */
  slice(start?: number, end?: number, contentType?: string): Blob {
    return this.#content.slice(start, end, contentType);
  }

  /**
   * Returns a stream that can be used to read the file's contents.
   *
   * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/Blob/stream)
   */
  stream(): ReadableStream<Uint8Array> {
    return this.#content.stream();
  }

  /**
   * Returns the file's contents as a string.
   *
   * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/Blob/text)
   */
  async text(): Promise<string> {
    return this.#content.text();
  }
}

class BlobContent {
  readonly source: (Blob | Uint8Array)[] | LazyContent;
  readonly totalSize: number;
  readonly range?: ByteRange;
  readonly type: string;

  constructor(parts: BlobPart[] | LazyContent, options?: LazyBlobOptions) {
    if (Array.isArray(parts)) {
      this.source = [];
      this.totalSize = 0;

      for (let part of parts) {
        if (part instanceof Blob) {
          this.source.push(part);
          this.totalSize += part.size;
        } else {
          let array: Uint8Array;
          if (typeof part === 'string') {
            array = new TextEncoder().encode(part);
          } else if (ArrayBuffer.isView(part)) {
            array = new Uint8Array(part.buffer, part.byteOffset, part.byteLength);
          } else {
            array = new Uint8Array(part);
          }

          this.source.push(array);
          this.totalSize += array.byteLength;
        }
      }
    } else {
      this.source = parts;
      this.totalSize = parts.byteLength;
    }

    this.range = options?.range;
    this.type = options?.type ?? '';
  }

  async arrayBuffer(): Promise<ArrayBuffer> {
    return (await this.bytes()).buffer;
  }

  async bytes(): Promise<Uint8Array> {
    let result = new Uint8Array(this.size);

    let offset = 0;
    for await (let chunk of this.stream()) {
      result.set(chunk, offset);
      offset += chunk.length;
    }

    return result;
  }

  get size(): number {
    return this.range != null ? getByteLength(this.range, this.totalSize) : this.totalSize;
  }

  slice(start = 0, end?: number, contentType = ''): LazyBlob {
    let range: ByteRange =
      this.range != null
        ? // file.slice().slice() is additive
          { start: this.range.start + start, end: this.range.end + (end ?? 0) }
        : { start, end: end ?? this.size };

    return new LazyBlob(this.source, { range, type: contentType });
  }

  stream(): ReadableStream<Uint8Array> {
    if (this.range != null) {
      let [start, end] = getIndexes(this.range, this.totalSize);
      return Array.isArray(this.source)
        ? streamContentArray(this.source, start, end)
        : this.source.stream(start, end);
    }

    return Array.isArray(this.source) ? streamContentArray(this.source) : this.source.stream();
  }

  async text(): Promise<string> {
    return new TextDecoder('utf-8').decode(await this.bytes());
  }
}

function streamContentArray(
  content: (Blob | Uint8Array)[],
  start = 0,
  end = Infinity,
): ReadableStream<Uint8Array> {
  let index = 0;
  let bytesRead = 0;

  return new ReadableStream({
    async pull(controller) {
      if (index >= content.length) {
        controller.close();
        return;
      }

      let hasPushed = false;

      function pushChunk(chunk: Uint8Array) {
        let chunkLength = chunk.byteLength;

        if (!(bytesRead + chunkLength < start || bytesRead >= end)) {
          let startIndex = Math.max(start - bytesRead, 0);
          let endIndex = Math.min(end - bytesRead, chunkLength);
          controller.enqueue(chunk.subarray(startIndex, endIndex));
          hasPushed = true;
        }

        bytesRead += chunkLength;
      }

      async function pushPart(part: Blob | Uint8Array) {
        if (part instanceof Blob) {
          if (bytesRead + part.size <= start) {
            // We can skip this part entirely.
            bytesRead += part.size;
            return;
          }

          for await (let chunk of part.stream()) {
            pushChunk(chunk);

            if (bytesRead >= end) {
              // We can stop reading now.
              break;
            }
          }
        } else {
          pushChunk(part);
        }
      }

      while (!hasPushed && index < content.length) {
        await pushPart(content[index++]);

        if (bytesRead >= end) {
          controller.close();
          break;
        }
      }
    },
  });
}
