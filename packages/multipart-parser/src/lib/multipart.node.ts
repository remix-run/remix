import type * as http from 'node:http';
import { Readable } from 'node:stream';

import {
  MultipartParseError,
  type MultipartPartHandler,
  type ParseMultipartOptions,
  parseMultipart as parseMultipartWeb,
  type MultipartParserOptions,
} from './multipart.ts';
import { getMultipartBoundary } from './multipart-request.ts';

/**
 * Returns true if the given request is a multipart request.
 */
export function isMultipartRequest(req: http.IncomingMessage): boolean {
  let contentType = req.headers['content-type'];
  return contentType != null && /^multipart\//i.test(contentType);
}

/**
 * Parse a multipart Node.js request and yield each part as a `MultipartPart` object.
 */
export async function parseMultipartRequest(
  req: http.IncomingMessage,
  handler: MultipartPartHandler,
): Promise<void>;
export async function parseMultipartRequest(
  req: http.IncomingMessage,
  options: MultipartParserOptions,
  handler: MultipartPartHandler,
): Promise<void>;
export async function parseMultipartRequest(
  req: http.IncomingMessage,
  options: MultipartParserOptions | MultipartPartHandler,
  handler?: MultipartPartHandler,
): Promise<void> {
  if (typeof options === 'function') {
    handler = options;
    options = {};
  }

  if (!isMultipartRequest(req)) {
    throw new MultipartParseError('Request is not a multipart request');
  }

  let boundary = getMultipartBoundary(req.headers['content-type']!);
  if (!boundary) {
    throw new MultipartParseError('Invalid Content-Type header: missing boundary');
  }

  await parseMultipart(
    req,
    { boundary, maxHeaderSize: options.maxHeaderSize, maxFileSize: options.maxFileSize },
    handler!,
  );
}

/**
 * Parse a multipart Node.js `Buffer` or `Readable` stream and yield each part as a `MultipartPart` object.
 *
 * Note: This is a low-level API that requires manual handling of the stream and boundary. If you're
 * building a web server, consider using `parseMultipartRequest(request)` instead.
 */
export async function parseMultipart(
  message: Readable | Buffer | Iterable<Buffer> | AsyncIterable<Buffer>,
  options: ParseMultipartOptions,
  handler: MultipartPartHandler,
): Promise<void> {
  if (message instanceof Readable) {
    await parseMultipartWeb(Readable.toWeb(message), options, handler);
  } else {
    await parseMultipartWeb(
      message as Uint8Array | Iterable<Uint8Array> | AsyncIterable<Uint8Array>,
      options,
      handler,
    );
  }
}
