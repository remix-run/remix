import { SuperHeaders } from 'fetch-super-headers';

const CRLF = '\r\n';

const DefaultMaxHeaderSize = 1024 * 1024; // 1 MB
const DefaultMaxPartSize = 1024 * 1024 * 10; // 10 MB

export class MultipartParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MultipartParseError';
  }
}

export class MultipartPart {
  constructor(public headers: SuperHeaders, public content: Uint8Array) {}

  get filename(): string | null {
    return this.headers.contentDisposition.preferredFilename || null;
  }

  get mediaType(): string | null {
    return this.headers.contentType.mediaType || null;
  }

  get name(): string | null {
    return this.headers.contentDisposition.name || null;
  }
}

export function isMultipartFormData(request: Request): boolean {
  let contentType = request.headers.get('Content-Type');
  return contentType != null && contentType.startsWith('multipart/form-data');
}

export interface MultipartParseOptions {
  maxHeaderSize?: number;
  maxPartSize?: number;
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const findDoubleCRLF = createSeqFinder(textEncoder.encode(CRLF + CRLF));

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
 *
 * @param request
 * @param options
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

/**
 * Parse a multipart stream and yield each part as a `MultipartPart` object.
 *
 * Throw `MultipartParseError` if the parse fails for some reason.
 *
 * Note: This is a low-level function that requires manually handling the stream and boundary. For most common use cases,
 * consider using `parseMultipartFormData(request)` instead.
 *
 * @param boundary
 * @param stream
 * @param options
 */
export async function* parseMultipartStream(
  boundary: string,
  stream: ReadableStream<Uint8Array>,
  options: MultipartParseOptions = {}
) {
  let maxHeaderSize = options.maxHeaderSize || DefaultMaxHeaderSize;
  let maxPartSize = options.maxPartSize || DefaultMaxPartSize;

  let boundarySeq = textEncoder.encode(`--${boundary}`);
  let findBoundary = createSeqFinder(boundarySeq);

  let initialBoundaryFound = false;
  let isFinished = false;
  let reader = stream.getReader();
  let buffer = new Uint8Array(0);
  let boundarySearchStartIndex = 0;

  try {
    while (!isFinished) {
      const { done, value } = await reader.read();
      if (done) {
        if (!isFinished) {
          throw new MultipartParseError('Unexpected end of stream: final boundary not found');
        }
        break;
      }

      buffer = Uint8Array.from([...buffer, ...value]);

      while (true) {
        let boundaryIndex = findBoundary(buffer, boundarySearchStartIndex);
        if (boundaryIndex === -1) {
          // No boundary found, remember the last search index
          boundarySearchStartIndex = Math.max(0, buffer.length - boundarySeq.length);
          break;
        }

        if (initialBoundaryFound) {
          let partData = buffer.subarray(0, boundaryIndex - 2); // -2 to remove \r\n before boundary
          let headerEndIndex = findDoubleCRLF(partData);

          let headers: SuperHeaders;
          let content: Uint8Array;
          if (headerEndIndex !== -1) {
            if (headerEndIndex > maxHeaderSize) {
              throw new MultipartParseError(
                `Headers size exceeds maximum allowed size of ${maxHeaderSize} bytes`
              );
            }

            headers = new SuperHeaders(textDecoder.decode(partData.subarray(0, headerEndIndex)));
            content = partData.subarray(headerEndIndex + 4); // +4 to remove \r\n\r\n after headers
          } else {
            // No headers found, treat entire part as content
            headers = new SuperHeaders();
            content = partData;
          }

          if (content.length > maxPartSize) {
            throw new MultipartParseError(
              `Part size exceeds maximum allowed size of ${maxPartSize} bytes`
            );
          }

          yield new MultipartPart(headers, content);
        } else {
          initialBoundaryFound = true;
        }

        buffer = buffer.subarray(boundaryIndex + boundarySeq.length);
        boundarySearchStartIndex = 0;

        if (buffer.length > 1 && buffer[0] === 45 && buffer[1] === 45) {
          isFinished = true;
          buffer = buffer.subarray(2); // Keep any data after final boundary
          break;
        }
      }
    }

    if (buffer.length > 0) {
      throw new MultipartParseError('Unexpected data after final boundary');
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

  return (haystack: Uint8Array, offset = 0) => findSeq(haystack, needle, skipTable, offset);
}

function findSeq(
  haystack: Uint8Array,
  needle: Uint8Array,
  skipTable: Map<number, number>,
  offset: number
): number {
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
}
