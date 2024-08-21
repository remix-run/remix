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
  #content: LazyFileContent;
  #props?: FilePropertyBag;
  #range?: ByteRange;

  constructor(
    content: LazyFileContent,
    name: string,
    props?: FilePropertyBag,
    range?: ByteRange
  ) {
    super([], name, props);
    this.#content = content;
    this.#props = props;
    this.#range = range;
  }

  /**
   * The size of the file in bytes.
   *
   * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/Blob/size)
   */
  get size(): number {
    return this.#range != null
      ? getByteLength(this.#range, this.#content.byteLength)
      : this.#content.byteLength;
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
      let [start, end] = getIndexes(this.#range, this.#content.byteLength);
      return this.#content.read(start, end);
    }

    return this.#content.read();
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
