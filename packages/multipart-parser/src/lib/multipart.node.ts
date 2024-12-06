import type * as http from 'node:http';
import { Readable } from 'node:stream';

import {
  getMultipartBoundary,
  parseMultipart as parseMultipartWeb,
  MultipartParseError,
  type MultipartParserOptions,
  MultipartPart,
} from './multipart.ts';

/**
 * Returns true if the given request is a multipart request.
 */
export function isMultipartRequest(request: http.IncomingMessage): boolean {
  let contentType = request.headers['content-type'];
  return contentType != null && /^multipart\//i.test(contentType);
}

/**
 * Parse a multipart Node.js request and yield each part as a `MultipartPart` object.
 */
export async function* parseMultipartRequest(
  request: http.IncomingMessage,
  options?: MultipartParserOptions,
): AsyncGenerator<MultipartPart> {
  if (!isMultipartRequest(request)) {
    throw new MultipartParseError('Request is not a multipart request');
  }

  let boundary = getMultipartBoundary(request.headers['content-type']!);
  if (!boundary) {
    throw new MultipartParseError('Invalid Content-Type header: missing boundary');
  }

  yield* parseMultipart(request, boundary, options);
}

/**
 * Parse a multipart Node.js `Buffer` or `Readable` stream and yield each part as a `MultipartPart` object.
 *
 * Note: This is a low-level API that requires manual handling of the stream and boundary. If you're
 * building a web server, consider using `parseMultipartRequest(request)` instead.
 */
export async function* parseMultipart(
  data: Readable | Buffer | Iterable<Buffer> | AsyncIterable<Buffer>,
  boundary: string,
  options?: MultipartParserOptions,
): AsyncGenerator<MultipartPart> {
  if (data instanceof Readable) {
    yield* parseMultipartWeb(Readable.toWeb(data), boundary, options);
  } else {
    yield* parseMultipartWeb(
      data as Uint8Array | Iterable<Uint8Array> | AsyncIterable<Uint8Array>,
      boundary,
      options,
    );
  }
}
