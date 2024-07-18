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
  private boundarySkipTable: Map<number, number>;
  private maxHeaderSize: number;
  private maxFileSize: number;
  private boundarySearchIndex = 0;
  private initialBoundaryFound = false;

  constructor(public boundary: string, options: MultipartParseOptions = {}) {
    this.boundaryArray = textEncoder.encode(`--${boundary}`);
    this.boundarySkipTable = createSkipTable(this.boundaryArray);
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
      let boundaryIndex = findBoundary(
        this.buffer.peek(this.buffer.length),
        this.boundaryArray,
        this.boundarySkipTable,
        this.boundarySearchIndex
      );
      if (boundaryIndex === -1) {
        // No boundary found, begin the boundary search on the next iteration from
        // the start of the last potential boundary sequence
        this.boundarySearchIndex = Math.max(0, this.buffer.length - this.boundaryArray.length);
        break;
      } else {
        this.boundarySearchIndex = 0;
      }

      if (this.initialBoundaryFound) {
        let partArray = this.buffer.read(boundaryIndex - 2); // -2 to avoid \r\n before the boundary

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

        let header = textDecoder.decode(headerArray);
        parts.push(new MultipartPart(header, contentArray));

        this.buffer.skip(2 + this.boundaryArray.length); // Skip \r\n + boundary
      } else {
        this.initialBoundaryFound = true;
        this.buffer.skip(this.boundaryArray.length); // Skip the boundary
      }

      if (this.buffer.length > 1) {
        // If the next two bytes are "--", it's the final boundary and we're done.
        // Otherwise, it's the \r\n after the boundary and we can discard it.
        let twoBytes = this.buffer.read(2);
        if (twoBytes[0] === 45 && twoBytes[1] === 45) {
          this.done = true;
          break;
        }
      }
    }

    return parts;
  }
}

function createSkipTable(needle: Uint8Array): Map<number, number> {
  let skipTable = new Map<number, number>();
  for (let i = 0; i < needle.length - 1; i++) {
    skipTable.set(needle[i], needle.length - 1 - i);
  }
  return skipTable;
}

function findBoundary(
  buffer: Uint8Array,
  boundaryArray: Uint8Array,
  skipTable: Map<number, number>,
  offset = 0
): number {
  // boyer-moore-horspool algorithm
  if (boundaryArray.length === 0) {
    return offset;
  }

  let i = offset + boundaryArray.length - 1;
  while (i < buffer.length) {
    let j = boundaryArray.length - 1;
    while (j >= 0 && buffer[i] === boundaryArray[j]) {
      i--;
      j--;
    }
    if (j < 0) {
      return i + 1;
    }
    i += Math.max(boundaryArray.length - j, skipTable.get(buffer[i]) || boundaryArray.length);
  }

  return -1;
}

function findDoubleCRLF(buffer: Uint8Array): number {
  for (let i = 0; i < buffer.length - 3; i++) {
    if (buffer[i] === 13 && buffer[i + 1] === 10 && buffer[i + 2] === 13 && buffer[i + 3] === 10) {
      return i;
    }
  }

  return -1;
}

/**
 * A part of a `multipart/form-data` message.
 */
export class MultipartPart {
  constructor(public header: string, public content: Uint8Array) {}

  get headers(): Headers {
    return new SuperHeaders(this.header);
  }

  /**
   * The filename of the part, if it is a file upload.
   */
  get filename(): string | null {
    let headers = this.headers as SuperHeaders;
    return headers.contentDisposition.preferredFilename || null;
  }

  /**
   * The media type of the part.
   */
  get mediaType(): string | null {
    let headers = this.headers as SuperHeaders;
    return headers.contentType.mediaType || null;
  }

  /**
   * The name of the part, usually the `name` of the field in the `<form>` that submitted the request.
   */
  get name(): string | null {
    let headers = this.headers as SuperHeaders;
    return headers.contentDisposition.name || null;
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
