import { SuperHeaders } from 'fetch-super-headers';

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
): AsyncGenerator<MultipartPart> {
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
const DOUBLE_NEWLINE_SKIP_TABLE = computeSkipTable(DOUBLE_NEWLINE);
const EMPTY_BUFFER = new Uint8Array(0);

const textDecoder = new TextDecoder();
const textEncoder = new TextEncoder();

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
 * A parser for `multipart/form-data` streams.
 */
export class MultipartParser {
  private boundaryArray: Uint8Array;
  private boundaryLength: number;
  private boundarySkipTable: Uint8Array;
  private maxHeaderSize: number;
  private maxFileSize: number;

  private state = MultipartParserState.Start;
  private buffer: Uint8Array = EMPTY_BUFFER;
  private chunk: Uint8Array = EMPTY_BUFFER;
  private length: number = 0;

  private bodyController: ReadableStreamDefaultController<Uint8Array> | null = null;
  private bodyLength = 0;

  constructor(
    public boundary: string,
    {
      maxHeaderSize = 8 * 1024, // 8 KB
      maxFileSize = 10 * 1024 * 1024, // 10 MB
    }: MultipartParserOptions = {}
  ) {
    this.boundaryArray = textEncoder.encode(`--${boundary}`);
    this.boundaryLength = this.boundaryArray.length;
    this.boundarySkipTable = computeSkipTable(this.boundaryArray);
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

    this.chunk = chunk;
    this.length = this.buffer.length + this.chunk.length;

    if (this.state === MultipartParserState.Start) {
      if (this.length < this.boundaryLength) {
        this.save();
        return [];
      }

      let index = find(this.buffer, this.chunk, this.boundaryArray, this.boundarySkipTable);
      if (index !== 0) {
        throw new MultipartParseError('Invalid multipart stream: missing initial boundary');
      }

      this.skip(this.boundaryLength);

      this.state = MultipartParserState.AfterBoundary;
    }

    let parts: MultipartPart[] = [];

    while (true) {
      if (this.state === MultipartParserState.AfterBoundary) {
        if (this.length < 2) {
          this.save();
          break;
        }

        // If the next two bytes are "--" then we're done; this is the closing boundary. Otherwise
        // they're the \r\n after a boundary in the middle of the message and we can ignore them.
        let twoBytes = this.read(2);
        if (
          (twoBytes.length === 1 && twoBytes[0][0] === HYPHEN && twoBytes[0][1] === HYPHEN) ||
          (twoBytes[0][0] === HYPHEN && twoBytes[1][0] === HYPHEN)
        ) {
          // Discard any remaining data in the current buffer/chunk so we don't leak memory.
          this.buffer = EMPTY_BUFFER;
          this.chunk = EMPTY_BUFFER;

          this.state = MultipartParserState.Done;
          break;
        }

        this.state = MultipartParserState.Header;
      }

      if (this.state === MultipartParserState.Header) {
        if (this.length < 4) {
          this.save();
          break;
        }

        let index = find(this.buffer, this.chunk, DOUBLE_NEWLINE, DOUBLE_NEWLINE_SKIP_TABLE);
        if (index === -1) break;
        if (index > this.maxHeaderSize) {
          throw new MultipartParseError(
            `Header size exceeds maximum allowed size of ${this.maxHeaderSize} bytes`
          );
        }

        let header = concatChunks(this.read(index));
        this.skip(4); // Skip \r\n\r\n

        let body = new ReadableStream({
          start: (controller) => {
            this.bodyController = controller;
          },
        });

        parts.push(new MultipartPart(header, body));

        this.state = MultipartParserState.Body;
      }

      if (this.state === MultipartParserState.Body) {
        if (this.length < this.boundaryLength) {
          this.save();
          break;
        }

        let index = find(this.buffer, this.chunk, this.boundaryArray, this.boundarySkipTable);

        if (index === -1) {
          // Write as much of the buffer as we can to the current body stream while still
          // keeping enough to check if the last few bytes are part of the boundary.
          this.writeBody(this.read(this.length - this.boundaryLength + 1));
          this.save();
          break;
        }

        this.writeBody(this.read(index - 2)); // -2 to avoid \r\n before boundary
        this.closeBody();

        this.skip(2 + this.boundaryLength); // Skip \r\n + boundary

        this.state = MultipartParserState.AfterBoundary;
      }
    }

    return parts;
  }

  private read(size: number): Uint8Array[] {
    this.length -= size;

    if (size > this.buffer.length) {
      if (this.buffer.length > 0) {
        let head = this.buffer;
        this.buffer = EMPTY_BUFFER;
        let tail = this.chunk.subarray(0, size - head.length);
        this.chunk = this.chunk.subarray(size - head.length);
        return [head, tail];
      } else {
        let head = this.chunk.subarray(0, size);
        this.chunk = this.chunk.subarray(size);
        return [head];
      }
    } else {
      let head = this.buffer.subarray(0, size);
      this.buffer = this.buffer.subarray(size);
      return [head];
    }
  }

  private skip(size: number): void {
    this.length -= size;

    if (size > this.buffer.length) {
      this.chunk = this.chunk.subarray(size - this.buffer.length);
      this.buffer = EMPTY_BUFFER;
    } else {
      this.buffer = this.buffer.subarray(size);
    }
  }

  private save(): void {
    if (this.chunk.length > 0) {
      if (this.buffer.length > 0) {
        this.buffer = concatChunks([this.buffer, this.chunk]);
      } else {
        this.buffer = this.chunk;
      }
    }
  }

  private writeBody(chunks: Uint8Array[]): void {
    for (let i = 0; i < chunks.length; ++i) {
      let chunk = chunks[i];

      if (this.bodyLength + chunk.length > this.maxFileSize) {
        throw new MultipartParseError(
          `File size exceeds maximum allowed size of ${this.maxFileSize} bytes`
        );
      }

      this.bodyController!.enqueue(chunk);
      this.bodyLength += chunk.length;
    }
  }

  private closeBody(): void {
    this.bodyController!.close();
    this.bodyController = null;
    this.bodyLength = 0;
  }
}

function find(
  head: Uint8Array,
  tail: Uint8Array,
  pattern: Uint8Array,
  skipTable = computeSkipTable(pattern)
): number {
  let headLength = head.length;
  let totalLength = headLength + tail.length;
  let i = pattern.length - 1;

  function byteAt(index: number) {
    return index < headLength ? head[index] : tail[index - headLength];
  }

  while (i < totalLength) {
    let j = pattern.length - 1;
    let k = i;

    while (j >= 0 && byteAt(k) === pattern[j]) {
      j--;
      k--;
    }

    if (j === -1) {
      return k + 1;
    }

    i += skipTable[byteAt(i)] || pattern.length;
  }

  return -1;
}

function computeSkipTable(pattern: Uint8Array): Uint8Array {
  let table = new Uint8Array(256).fill(pattern.length);
  let lastIndex = pattern.length - 1;

  for (let i = 0; i < lastIndex; i++) {
    table[pattern[i]] = lastIndex - i;
  }

  return table;
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

  /**
   * The content of this part as an `ArrayBuffer`.
   */
  async arrayBuffer(): Promise<ArrayBuffer> {
    return (await this.bytes()).buffer;
  }

  /**
   * Whether the body of this part has been consumed.
   */
  get bodyUsed(): boolean {
    return this._bodyUsed;
  }

  /**
   * The content of this part as a `Uint8Array`.
   */
  async bytes(): Promise<Uint8Array> {
    if (this._bodyUsed) {
      throw new Error('Body is already consumed or is being consumed');
    }

    this._bodyUsed = true;

    return bufferStream(this.body);
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

async function bufferStream(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  let reader = stream.getReader();

  try {
    let chunks: Uint8Array[] = [];

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        return concatChunks(chunks);
      }

      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
}

function concatChunks(chunks: Uint8Array[]): Uint8Array {
  if (chunks.length === 1) return chunks[0];

  let length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  let result = new Uint8Array(length);
  let offset = 0;

  for (let i = 0; i < chunks.length; ++i) {
    result.set(chunks[i], offset);
    offset += chunks[i].length;
  }

  return result;
}
