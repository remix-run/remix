import * as http from 'node:http';
import * as stream from 'node:stream';

import {
  getMultipartBoundary,
  MultipartParseError,
  MultipartParserOptions,
  MultipartParser,
  MultipartPart,
} from './multipart-parser.js';

/**
 * Returns true if the given request is a multipart request.
 */
export function isMultipartRequest(request: http.IncomingMessage): boolean {
  let contentType = request.headers['content-type'];
  return contentType != null && /^multipart\//i.test(contentType);
}

/**
 * Parse a multipart node.js request and yield each part as a `MultipartPart` object.
 */
export async function* parseMultipartRequest(
  request: http.IncomingMessage,
  options?: MultipartParserOptions
): AsyncGenerator<MultipartPart> {
  if (!isMultipartRequest(request)) {
    throw new MultipartParseError('Request is not a multipart request');
  }

  let boundary = getMultipartBoundary(request.headers['content-type']!);
  if (!boundary) {
    throw new MultipartParseError('Invalid Content-Type header: missing boundary');
  }

  yield* parseMultipartStream(request, boundary, options);
}

/**
 * Parse a multipart node.js `Readable` stream and yield each part as a `MultipartPart` object.
 *
 * Note: This is a low-level API that requires manual handling of the stream and boundary. For most
 * common cases, consider using `parseMultipartRequest(request)` instead.
 */
export async function* parseMultipartStream(
  stream: stream.Readable,
  boundary: string,
  options?: MultipartParserOptions
): AsyncGenerator<MultipartPart> {
  let parser = new MultipartParser(boundary, options);

  // The async generator will suspend execution of this function until the next part
  // is requested. This has the potential to cause a deadlock if the consumer tries
  // to `await part.text()` while the parser is waiting for more bytes. To fix this,
  // we read the stream in a promise and buffer parts until they're requested. When
  // new parts become available or when we're done reading the stream, we manually
  // run the loop to yield the buffered parts.
  let parts: MultipartPart[] = [];
  let done = false;
  let runTheLoop: () => void;
  let promise = readStream(stream, (chunk) => {
    parts.push(...parser.push(chunk));
    runTheLoop();
  }).finally(() => {
    done = true;
    runTheLoop();
  });

  while (!done) {
    await new Promise<void>((resolve) => {
      runTheLoop = resolve;
    });

    while (parts.length > 0) {
      yield parts.shift()!;
    }
  }

  // Throw any errors that occurred during the parse.
  await promise;

  if (!parser.done) {
    throw new MultipartParseError('Unexpected end of stream');
  }
}

function readStream(stream: stream.Readable, callback: (chunk: Buffer) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    stream.on('data', callback);
    stream.on('error', reject);
    stream.on('end', resolve);
    stream.resume();
  });
}
