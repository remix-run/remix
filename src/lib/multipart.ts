import { SuperHeaders } from 'fetch-super-headers';

import { RingBuffer } from './ring-buffer.js';

/**
 * Returns true if the request is `multipart/form-data`.
 */
export function isMultipartFormData(request: Request): boolean {
  let contentType = request.headers.get('Content-Type');
  return contentType != null && contentType.startsWith('multipart/form-data');
}

/**
 * Parse a `multipart/form-data` request body and yield each part as a `MultipartPart` object.
 *
 * Throw `MultipartParseError` if the parse fails for some reason.
 *
 * Example:
 *
 * ```typescript
 * import { MultipartParseError, parseMultipartFormData } from 'fetch-multipart-parser';
 *
 * function handleMultipartRequest(request: Request): void {
 *   try {
 *     for await (let part of parseMultipartFormData(request)) {
 *       console.log(part.name);
 *       console.log(part.filename);
 *       console.log(part.mediaType);
 *
 *       if (/^text\//.test(part.mediaType)) {
 *         console.log(new TextDecoder().decode(part.content));
 *       } else {
 *         // part.content is binary data, save it to a file
 *       }
 *     }
 *   } catch (error) {
 *     if (error instanceof MultipartParseError) {
 *       console.error('Failed to parse multipart/form-data:', error.message);
 *     } else {
 *       console.error('An unexpected error occurred:', error);
 *     }
 *   }
 * }
 * ```
 */
export async function* parseMultipartFormData(
  request: Request,
  options: MultipartParserOptions = {}
): AsyncGenerator<MultipartPart> {
  if (!isMultipartFormData(request)) {
    throw new MultipartParseError('Request is not multipart/form-data');
  }
  if (!request.body) {
    throw new MultipartParseError('Request body is empty');
  }

  let boundaryMatch = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(request.headers.get('Content-Type')!);
  if (!boundaryMatch) {
    throw new MultipartParseError('Invalid Content-Type header: missing boundary');
  }

  let boundary = boundaryMatch[1] || boundaryMatch[2]; // handle quoted and unquoted boundaries

  yield* parseMultipartStream(request.body, boundary, options);
}

/**
 * Parse a multipart stream and yield each part as a `MultipartPart` object.
 *
 * Throw `MultipartParseError` if the parse fails for some reason.
 *
 * Note: This is a low-level API that requires manually handling the stream and boundary. For most common use cases,
 * consider using `parseMultipartFormData(request)` instead.
 */
export async function* parseMultipartStream(
  stream: ReadableStream<Uint8Array>,
  boundary: string,
  options: MultipartParserOptions = {}
) {
  let parser = new MultipartParser(boundary, options);
  let reader = stream.getReader();

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        if (!parser.done) {
          throw new MultipartParseError('Unexpected end of stream');
        }

        break;
      }

      for (let part of parser.push(value)) {
        yield part;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

const HYPHEN = 45;
const DOUBLE_NEWLINE = new Uint8Array([13, 10, 13, 10]);
const DOUBLE_NEWLINE_SKIP_TABLE = RingBuffer.computeSkipTable(DOUBLE_NEWLINE);

const textDecoder = new TextDecoder();
const textEncoder = new TextEncoder();

export class MultipartParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MultipartParseError';
  }
}

export interface MultipartParserOptions {
  bufferSize?: number;
  maxHeaderSize?: number;
  maxFileSize?: number;
}

enum MultipartParserState {
  Start = 0,
  Header = 1,
  Body = 2,
  AfterBody = 3,
  Done = 4,
}

/**
 * A parser for `multipart/form-data` streams.
 */
export class MultipartParser {
  public buffer: RingBuffer;

  private boundaryArray: Uint8Array;
  private boundaryLength: number;
  private boundarySkipTable: Uint8Array;
  private maxHeaderSize: number;
  private maxFileSize: number;

  private state = MultipartParserState.Start;
  private bodyController: ReadableStreamDefaultController<Uint8Array> | null = null;
  private bodyLength = 0;

  constructor(
    public boundary: string,
    {
      bufferSize = Math.pow(2, 16), // 64 KB
      maxHeaderSize = 8 * 1024, // 8 KB
      maxFileSize = 10 * 1024 * 1024, // 10 MB
    }: MultipartParserOptions = {}
  ) {
    if ((bufferSize & (bufferSize - 1)) !== 0) {
      throw new Error('bufferSize must be a power of 2');
    }
    if (bufferSize <= maxHeaderSize) {
      throw new Error('bufferSize must be greater than maxHeaderSize');
    }

    this.boundaryArray = textEncoder.encode(`--${boundary}`);
    this.boundaryLength = this.boundaryArray.length;
    this.boundarySkipTable = RingBuffer.computeSkipTable(this.boundaryArray);
    this.buffer = new RingBuffer(bufferSize);
    this.maxHeaderSize = maxHeaderSize;
    this.maxFileSize = maxFileSize;
  }

  get done() {
    return this.state === MultipartParserState.Done;
  }

  push(chunk: Uint8Array): MultipartPart[] {
    if (this.done) {
      throw new MultipartParseError('Cannot push, parser is done');
    }

    this.buffer.append(chunk);

    let parts: MultipartPart[] = [];

    while (true) {
      if (this.state === MultipartParserState.Start) {
        if (this.buffer.length < this.boundaryLength + 2) break;

        let boundaryIndex = this.buffer.indexOf(this.boundaryArray, 0, this.boundarySkipTable);
        if (boundaryIndex !== 0) {
          throw new MultipartParseError('Invalid multipart stream: missing initial boundary');
        }

        this.buffer.skip(this.boundaryLength + 2); // Skip boundary + \r\n

        this.state = MultipartParserState.Header;
      } else if (this.state === MultipartParserState.Header) {
        if (this.buffer.length < 4) break;

        let headerEndIndex = this.buffer.indexOf(DOUBLE_NEWLINE, 0, DOUBLE_NEWLINE_SKIP_TABLE);
        if (headerEndIndex === -1) break;
        if (headerEndIndex > this.maxHeaderSize) {
          throw new MultipartParseError(
            `Header size exceeds maximum allowed size of ${this.maxHeaderSize} bytes`
          );
        }

        let headerBytes = this.buffer.read(headerEndIndex);
        this.buffer.skip(4); // Skip \r\n\r\n

        let body = new ReadableStream({
          start: (controller) => {
            this.bodyController = controller;
          },
        });

        parts.push(new MultipartPart(headerBytes, body));

        this.state = MultipartParserState.Body;
      } else if (this.state === MultipartParserState.Body) {
        if (this.buffer.length < this.boundaryLength) break;

        let boundaryIndex = this.buffer.indexOf(this.boundaryArray, 0, this.boundarySkipTable);

        if (boundaryIndex === -1) {
          // Write as much of the buffer as we can to the current body stream while still
          // keeping enough to check if the last few bytes are part of the boundary.
          this.writeBody(this.buffer.read(this.buffer.length - this.boundaryLength + 1));
          break;
        }

        this.writeBody(this.buffer.read(boundaryIndex - 2)); // -2 to avoid \r\n before boundary
        this.finishBody();

        this.buffer.skip(2 + this.boundaryLength); // Skip \r\n + boundary

        this.state = MultipartParserState.AfterBody;
      } else if (this.state === MultipartParserState.AfterBody) {
        if (this.buffer.length < 2) break;

        // If the next two bytes are "--" then we're done; this is the closing boundary. Otherwise
        // they're the \r\n after a boundary in the middle of the message and we can ignore them.
        let twoBytes = this.buffer.read(2);
        if (twoBytes[0] === HYPHEN && twoBytes[1] === HYPHEN) {
          this.state = MultipartParserState.Done;
          break;
        }

        this.state = MultipartParserState.Header;
      }
    }

    return parts;
  }

  private writeBody(chunk: Uint8Array): void {
    if (!this.bodyController) {
      throw new Error('Body controller is not initialized');
    }

    if (this.bodyLength + chunk.length > this.maxFileSize) {
      throw new MultipartParseError(
        `File size exceeds maximum allowed size of ${this.maxFileSize} bytes`
      );
    }

    this.bodyController.enqueue(chunk);
    this.bodyLength += chunk.length;
  }

  private finishBody(): void {
    if (!this.bodyController) {
      throw new Error('Body controller is not initialized');
    }

    this.bodyController.close();
    this.bodyController = null;
    this.bodyLength = 0;
  }
}

/**
 * A part of a `multipart/form-data` message.
 */
export class MultipartPart {
  private _header: Uint8Array;
  private _headers?: SuperHeaders;
  private _bodyUsed = false;

  constructor(header: Uint8Array, public readonly body: ReadableStream<Uint8Array>) {
    this._header = header;
  }

  async arrayBuffer(): Promise<ArrayBuffer> {
    return (await this.bytes()).buffer;
  }

  get bodyUsed(): boolean {
    return this._bodyUsed;
  }

  async bytes(): Promise<Uint8Array> {
    if (this._bodyUsed) {
      throw new Error('Body is already consumed or is being consumed');
    }

    this._bodyUsed = true;

    let reader = this.body.getReader();
    let chunks: Uint8Array[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) return concatChunks(chunks);
      chunks.push(value);
    }
  }

  /**
   * The headers associated with this part.
   */
  get headers(): SuperHeaders {
    if (!this._headers) this._headers = new SuperHeaders(textDecoder.decode(this._header));
    return this._headers;
  }

  /**
   * The filename of the part, if it is a file upload.
   */
  get filename(): string | null {
    return this.headers.contentDisposition.preferredFilename || null;
  }

  /**
   * The media type of the part.
   */
  get mediaType(): string | null {
    return this.headers.contentType.mediaType || null;
  }

  /**
   * The name of the part, usually the `name` of the field in the `<form>` that submitted the request.
   */
  get name(): string | null {
    return this.headers.contentDisposition.name || null;
  }

  /**
   * The content of the part as a string.
   *
   * Note: Do not use this for binary data, use `await part.bytes()` or stream `part.body` directly instead.
   */
  async text(): Promise<string> {
    return textDecoder.decode(await this.bytes());
  }
}

function concatChunks(chunks: Uint8Array[]): Uint8Array {
  if (chunks.length === 1) {
    return chunks[0];
  }

  let length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  let result = new Uint8Array(length);
  let offset = 0;

  for (let i = 0; i < chunks.length; ++i) {
    result.set(chunks[i], offset);
    offset += chunks[i].length;
  }

  return result;
}
