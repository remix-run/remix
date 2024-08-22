import { ByteRange, getByteLength, getIndexes } from "./byte-range.js";

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
 * A `File` that is backed by a stream of data. This is useful for working with large files that
 * would be impractical to load into memory all at once.
 */
export class LazyFile extends File {
  readonly #content: (Blob | Uint8Array)[] | LazyFileContent;
  readonly #contentSize: number;
  readonly #props?: FilePropertyBag;
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

    this.#props = props;
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
   * Returns a new `File` object that contains the data in the specified range.
   *
   * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/Blob/slice)
   */
  slice(start = 0, end = Infinity, contentType = ""): File {
    let range = { start, end };

    if (this.#range != null) {
      // file.slice().slice() is additive
      range = {
        start: this.#range.start + start,
        end: this.#range.end === Infinity ? end : this.#range.end + end
      };
    }

    let props = { ...this.#props, type: contentType };

    return new LazyFile(this.#content, this.name, props, range);
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
        ? streamContent(this.#content, start, end)
        : this.#content.read(start, end);
    }

    return Array.isArray(this.#content)
      ? streamContent(this.#content)
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

  [Symbol.asyncIterator](): AsyncIterableIterator<Uint8Array> {
    return this.stream()[Symbol.asyncIterator]();
  }
}

function streamContent(
  content: (Blob | Uint8Array)[],
  start = 0,
  end = Infinity
): ReadableStream<Uint8Array> {
  if (end < start) {
    throw new RangeError(
      "The end index must be greater than or equal to the start index"
    );
  }

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
          }
        } else {
          pushChunk(part);
        }
      }

      while (!hasPushed && index < content.length) {
        await pushPart(content[index++]);
      }
    }
  });
}
