import { SuperHeaders } from 'fetch-super-headers';

import { RingBuffer } from './ring-buffer.js';

/**
 * Returns true if the request is `multipart/form-data`.
 */
export function isMultipartFormData(request: Request): boolean {
  let contentType = request.headers.get('Content-Type');
  return contentType != null && contentType.startsWith('multipart/form-data');
}

export class MultipartParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MultipartParseError';
  }
}

export interface MultipartParseOptions {
  initialBufferSize?: number;
  maxHeaderSize?: number;
  maxFileSize?: number;
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
  options: MultipartParseOptions = {}
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
  options: MultipartParseOptions = {}
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

const textDecoder = new TextDecoder();
const textEncoder = new TextEncoder();

/**
 * A parser for `multipart/form-data` streams.
 */
export class MultipartParser {
  public buffer: RingBuffer;
  public done = false;

  private boundaryArray: Uint8Array;
  private boundarySkipTable: Uint8Array;
  private maxHeaderSize: number;
  private maxFileSize: number;
  private boundarySearchIndex: number;
  private initialBoundaryFound = false;

  constructor(public boundary: string, options: MultipartParseOptions = {}) {
    this.boundaryArray = textEncoder.encode(`--${boundary}`);
    this.boundarySearchIndex = 0;
    this.boundarySkipTable = RingBuffer.computeSkipTable(this.boundaryArray);
    this.buffer = new RingBuffer(options.initialBufferSize || 16 * 1024);
    this.maxHeaderSize = options.maxHeaderSize || 1024 * 1024;
    this.maxFileSize = options.maxFileSize || 10 * 1024 * 1024;
  }

  push(chunk: Uint8Array): MultipartPart[] {
    if (this.done) {
      throw new MultipartParseError('Cannot push, parser is done');
    }

    this.buffer.append(chunk);

    let parts: MultipartPart[] = [];

    while (true) {
      let nextBoundaryIndex = this.buffer.find(
        this.boundaryArray,
        this.boundarySearchIndex,
        this.boundarySkipTable
      );

      if (nextBoundaryIndex === -1) {
        // No boundary found, begin the boundary search on the next iteration from
        // the start of the last potential boundary sequence
        this.boundarySearchIndex = Math.max(0, this.buffer.length - this.boundaryArray.length);
        break;
      } else {
        this.boundarySearchIndex = 0;
      }

      if (this.initialBoundaryFound) {
        let partArray = this.buffer.read(nextBoundaryIndex - 2); // -2 to avoid \r\n before the boundary

        let headerEndIndex = findDoubleCRLF(partArray);
        if (headerEndIndex === -1) {
          throw new MultipartParseError('Invalid part: missing header');
        }

        let headerArray = partArray.subarray(0, headerEndIndex);
        if (headerArray.length > this.maxHeaderSize) {
          throw new MultipartParseError(
            `Header size exceeds maximum allowed size of ${this.maxHeaderSize} bytes`
          );
        }

        let contentArray = partArray.subarray(headerEndIndex + 4); // +4 to skip \r\n\r\n after the header
        if (contentArray.length > this.maxFileSize) {
          throw new MultipartParseError(
            `File size exceeds maximum allowed size of ${this.maxFileSize} bytes`
          );
        }

        parts.push(new MultipartPart(headerArray, contentArray));

        this.buffer.skip(2 + this.boundaryArray.length); // Skip \r\n + boundary
      } else {
        this.initialBoundaryFound = true;
        this.buffer.skip(this.boundaryArray.length); // Skip the boundary
      }

      if (this.buffer.length > 1) {
        // If the next two bytes are "--", it's the final boundary and we're done.
        // Otherwise, it's the \r\n after the boundary and we can discard it.
        let twoBytes = this.buffer.read(2);
        if (twoBytes[0] === HYPHEN && twoBytes[1] === HYPHEN) {
          this.done = true;
          break;
        }
      }
    }

    return parts;
  }
}

const HYPHEN = 45;
const CR = 13;
const LF = 10;

function findDoubleCRLF(buffer: Uint8Array): number {
  for (let i = 0; i < buffer.length - 3; i++) {
    if (buffer[i] === CR && buffer[i + 1] === LF && buffer[i + 2] === CR && buffer[i + 3] === LF) {
      return i;
    }
  }

  return -1;
}

/**
 * A part of a `multipart/form-data` message.
 */
export class MultipartPart {
  private _rawHeader: Uint8Array;
  private _headers?: SuperHeaders;

  constructor(header: Uint8Array, public content: Uint8Array) {
    this._rawHeader = header;
  }

  /**
   * The headers associated with this part.
   */
  get headers(): SuperHeaders {
    if (!this._headers) {
      this._headers = new SuperHeaders(textDecoder.decode(this._rawHeader));
    }

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
   * Note: Do not use this for binary data, use `part.content` instead.
   */
  get text(): string {
    return textDecoder.decode(this.content);
  }
}
