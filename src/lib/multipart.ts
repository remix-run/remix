import Headers from '@mjackson/headers';

import { BufferSearch, createSearch } from './buffer-search.js';

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
  let parseError: Error | null = null;
  let done = false;

  parser
    .parse(data, (part) => {
      parts.push(part);
      if (resolveNext) {
        resolveNext();
        resolveNext = null;
      }
    })
    .catch((error) => {
      parseError = error;
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

  if (parseError) {
    throw parseError;
  }
}

const EMPTY_BUFFER = new Uint8Array(0);
const doubleNewlineSearch = createSearch('\r\n\r\n');

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

const enum MultipartParserState {
  Start,
  AfterBoundary,
  Header,
  Body,
  Done,
}

/**
 * A parser for `multipart/*` HTTP messages.
 */
export class MultipartParser {
  boundary: string;

  #boundarySearch: BufferSearch;
  #boundaryLength: number;
  #maxHeaderSize: number;
  #maxFileSize: number;

  #state = MultipartParserState.Start;
  #buffer: Uint8Array = EMPTY_BUFFER;
  #bufferLength = 0;

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
    this.#boundarySearch = createSearch(`--${boundary}`);
    this.#boundaryLength = 2 + boundary.length; // +2 for leading "--"
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

    if (data instanceof ReadableStream || isAsyncIterable(data)) {
      for await (let chunk of data) {
        for (let part of this.push(chunk)) {
          results.push(handler(part));
        }
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

    if (this.#bufferLength > 0) {
      let newBuffer = new Uint8Array(this.#bufferLength + chunk.length);
      newBuffer.set(this.#buffer, 0);
      newBuffer.set(chunk, this.#bufferLength);
      this.#buffer = newBuffer;
      this.#bufferLength += chunk.length;
    } else {
      this.#buffer = chunk;
      this.#bufferLength = chunk.length;
    }

    if (this.#state === MultipartParserState.Start) {
      if (this.#bufferLength < this.#boundaryLength) {
        return [];
      }

      let boundaryIndex = this.#boundarySearch.indexIn(this.#buffer);
      if (boundaryIndex !== 0) {
        throw new MultipartParseError('Invalid multipart stream: missing initial boundary');
      }

      this.#skip(this.#boundaryLength); // Skip initial boundary

      this.#state = MultipartParserState.AfterBoundary;
    }

    let parts: MultipartPart[] = [];

    while (true) {
      if (this.#state === MultipartParserState.AfterBoundary) {
        if (this.#bufferLength < 2) {
          break;
        }

        // If the next two bytes are "--" then we're done; this is the closing boundary. Otherwise
        // they're the \r\n after a boundary in the middle of the message and we can ignore them.
        let nextTwoBytes = this.#read(2);
        if (nextTwoBytes[0] === 45 && nextTwoBytes[1] === 45) {
          this.#buffer = EMPTY_BUFFER; // Don't leak memory
          this.#state = MultipartParserState.Done;
          break;
        }

        this.#state = MultipartParserState.Header;
      }

      if (this.#state === MultipartParserState.Header) {
        if (this.#bufferLength < 4) {
          break;
        }

        let headerEndIndex = doubleNewlineSearch.indexIn(this.#buffer);
        if (headerEndIndex === -1) {
          break; // No \r\n\r\n found
        }

        if (headerEndIndex > this.#maxHeaderSize) {
          throw new MultipartParseError(
            `Header size exceeds maximum allowed size of ${this.#maxHeaderSize} bytes`,
          );
        }

        let header = this.#read(headerEndIndex);
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
        if (this.#bufferLength < this.#boundaryLength) {
          break;
        }

        let boundaryIndex = this.#boundarySearch.indexIn(this.#buffer);

        if (boundaryIndex === -1) {
          // No boundary found, but we might have a partial match at the end of the buffer.
          let endPartialIndex = this.#boundarySearch.endPartialIndexIn(this.#buffer);

          if (endPartialIndex === -1) {
            this.#writeBody(this.#buffer);
            this.#buffer = EMPTY_BUFFER;
            this.#bufferLength = 0;
          } else {
            let chunkSize = endPartialIndex - 2; // -2 to avoid \r\n before boundary
            if (chunkSize > 0) {
              this.#writeBody(this.#read(chunkSize));
            }
          }

          break;
        }

        let chunkSize = boundaryIndex - 2; // -2 to avoid \r\n before boundary
        if (chunkSize > 0) {
          this.#writeBody(this.#read(chunkSize));
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
    this.#bufferLength = 0;
    this.#bodyController = null;
    this.#bodyLength = 0;
  }

  #read(size: number): Uint8Array {
    let chunk = this.#buffer.subarray(0, size);
    this.#skip(size);
    return chunk;
  }

  #skip(size: number): void {
    this.#buffer = this.#buffer.subarray(size);
    this.#bufferLength -= size;
  }

  #writeBody(chunk: Uint8Array): void {
    if (this.#bodyLength + chunk.length > this.#maxFileSize) {
      let error = new MultipartParseError(
        `File size exceeds maximum allowed size of ${this.#maxFileSize} bytes`,
      );

      this.#bodyController!.error(error);

      throw error;
    }

    this.#bodyController!.enqueue(chunk);
    this.#bodyLength += chunk.length;
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

  #headers?: Headers;
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

    let chunks: Uint8Array[] = [];
    let totalLength = 0;
    for await (let chunk of this.#body) {
      chunks.push(chunk);
      totalLength += chunk.length;
    }

    let result = new Uint8Array(totalLength);
    let offset = 0;
    for (let chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }

    return result;
  }

  /**
   * The headers associated with this part.
   */
  get headers(): Headers {
    if (!this.#headers) {
      this.#headers = new Headers(new TextDecoder().decode(this.#header));
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
