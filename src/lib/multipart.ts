import { SuperHeaders } from 'fetch-super-headers';

import { concat, computeSkipTable, combinedIndexOf } from './buffer-utils.js';

/**
 * Extracts the boundary string from a `multipart/*` content type.
 */
export function getMultipartBoundary(contentType: string): string | null {
  let match = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType);
  return match ? (match[1] ?? match[2]) : null;
}

/**
 * Returns true if the given request contains multipart data.
 */
export function isMultipartRequest(request: Request): boolean {
  let contentType = request.headers.get('Content-Type');
  return contentType != null && /^multipart\//i.test(contentType);
}

/**
 * Parse a multipart [`Request`](https://developer.mozilla.org/en-US/docs/Web/API/Request) and yield each part as
 * a `MultipartPart` object. Useful in HTTP server contexts for handling incoming `multipart/*` requests.
 */
export async function* parseMultipartRequest(
  request: Request,
  options?: MultipartParserOptions,
): AsyncGenerator<MultipartPart> {
  if (!isMultipartRequest(request)) {
    throw new MultipartParseError('Request is not a multipart request');
  }
  if (!request.body) {
    throw new MultipartParseError('Request body is empty');
  }

  let boundary = getMultipartBoundary(request.headers.get('Content-Type')!);
  if (!boundary) {
    throw new MultipartParseError('Invalid Content-Type header: missing boundary');
  }

  yield* parseMultipart(request.body, boundary, options);
}

/**
 * Parse a `multipart/*` buffer or stream and yield each part it finds as a `MultipartPart` object.
 *
 * Note: This is a low-level API that requires manual handling of the stream and boundary. If you're
 * building a web server, consider using `parseMultipartRequest(request)` instead.
 */
export async function* parseMultipart(
  data: ReadableStream<Uint8Array> | Uint8Array | Iterable<Uint8Array> | AsyncIterable<Uint8Array>,
  boundary: string,
  options?: MultipartParserOptions,
): AsyncGenerator<MultipartPart> {
  let parser = new MultipartParser(boundary, options);

  let parts: MultipartPart[] = [];
  let resolveNext: (() => void) | null = null;
  let done = false;

  let parse = parser
    .parse(data, (part) => {
      parts.push(part);
      if (resolveNext) {
        resolveNext();
        resolveNext = null;
      }
    })
    .finally(() => {
      done = true;
      if (resolveNext) resolveNext();
    });

  while (!done) {
    if (parts.length === 0) {
      await new Promise<void>((resolve) => {
        resolveNext = resolve;
      });
    }

    while (parts.length > 0) {
      yield parts.shift()!;
    }
  }

  await parse;
}

const HYPHEN = 45;
const EMPTY_BUFFER = new Uint8Array(0);
const DOUBLE_NEWLINE = new Uint8Array([13, 10, 13, 10]);
const DOUBLE_NEWLINE_SKIP_TABLE = computeSkipTable(DOUBLE_NEWLINE);

export class MultipartParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MultipartParseError';
  }
}

export interface MultipartParserOptions {
  maxHeaderSize?: number;
  maxFileSize?: number;
}

enum MultipartParserState {
  Start = 0,
  AfterBoundary = 1,
  Header = 2,
  Body = 3,
  Done = 4,
}

/**
 * A parser for `multipart/*` HTTP messages.
 */
export class MultipartParser {
  boundary: string;

  #boundaryArray: Uint8Array;
  #boundaryLength: number;
  #boundarySkipTable: Uint8Array;
  #maxHeaderSize: number;
  #maxFileSize: number;

  #state = MultipartParserState.Start;
  #buffer: Uint8Array = EMPTY_BUFFER;
  #chunk: Uint8Array = EMPTY_BUFFER;
  #length = 0;

  #bodyController: ReadableStreamDefaultController<Uint8Array> | null = null;
  #bodyLength = 0;

  constructor(
    boundary: string,
    {
      maxHeaderSize = 8 * 1024, // 8 KB
      maxFileSize = 10 * 1024 * 1024, // 10 MB
    }: MultipartParserOptions = {},
  ) {
    this.boundary = boundary;
    this.#boundaryArray = new TextEncoder().encode(`--${boundary}`);
    this.#boundaryLength = this.#boundaryArray.length;
    this.#boundarySkipTable = computeSkipTable(this.#boundaryArray);
    this.#maxHeaderSize = maxHeaderSize;
    this.#maxFileSize = maxFileSize;
  }

  /**
   * True if the parser has finished parsing the stream and found the closing multipart boundary.
   */
  get done(): boolean {
    return this.#state === MultipartParserState.Done;
  }

  /**
   * Parse a buffer or stream of multipart data and call the given handler for each part it contains.
   * Resolves when the parse is done and all handlers are finished.
   */
  async parse(
    data:
      | ReadableStream<Uint8Array>
      | Uint8Array
      | Iterable<Uint8Array>
      | AsyncIterable<Uint8Array>,
    handler: (part: MultipartPart) => void,
  ): Promise<void> {
    this.reset();

    let results = [];

    if (data instanceof ReadableStream) {
      let reader = data.getReader();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          for (let part of this.push(value)) {
            results.push(handler(part));
          }
        }
      } finally {
        reader.releaseLock();
      }
    } else if (data instanceof Uint8Array) {
      for (let part of this.push(data)) {
        results.push(handler(part));
      }
    } else if (isIterable(data)) {
      for (let chunk of data) {
        for (let part of this.push(chunk)) {
          results.push(handler(part));
        }
      }
    } else if (isAsyncIterable(data)) {
      for await (let chunk of data) {
        for (let part of this.push(chunk)) {
          results.push(handler(part));
        }
      }
    } else {
      throw new TypeError('Cannot parse data: expected a stream or buffer');
    }

    if (!this.done) {
      throw new MultipartParseError('Unexpected end of stream');
    }

    await Promise.all(results);
  }

  /**
   * Push a new chunk of data into the parser and return any parts it contains.
   */
  push(chunk: Uint8Array): MultipartPart[] {
    if (this.done) {
      throw new MultipartParseError('Cannot push, parser is done');
    }

    this.#chunk = chunk;
    this.#length = this.#buffer.length + this.#chunk.length;

    if (this.#state === MultipartParserState.Start) {
      if (this.#length < this.#boundaryLength) {
        this.#save();
        return [];
      }

      let boundaryIndex = combinedIndexOf(
        this.#buffer,
        this.#chunk,
        this.#boundaryArray,
        this.#boundarySkipTable,
      );
      if (boundaryIndex !== 0) {
        throw new MultipartParseError('Invalid multipart stream: missing initial boundary');
      }

      this.#skip(this.#boundaryLength);

      this.#state = MultipartParserState.AfterBoundary;
    }

    let parts: MultipartPart[] = [];

    while (true) {
      if (this.#state === MultipartParserState.AfterBoundary) {
        if (this.#length < 2) {
          this.#save();
          break;
        }

        // If the next two bytes are "--" then we're done; this is the closing boundary. Otherwise
        // they're the \r\n after a boundary in the middle of the message and we can ignore them.
        let twoBytes = this.#read(2);
        if (
          (twoBytes.length === 1 && twoBytes[0][0] === HYPHEN && twoBytes[0][1] === HYPHEN) ||
          (twoBytes[0][0] === HYPHEN && twoBytes[1][0] === HYPHEN)
        ) {
          // Discard any remaining data in the current buffer/chunk so we don't leak memory.
          this.#buffer = EMPTY_BUFFER;
          this.#chunk = EMPTY_BUFFER;

          this.#state = MultipartParserState.Done;
          break;
        }

        this.#state = MultipartParserState.Header;
      }

      if (this.#state === MultipartParserState.Header) {
        if (this.#length < 4) {
          this.#save();
          break;
        }

        let headerEndIndex = combinedIndexOf(
          this.#buffer,
          this.#chunk,
          DOUBLE_NEWLINE,
          DOUBLE_NEWLINE_SKIP_TABLE,
        );
        if (headerEndIndex === -1) break;
        if (headerEndIndex > this.#maxHeaderSize) {
          throw new MultipartParseError(
            `Header size exceeds maximum allowed size of ${this.#maxHeaderSize} bytes`,
          );
        }

        let header = concat(this.#read(headerEndIndex));
        this.#skip(4); // Skip \r\n\r\n

        let body = new ReadableStream({
          start: (controller) => {
            this.#bodyController = controller;
          },
        });

        parts.push(new MultipartPart(header, body));

        this.#state = MultipartParserState.Body;
      }

      if (this.#state === MultipartParserState.Body) {
        if (this.#length < this.#boundaryLength) {
          this.#save();
          break;
        }

        let boundaryIndex = combinedIndexOf(
          this.#buffer,
          this.#chunk,
          this.#boundaryArray,
          this.#boundarySkipTable,
        );

        if (boundaryIndex === -1) {
          // Write as much of the buffer as we can to the current body stream while still
          // keeping enough to check if the last few bytes are part of the boundary.
          this.#writeBody(this.#read(this.#length - this.#boundaryLength + 1));
          this.#save();
          break;
        }

        if (boundaryIndex > 2) {
          this.#writeBody(this.#read(boundaryIndex - 2)); // -2 to avoid \r\n before boundary
        }
        this.#closeBody();

        this.#skip(2 + this.#boundaryLength); // Skip \r\n + boundary

        this.#state = MultipartParserState.AfterBoundary;
      }
    }

    return parts;
  }

  /**
   * Reset the internal state of the parser.
   */
  reset(): void {
    this.#state = MultipartParserState.Start;
    this.#buffer = EMPTY_BUFFER;
    this.#chunk = EMPTY_BUFFER;
    this.#length = 0;
    this.#bodyController = null;
    this.#bodyLength = 0;
  }

  #read(size: number): Uint8Array[] {
    this.#length -= size;

    if (size > this.#buffer.length) {
      if (this.#buffer.length > 0) {
        let head = this.#buffer;
        this.#buffer = EMPTY_BUFFER;
        let tail = this.#chunk.subarray(0, size - head.length);
        this.#chunk = this.#chunk.subarray(size - head.length);
        return [head, tail];
      }

      let view = this.#chunk.subarray(0, size);
      this.#chunk = this.#chunk.subarray(size);
      return [view];
    }

    let view = this.#buffer.subarray(0, size);
    this.#buffer = this.#buffer.subarray(size);
    return [view];
  }

  #skip(size: number): void {
    this.#length -= size;

    if (size > this.#buffer.length) {
      this.#chunk = this.#chunk.subarray(size - this.#buffer.length);
      this.#buffer = EMPTY_BUFFER;
    } else {
      this.#buffer = this.#buffer.subarray(size);
    }
  }

  #save(): void {
    if (this.#chunk.length === 0) return;
    this.#buffer = this.#buffer.length > 0 ? concat([this.#buffer, this.#chunk]) : this.#chunk;
  }

  #writeBody(chunks: Uint8Array[]): void {
    for (let chunk of chunks) {
      if (this.#bodyLength + chunk.length > this.#maxFileSize) {
        throw new MultipartParseError(
          `File size exceeds maximum allowed size of ${this.#maxFileSize} bytes`,
        );
      }

      this.#bodyController!.enqueue(chunk);
      this.#bodyLength += chunk.length;
    }
  }

  #closeBody(): void {
    this.#bodyController!.close();
    this.#bodyController = null;
    this.#bodyLength = 0;
  }
}

function isIterable<T>(value: unknown): value is Iterable<T> {
  return typeof value === 'object' && value != null && Symbol.iterator in value;
}

function isAsyncIterable<T>(value: unknown): value is AsyncIterable<T> {
  return typeof value === 'object' && value != null && Symbol.asyncIterator in value;
}

/**
 * A part of a `multipart/*` HTTP message.
 */
export class MultipartPart {
  #header: Uint8Array;
  #body: ReadableStream<Uint8Array>;

  #headers?: SuperHeaders;
  #bodyUsed = false;

  constructor(header: Uint8Array, body: ReadableStream<Uint8Array>) {
    this.#header = header;
    this.#body = body;
  }

  /**
   * The content of this part as an `ArrayBuffer`.
   */
  async arrayBuffer(): Promise<ArrayBufferLike> {
    return (await this.bytes()).buffer;
  }

  /**
   * The body of this part as a `ReadableStream<Uint8Array>`. In `multipart/form-data` messages, this is useful
   * for streaming the value of files that were uploaded using `<input type="file">` fields.
   */
  get body(): ReadableStream<Uint8Array> {
    return this.#body;
  }

  /**
   * Whether the body of this part has been consumed.
   */
  get bodyUsed(): boolean {
    return this.#bodyUsed;
  }

  /**
   * The body of this part buffered into a single `Uint8Array`. In `multipart/form-data` messages, this is useful
   * for reading the value of files that were uploaded using `<input type="file">` fields.
   */
  async bytes(): Promise<Uint8Array> {
    if (this.#bodyUsed) {
      throw new Error('Body is already consumed or is being consumed');
    }

    this.#bodyUsed = true;

    let reader = this.#body.getReader();
    let chunks: Uint8Array[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    reader.releaseLock();

    return concat(chunks);
  }

  /**
   * The headers associated with this part.
   */
  get headers(): SuperHeaders {
    if (!this.#headers) {
      this.#headers = new SuperHeaders(new TextDecoder().decode(this.#header));
    }

    return this.#headers;
  }

  /**
   * True if this part originated from a file upload.
   */
  get isFile(): boolean {
    return this.filename !== undefined;
  }

  /**
   * The filename of the part, if it is a file upload.
   */
  get filename(): string | undefined {
    return this.headers.contentDisposition.preferredFilename;
  }

  /**
   * The media type of the part.
   */
  get mediaType(): string | undefined {
    return this.headers.contentType.mediaType;
  }

  /**
   * The name of the part, usually the `name` of the field in the `<form>` that submitted the request.
   */
  get name(): string | undefined {
    return this.headers.contentDisposition.name;
  }

  /**
   * The body of the part as a string. In `multipart/form-data` messages, this is useful for reading the value
   * of parts that originated from `<input type="text">` fields.
   *
   * Note: Do not use this for binary data, use `await part.bytes()` or stream `part.body` directly instead.
   */
  async text(): Promise<string> {
    return new TextDecoder().decode(await this.bytes());
  }
}
