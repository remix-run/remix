import {
  MultipartParseError,
  type MultipartPartHandler,
  type MultipartParserOptions,
  parseMultipart,
} from './multipart.ts';

/**
 * Extracts the boundary string from a `multipart/*` content type.
 */
export function getMultipartBoundary(contentType: string): string | null {
  let match = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType);
  return match ? (match[1] ?? match[2]) : null;
}

/**
 * Returns true if the given request contains multipart data.
 */
export function isMultipartRequest(request: Request): boolean {
  let contentType = request.headers.get('Content-Type');
  return contentType != null && contentType.startsWith('multipart/');
}

/**
 * Parse a multipart [`Request`](https://developer.mozilla.org/en-US/docs/Web/API/Request) and yield each part as
 * a `MultipartPart` object. Useful in HTTP server contexts for handling incoming `multipart/*` requests.
 */
export async function parseMultipartRequest(
  request: Request,
  handler: MultipartPartHandler,
): Promise<void>;
export async function parseMultipartRequest(
  request: Request,
  options: MultipartParserOptions,
  handler: MultipartPartHandler,
): Promise<void>;
export async function parseMultipartRequest(
  request: Request,
  options: MultipartParserOptions | MultipartPartHandler,
  handler?: MultipartPartHandler,
): Promise<void> {
  if (typeof options === 'function') {
    handler = options;
    options = {};
  }

  if (!isMultipartRequest(request)) {
    throw new MultipartParseError('Request is not a multipart request');
  }
  if (!request.body) {
    throw new MultipartParseError('Request body is empty');
  }

  let boundary = getMultipartBoundary(request.headers.get('Content-Type')!);
  if (!boundary) {
    throw new MultipartParseError('Invalid Content-Type header: missing boundary');
  }

  await parseMultipart(
    request.body,
    { boundary, maxHeaderSize: options.maxHeaderSize, maxFileSize: options.maxFileSize },
    handler!,
  );
}
