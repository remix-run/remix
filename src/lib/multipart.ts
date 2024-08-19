import Headers from '@mjackson/headers';

import {
  SearchFunction,
  createSearch,
  PartialTailSearchFunction,
  createPartialTailSearch,
} from './search.js';

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
  return contentType != null && contentType.startsWith('multipart/');
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
  message:
    | ReadableStream<Uint8Array>
    | Uint8Array
    | Iterable<Uint8Array>
    | AsyncIterable<Uint8Array>,
  boundary: string,
  options?: MultipartParserOptions,
): AsyncGenerator<MultipartPart> {
  let parser = new MultipartParser(boundary, options);

  let parts: MultipartPart[] = [];
  let resolveNext: (() => void) | null = null;
  let parseError: Error | null = null;
  let done = false;

  parser
    .parse(message, (part) => {
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

const findDoubleNewline = createSearch('\r\n\r\n');

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
  maxHeaderSize: number;
  maxFileSize: number;

  #findOpeningBoundary: SearchFunction;
  #openingBoundaryLength: number;

  #findBoundary: SearchFunction;
  #findPartialTailBoundary: PartialTailSearchFunction;
  #boundaryLength: number;

  #state = MultipartParserState.Start;
  #buffer: Uint8Array | null = null;
  #bodyController: ReadableStreamDefaultController<Uint8Array> | null = null;
  #bodyLength = 0;

  constructor(
    boundary: string,
    {
      maxHeaderSize = 8 * 1024, // 8 KB
      maxFileSize = Infinity,
    }: MultipartParserOptions = {},
  ) {
    this.boundary = boundary;
    this.maxHeaderSize = maxHeaderSize;
    this.maxFileSize = maxFileSize;

    this.#findOpeningBoundary = createSearch(`--${boundary}`);
    this.#openingBoundaryLength = 2 + boundary.length; // length of '--' + boundary

    this.#findBoundary = createSearch(`\r\n--${boundary}`);
    this.#findPartialTailBoundary = createPartialTailSearch(`\r\n--${boundary}`);
    this.#boundaryLength = 4 + boundary.length; // length of '\r\n--' + boundary
  }

  /**
   * Parse a stream/buffer multipart message and call the given handler for each part it contains.
   * Resolves when the parse is finished and all handlers resolve.
   */
  async parse(
    message:
      | ReadableStream<Uint8Array>
      | Uint8Array
      | Iterable<Uint8Array>
      | AsyncIterable<Uint8Array>,
    handler: (part: MultipartPart) => void,
  ): Promise<void> {
    if (this.#state !== MultipartParserState.Start) {
      this.#reset();
    }

    let results: unknown[] = [];

    function handlePart(part: MultipartPart): void {
      results.push(handler(part));
    }

    if (message instanceof ReadableStream || isAsyncIterable(message)) {
      for await (let chunk of message) {
        this.#write(chunk, handlePart);
      }
    } else if (message instanceof Uint8Array) {
      this.#write(message, handlePart);
    } else if (isIterable(message)) {
      for (let chunk of message) {
        this.#write(chunk, handlePart);
      }
    } else {
      throw new TypeError('Cannot parse multipart message; expected a stream or buffer');
    }

    if (this.#state !== MultipartParserState.Done) {
      throw new MultipartParseError('Unexpected end of stream');
    }

    await Promise.all(results);
  }

  #reset(): void {
    this.#state = MultipartParserState.Start;
    this.#buffer = null;
    this.#bodyController = null;
    this.#bodyLength = 0;
  }

  #write(chunk: Uint8Array, handler: (part: MultipartPart) => void): void {
    if (this.#state === MultipartParserState.Done) {
      throw new MultipartParseError('Unexpected data after end of stream');
    }

    let index = 0;
    let chunkLength = chunk.length;

    if (this.#buffer !== null) {
      let newChunk = new Uint8Array(this.#buffer.length + chunkLength);
      newChunk.set(this.#buffer, 0);
      newChunk.set(chunk, this.#buffer.length);
      chunk = newChunk;
      chunkLength = chunk.length;
      this.#buffer = null;
    }

    while (true) {
      if (this.#state === MultipartParserState.Body) {
        if (chunkLength - index < this.#boundaryLength) {
          this.#buffer = chunk.subarray(index);
          break;
        }

        let boundaryIndex = this.#findBoundary(chunk, index);

        if (boundaryIndex === -1) {
          // No boundary found, but there may be a partial match at the end of the chunk.
          let partialTailIndex = this.#findPartialTailBoundary(chunk);

          if (partialTailIndex === -1) {
            this.#writeBody(index === 0 ? chunk : chunk.subarray(index));
          } else {
            this.#writeBody(chunk.subarray(index, partialTailIndex));
            this.#buffer = chunk.subarray(partialTailIndex);
          }

          break;
        }

        this.#writeBody(chunk.subarray(index, boundaryIndex));
        this.#closeBody();

        index = boundaryIndex + this.#boundaryLength;

        this.#state = MultipartParserState.AfterBoundary;
      }

      if (this.#state === MultipartParserState.AfterBoundary) {
        if (chunkLength - index < 2) {
          this.#buffer = chunk.subarray(index);
          break;
        }

        if (chunk[index] === 45 && chunk[index + 1] === 45) {
          this.#state = MultipartParserState.Done;
          break;
        }

        index += 2; // Skip \r\n after boundary

        this.#state = MultipartParserState.Header;
      }

      if (this.#state === MultipartParserState.Header) {
        if (chunkLength - index < 4) {
          this.#buffer = chunk.subarray(index);
          break;
        }

        let headerEndIndex = findDoubleNewline(chunk, index);

        if (headerEndIndex === -1) {
          if (chunkLength - index > this.maxHeaderSize) {
            throw new MultipartParseError(
              `Header size exceeds maximum allowed size of ${this.maxHeaderSize} bytes`,
            );
          }

          this.#buffer = chunk.subarray(index);
          break;
        }

        if (headerEndIndex - index > this.maxHeaderSize) {
          throw new MultipartParseError(
            `Header size exceeds maximum allowed size of ${this.maxHeaderSize} bytes`,
          );
        }

        let header = chunk.subarray(index, headerEndIndex);
        let part = new MultipartPart(
          header,
          new ReadableStream({
            start: (controller) => {
              this.#bodyController = controller;
            },
          }),
        );

        handler(part);

        index = headerEndIndex + 4; // Skip header + \r\n\r\n

        this.#state = MultipartParserState.Body;

        continue;
      }

      if (this.#state === MultipartParserState.Start) {
        if (chunkLength < this.#openingBoundaryLength) {
          this.#buffer = chunk;
          break;
        }

        if (this.#findOpeningBoundary(chunk) !== 0) {
          throw new MultipartParseError('Invalid multipart stream: missing initial boundary');
        }

        index = this.#openingBoundaryLength;

        this.#state = MultipartParserState.AfterBoundary;
      }
    }
  }

  #writeBody(chunk: Uint8Array): void {
    if (this.#bodyLength + chunk.length > this.maxFileSize) {
      let error = new MultipartParseError(
        `File size exceeds maximum allowed size of ${this.maxFileSize} bytes`,
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
