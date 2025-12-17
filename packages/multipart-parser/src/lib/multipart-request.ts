import type { MultipartParserOptions, MultipartPart } from './multipart.ts'
import { MultipartParseError, parseMultipartStream } from './multipart.ts'

/**
 * Extracts the boundary string from a `multipart/*` content type.
 *
 * @param contentType The `Content-Type` header value from the request
 * @returns The boundary string if found, or null if not present
 */
export function getMultipartBoundary(contentType: string): string | null {
  let match = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType)
  return match ? (match[1] ?? match[2]) : null
}

/**
 * Returns true if the given request contains multipart data.
 *
 * @param request The `Request` object to check
 * @returns `true` if the request is a multipart request, `false` otherwise
 */
export function isMultipartRequest(request: Request): boolean {
  let contentType = request.headers.get('Content-Type')
  return contentType != null && contentType.startsWith('multipart/')
}

/**
 * Parse a multipart [`Request`](https://developer.mozilla.org/en-US/docs/Web/API/Request) and yield each part as
 * a `MultipartPart` object. Useful in HTTP server contexts for handling incoming `multipart/*` requests.
 *
 * @param request The `Request` object containing multipart data
 * @param options Optional parser options, such as `maxHeaderSize` and `maxFileSize`
 * @returns An async generator yielding `MultipartPart` objects
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
  })
}
