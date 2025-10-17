import type * as http from 'node:http'
import { Readable } from 'node:stream'
import type { ReadableStream as NodeReadableStream } from 'node:stream/web'

import type {
  ParseMultipartOptions,
  MultipartParserOptions,
  BufferedMultipartPart,
  StreamedMultipartPart as StreamedMultipartPartWeb
} from './multipart.ts'
import {
  MultipartParseError,
  parseMultipart as parseMultipartWeb,
  parseMultipartStream as parseMultipartStreamWeb,
  MultipartPart
} from './multipart.ts'
import { getMultipartBoundary } from './multipart-request.ts'
/**
 * A part of a `multipart/*` HTTP message with content as Readable.
 */
export class StreamedMultipartPart extends MultipartPart {
  #webMultipartPart: StreamedMultipartPartWeb
  /**
   * Readable of raw content of this part.
   */
  readonly contentReadable: Readable

  constructor(webMultipartPart: StreamedMultipartPartWeb) {
    super(webMultipartPart.rawHeader)
    this.contentReadable = Readable.fromWeb(webMultipartPart.content as NodeReadableStream<Uint8Array>)
    this.#webMultipartPart = webMultipartPart
  }

  async toBuffered(): Promise<BufferedMultipartPart> {
    return this.#webMultipartPart.toBufferedFromIterator(this.contentReadable)
  }
  /**
   * Signal end-of-stream
   */
  finish() {
    this.#webMultipartPart.finish()
  }
}
/**
 * Parse a `multipart/*` Node.js `Buffer` and yield each part as a `BufferedMultipartPart` object.
 *
 * Note: This is a low-level API that requires manual handling of the content and boundary. If you're
 * building a web server, consider using `parseMultipartRequest(request)` instead.
 *
 * @param message The multipart message as a `Buffer` or an iterable of `Buffer` chunks
 * @param options Options for the parser
 * @return A generator yielding `BufferedMultipartPart` objects
 */
export async function* parseMultipart(
  message: Buffer | Iterable<Buffer>,
  options: ParseMultipartOptions,
): AsyncGenerator<BufferedMultipartPart, void, unknown> {
  yield* parseMultipartWeb(message as Uint8Array | Iterable<Uint8Array>, options)
}

/**
 * Parse a `multipart/*` Node.js `Readable` stream and yield each part as a `StreamedMultipartPart` object.
 *
 * Note: This is a low-level API that requires manual handling of the stream and boundary. If you're
 * building a web server, consider using `parseMultipartRequest(request)` instead.
 *
 * @param stream A Node.js `Readable` stream containing multipart data
 * @param options Options for the parser
 * @return An async generator yielding `StreamedMultipartPart` objects
 */
export async function* parseMultipartStream(
  stream: Readable,
  options: ParseMultipartOptions,
): AsyncGenerator<StreamedMultipartPart, void, unknown> {
  let asyncParser = parseMultipartStreamWeb(Readable.toWeb(stream) as ReadableStream, options)
  while (true) {
    let {value, done} = await asyncParser.next()
    if (done) break
    if (value) yield new StreamedMultipartPart(value)
  }
}

/**
 * Returns true if the given request is a multipart request.
 *
 * @param req The Node.js `http.IncomingMessage` object to check
 * @return `true` if the request is a multipart request, `false` otherwise
 */
export function isMultipartRequest(req: http.IncomingMessage): boolean {
  let contentType = req.headers['content-type']
  return contentType != null && /^multipart\//i.test(contentType)
}

/**
 * Parse a multipart Node.js request and yield each part as a `StreamedMultipartPart` object.
 *
 * @param req The Node.js `http.IncomingMessage` object containing multipart data
 * @param options Options for the parser
 * @return An async generator yielding `StreamedMultipartPart` objects
 */
export async function* parseMultipartRequest(
  req: http.IncomingMessage,
  options?: MultipartParserOptions,
): AsyncGenerator<StreamedMultipartPart, void, unknown> {
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
