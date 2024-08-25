import { ByteRange, getByteLength, getIndexes } from "./byte-range.js";

/**
 * A streaming interface for file content.
 */
export interface LazyFileContent {
  /**
   * The total length of the content.
   */
  byteLength: number;
  /**
   * Returns a stream that can be used to read the content, optionally within a given `start`
   * (inclusive) and `end` (exclusive) index.
   */
  read(start?: number, end?: number): ReadableStream<Uint8Array>;
}

/**
 * A `File` that may be backed by a stream of data. This is useful for working with large files that
 * would be impractical to load into memory all at once.
 *
 * This class is an extension of JavaScript's built-in `File` class with the following additions:
 *
 * - The constructor may accept a regular string or a `LazyFileContent` object
 * - The constructor may accept a `ByteRange` to represent a subset of the file's content
 *
 * In normal usage you shouldn't have to manage the `ByteRange` yourself. The `slice()` method takes
 * care of creating new `LazyFile` instances with the correct range.
 *
 * [MDN `File` Reference](https://developer.mozilla.org/en-US/docs/Web/API/File)
 */
export class LazyFile extends File {
  readonly #content: (Blob | Uint8Array)[] | LazyFileContent;
  readonly #contentSize: number;
  readonly #range?: ByteRange;

  constructor(
    content: BlobPart[] | string | LazyFileContent,
    name: string,
    props?: FilePropertyBag,
    range?: ByteRange
  ) {
    super([], name, props);

    if (Array.isArray(content)) {
      this.#content = [];
      this.#contentSize = 0;

      for (let part of content) {
        if (part instanceof Blob) {
          this.#content.push(part);
          this.#contentSize += part.size;
        } else {
          let array: Uint8Array;
          if (typeof part === "string") {
            array = new TextEncoder().encode(part);
          } else if (ArrayBuffer.isView(part)) {
            array = new Uint8Array(
              part.buffer,
              part.byteOffset,
              part.byteLength
            );
          } else {
            array = new Uint8Array(part);
          }
          this.#content.push(array);
          this.#contentSize += array.byteLength;
        }
      }
    } else if (typeof content === "string") {
      let array = new TextEncoder().encode(content);
      this.#content = [array];
      this.#contentSize = array.byteLength;
    } else {
      this.#content = content;
      this.#contentSize = content.byteLength;
    }

    this.#range = range;
  }

  /**
   * Returns the file's contents as an array buffer.
   *
   * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/Blob/arrayBuffer)
   */
  async arrayBuffer(): Promise<ArrayBuffer> {
    return (await this.bytes()).buffer;
  }

  /**
   * Returns the file's contents as a byte array.
   *
   * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/Blob/bytes)
   */
  async bytes(): Promise<Uint8Array> {
    let result = new Uint8Array(this.size);

    let offset = 0;
    for await (let chunk of this.stream()) {
      result.set(chunk, offset);
      offset += chunk.length;
    }

    return result;
  }

  /**
   * The size of the file in bytes.
   *
   * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/Blob/size)
   */
  get size(): number {
    return this.#range != null
      ? getByteLength(this.#range, this.#contentSize)
      : this.#contentSize;
  }

  /**
   * Returns a new file that contains the data in the specified range.
   *
   * Note: The built-in Blob constructor does not support streaming content or provide a way to
   * store and retrieve the content range, so this method differs slightly from the native
   * `Blob.slice()`. Instead of returning a name-less `Blob`, this method returns a new `LazyFile`
   * (which is a `Blob`) of the same name with the range applied.
   *
   * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/Blob/slice)
   */
  slice(start = 0, end?: number, contentType = ""): LazyFile {
    let range: ByteRange | undefined;
    if (this.#range != null) {
      // file.slice().slice() is additive
      range = {
        start: this.#range.start + start,
        end: this.#range.end + (end ?? 0)
      };
    } else {
      range = { start, end: end ?? this.size };
    }

    return new LazyFile(this.#content, this.name, { type: contentType }, range);
  }

  /**
   * Returns a stream that can be used to read the file's contents.
   *
   * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/Blob/stream)
   */
  stream(): ReadableStream<Uint8Array> {
    if (this.#range != null) {
      let [start, end] = getIndexes(this.#range, this.#contentSize);
      return Array.isArray(this.#content)
        ? streamContentArray(this.#content, start, end)
        : this.#content.read(start, end);
    }

    return Array.isArray(this.#content)
      ? streamContentArray(this.#content)
      : this.#content.read();
  }

  /**
   * Returns the file's contents as a string.
   *
   * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/Blob/text)
   */
  async text(): Promise<string> {
    return new TextDecoder("utf-8").decode(await this.bytes());
  }
}

function streamContentArray(
  content: (Blob | Uint8Array)[],
  start = 0,
  end = Infinity
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
    }
  });
}
