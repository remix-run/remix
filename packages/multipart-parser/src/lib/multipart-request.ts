import { ContentType } from '@remix-run/headers/content-type'

import type { MultipartParserOptions, MultipartPart, StreamingMultipartPart } from './multipart.ts'
import { MultipartParseError, parseMultipartStream, parseStreamingMultipart } from './multipart.ts'

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
 * Parse a multipart [`Request`](https://developer.mozilla.org/en-US/docs/Web/API/Request)
 * and yield each part as a {@link MultipartPart} object. Useful in HTTP server contexts
 * for handling incoming `multipart/*` requests.
 *
 * @param request The `Request` object containing multipart data
 * @param options Optional parser options, such as `maxHeaderSize`, `maxFileSize`, `maxParts`,
 * and `maxTotalSize`
 * @yields Parsed {@link MultipartPart} objects from the request body
 * @returns An async generator yielding {@link MultipartPart} objects
 */
export async function* parseMultipartRequest(
  request: Request,
  options?: MultipartParserOptions,
): AsyncGenerator<MultipartPart, void, unknown> {
  let { body, boundary } = getMultipartBody(request)

  yield* parseMultipartStream(body, {
    boundary,
    maxHeaderSize: options?.maxHeaderSize,
    maxFileSize: options?.maxFileSize,
    maxParts: options?.maxParts,
    maxTotalSize: options?.maxTotalSize,
  })
}

/**
 * Parse a multipart [`Request`](https://developer.mozilla.org/en-US/docs/Web/API/Request)
 * and yield each part as soon as its headers arrive, with its content available as a stream.
 * Useful for handling large file uploads without buffering them in memory.
 *
 * Read or cancel each part's body before continuing to the next part. If a part's body has not
 * been read when you continue, its content is discarded.
 *
 * @param request The `Request` object containing multipart data
 * @param options Optional parser options, such as `maxHeaderSize`, `maxFileSize`, `maxParts`,
 * and `maxTotalSize`
 * @yields {@link StreamingMultipartPart} objects as their headers are parsed
 * @returns An async generator yielding {@link StreamingMultipartPart} objects
 */
export async function* parseStreamingMultipartRequest(
  request: Request,
  options?: MultipartParserOptions,
): AsyncGenerator<StreamingMultipartPart, void, unknown> {
  let { body, boundary } = getMultipartBody(request)

  yield* parseStreamingMultipart(body, {
    boundary,
    maxHeaderSize: options?.maxHeaderSize,
    maxFileSize: options?.maxFileSize,
    maxParts: options?.maxParts,
    maxTotalSize: options?.maxTotalSize,
  })
}

function getMultipartBody(request: Request): {
  body: ReadableStream<Uint8Array>
  boundary: string
} {
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

  return { body: request.body, boundary }
}
