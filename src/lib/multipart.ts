import { SuperHeaders } from 'fetch-super-headers';

import { RingBuffer } from './ring-buffer.js';

const CRLF = '\r\n';

const DefaultMaxHeaderSize = 1024 * 1024; // 1 MB
const DefaultMaxFileSize = 1024 * 1024 * 10; // 10 MB

export class MultipartParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MultipartParseError';
  }
}

/**
 * Represents a part of a `multipart/form-data` request.
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
    return new TextDecoder().decode(this.content);
  }
}

/**
 * Returns true if the request is `multipart/form-data`.
 */
export function isMultipartFormData(request: Request): boolean {
  let contentType = request.headers.get('Content-Type');
  return contentType != null && contentType.startsWith('multipart/form-data');
}

export interface MultipartParseOptions {
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

  yield* parseMultipartStream(boundary, request.body, options);
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const findHeaderEnd = createSeqFinder(textEncoder.encode(CRLF + CRLF));

/**
 * Parse a multipart stream and yield each part as a `MultipartPart` object.
 *
 * Throw `MultipartParseError` if the parse fails for some reason.
 *
 * Note: This is a low-level API that requires manually handling the stream and boundary. For most common use cases,
 * consider using `parseMultipartFormData(request)` instead.
 */
export async function* parseMultipartStream(
  boundary: string,
  stream: ReadableStream<Uint8Array>,
  options: MultipartParseOptions = {}
) {
  let maxHeaderSize = options.maxHeaderSize || DefaultMaxHeaderSize;
  let maxFileSize = options.maxFileSize || DefaultMaxFileSize;

  let boundarySeq = textEncoder.encode(`--${boundary}`);
  let findBoundary = createSeqFinder(boundarySeq);

  let reader = stream.getReader();
  let buffer = new RingBuffer(16 * 1024); // Start with a 16KB buffer
  let boundarySearchStartIndex = 0;
  let initialBoundaryFound = false;
  let isFinished = false;

  try {
    while (!isFinished) {
      const { done, value } = await reader.read();
      if (done) {
        if (!isFinished) {
          throw new MultipartParseError('Unexpected end of stream: final boundary not found');
        }
        break;
      }

      buffer.append(value);

      while (true) {
        let boundaryIndex = findBoundary(buffer.peek(buffer.length), boundarySearchStartIndex);
        if (boundaryIndex === -1) {
          // No boundary found, begin the boundary search on the next iteration from
          // the start of the last potential boundary sequence.
          boundarySearchStartIndex = Math.max(0, buffer.length - boundarySeq.length);
          break;
        }

        if (initialBoundaryFound) {
          let partData = buffer.read(boundaryIndex - 2); // -2 to avoid \r\n before the boundary
          let headerEndIndex = findHeaderEnd(partData);

          let header: string;
          let content: Uint8Array;
          if (headerEndIndex !== -1) {
            let headerBytes = partData.subarray(0, headerEndIndex);
            if (headerBytes.length > maxHeaderSize) {
              throw new MultipartParseError(
                `Headers size exceeds maximum allowed size of ${maxHeaderSize} bytes`
              );
            }

            header = textDecoder.decode(headerBytes);
            content = partData.subarray(headerEndIndex + 4); // +4 to remove \r\n\r\n after header
          } else {
            // No headers found, treat entire part as content
            header = '';
            content = partData;
          }

          if (content.length > maxFileSize) {
            throw new MultipartParseError(
              `File size exceeds maximum allowed size of ${maxFileSize} bytes`
            );
          }

          yield new MultipartPart(header, content);

          buffer.read(2); // Skip the \r\n before the boundary
        } else {
          initialBoundaryFound = true;
        }

        buffer.read(boundarySeq.length); // Skip the boundary
        boundarySearchStartIndex = 0;

        if (buffer.length > 1) {
          let endMarker = buffer.peek(2); // Check for "--"
          if (endMarker[0] === 45 && endMarker[1] === 45) {
            isFinished = true;
            break;
          } else {
            buffer.read(2); // Skip the \r\n after the boundary
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

function createSeqFinder(needle: Uint8Array): (haystack: Uint8Array, offset?: number) => number {
  let skipTable = new Map<number, number>();
  for (let i = 0; i < needle.length - 1; i++) {
    skipTable.set(needle[i], needle.length - 1 - i);
  }

  return (haystack: Uint8Array, offset = 0) => {
    // boyer-moore-horspool algorithm
    if (needle.length === 0) {
      return offset;
    }

    let i = offset + needle.length - 1;
    while (i < haystack.length) {
      let j = needle.length - 1;
      while (j >= 0 && haystack[i] === needle[j]) {
        i--;
        j--;
      }
      if (j < 0) {
        return i + 1;
      }
      i += Math.max(needle.length - j, skipTable.get(haystack[i]) || needle.length);
    }

    return -1;
  };
}
