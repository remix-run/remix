import { ContentType } from '@remix-run/headers/content-type'

import type { MultipartParserOptions, MultipartPart } from './multipart.ts'
import { MultipartParseError, parseMultipartStream } from './multipart.ts'

/**
 * Extracts the boundary string from a `multipart/*` content type.
 *
 * @param contentType The `Content-Type` header value from the request
 * @returns The boundary string if found, or null if not present
 */
export function getMultipartBoundary(contentType: string): string | null {
  return ContentType.from(contentType).boundary ?? null
}

/**
 * Returns true if the given request contains multipart data.
 *
 * @param request The `Request` object to check
 * @returns `true` if the request is a multipart request, `false` otherwise
 */
export function isMultipartRequest(request: Request): boolean {
  let mediaType = ContentType.from(request.headers.get('Content-Type')).mediaType?.toLowerCase()
  return mediaType?.startsWith('multipart/') ?? false
}

/**
 * Parse a multipart [`Request`](https://developer.mozilla.org/en-US/docs/Web/API/Request) and
 * yield each part as a {@link MultipartPart} as soon as its headers arrive. Part content is
 * streamed from the request body as you read it, so large uploads are never buffered in memory.
 *
 * Read each part's content before continuing to the next part. When you continue, the parser
 * waits for a read you started to finish and discards any content you didn't read.
 *
 * @param request The `Request` object containing multipart data
 * @param options Optional parser options, such as `maxHeaderSize`, `maxFileSize`, `maxParts`,
 * and `maxTotalSize`
 * @yields {@link MultipartPart} objects as their headers are parsed
 * @returns An async generator yielding {@link MultipartPart} objects
 */
export async function* parseMultipartRequest(
  request: Request,
  options?: MultipartParserOptions,
): AsyncGenerator<MultipartPart, void, unknown> {
  if (!isMultipartRequest(request)) {
    throw new MultipartParseError('Request is not a multipart request')
  }
  if (!request.body) {
    throw new MultipartParseError('Request body is empty')
  }

  let boundary = getMultipartBoundary(request.headers.get('Content-Type')!)
  if (!boundary) {
    throw new MultipartParseError('Invalid Content-Type header: missing boundary')
  }

  yield* parseMultipartStream(request.body, {
    boundary,
    maxHeaderSize: options?.maxHeaderSize,
    maxFileSize: options?.maxFileSize,
    maxParts: options?.maxParts,
    maxTotalSize: options?.maxTotalSize,
  })
}
