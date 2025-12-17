import type * as http from 'node:http'
import { Readable } from 'node:stream'

import type { ParseMultipartOptions, MultipartParserOptions, MultipartPart } from './multipart.ts'
import {
  MultipartParseError,
  parseMultipart as parseMultipartWeb,
  parseMultipartStream as parseMultipartStreamWeb,
} from './multipart.ts'
import { getMultipartBoundary } from './multipart-request.ts'

/**
 * Parse a `multipart/*` Node.js `Buffer` and yield each part as a `MultipartPart` object.
 *
 * Note: This is a low-level API that requires manual handling of the content and boundary. If you're
 * building a web server, consider using `parseMultipartRequest(request)` instead.
 *
 * @param message The multipart message as a `Buffer` or an iterable of `Buffer` chunks
 * @param options Options for the parser
 * @returns A generator yielding `MultipartPart` objects
 */
export function* parseMultipart(
  message: Buffer | Iterable<Buffer>,
  options: ParseMultipartOptions,
): Generator<MultipartPart, void, unknown> {
  yield* parseMultipartWeb(message as Uint8Array | Iterable<Uint8Array>, options)
}

/**
 * Parse a `multipart/*` Node.js `Readable` stream and yield each part as a `MultipartPart` object.
 *
 * Note: This is a low-level API that requires manual handling of the stream and boundary. If you're
 * building a web server, consider using `parseMultipartRequest(request)` instead.
 *
 * @param stream A Node.js `Readable` stream containing multipart data
 * @param options Options for the parser
 * @returns An async generator yielding `MultipartPart` objects
 */
export async function* parseMultipartStream(
  stream: Readable,
  options: ParseMultipartOptions,
): AsyncGenerator<MultipartPart, void, unknown> {
  yield* parseMultipartStreamWeb(Readable.toWeb(stream) as ReadableStream, options)
}

/**
 * Returns true if the given request is a multipart request.
 *
 * @param req The Node.js `http.IncomingMessage` object to check
 * @returns `true` if the request is a multipart request, `false` otherwise
 */
export function isMultipartRequest(req: http.IncomingMessage): boolean {
  let contentType = req.headers['content-type']
  return contentType != null && /^multipart\//i.test(contentType)
}

/**
 * Parse a multipart Node.js request and yield each part as a `MultipartPart` object.
 *
 * @param req The Node.js `http.IncomingMessage` object containing multipart data
 * @param options Options for the parser
 * @returns An async generator yielding `MultipartPart` objects
 */
export async function* parseMultipartRequest(
  req: http.IncomingMessage,
  options?: MultipartParserOptions,
): AsyncGenerator<MultipartPart, void, unknown> {
  if (!isMultipartRequest(req)) {
    throw new MultipartParseError('Request is not a multipart request')
  }

  let boundary = getMultipartBoundary(req.headers['content-type']!)
  if (!boundary) {
    throw new MultipartParseError('Invalid Content-Type header: missing boundary')
  }

  yield* parseMultipartStream(req, {
    boundary,
    maxHeaderSize: options?.maxHeaderSize,
    maxFileSize: options?.maxFileSize,
  })
}
