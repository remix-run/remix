import { ContentDisposition, ContentType, SuperHeaders } from 'fetch-super-headers';

import { binaryToString } from '../lib/utils.js';

export const CRLF = '\r\n';

export function createReadableStream(
  content: string,
  chunkSize = 16 * 1024
): ReadableStream<Uint8Array> {
  let encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (let i = 0; i < content.length; i += chunkSize) {
        controller.enqueue(encoder.encode(content.slice(i, i + chunkSize)));
      }
      controller.close();
    },
  });
}

export function createMockRequest({
  headers,
  body = '',
}: {
  headers?: Headers | HeadersInit;
  body?: string | ReadableStream<Uint8Array>;
}): Request {
  return {
    headers: headers instanceof Headers ? headers : new Headers(headers),
    body: typeof body === 'string' ? createReadableStream(body) : body,
  } as unknown as Request;
}

type PartValue =
  | string
  | {
      filename?: string;
      filenameSplat?: string;
      mediaType?: string;
      content: string | Uint8Array;
    };

export function createMultipartBody(
  boundary: string,
  parts?: { [name: string]: PartValue }
): string {
  let lines = [];

  if (parts) {
    for (let [name, part] of Object.entries(parts)) {
      lines.push(`--${boundary}`);

      if (typeof part === 'string') {
        let contentDisposition = new ContentDisposition();
        contentDisposition.type = 'form-data';
        contentDisposition.name = name;
        lines.push(`Content-Disposition: ${contentDisposition}`);
        lines.push('');
        lines.push(part);
      } else {
        let contentDisposition = new ContentDisposition();
        contentDisposition.type = 'form-data';
        contentDisposition.name = name;
        contentDisposition.filename = part.filename;
        contentDisposition.filenameSplat = part.filenameSplat;

        lines.push(`Content-Disposition: ${contentDisposition}`);

        if (part.mediaType) {
          let contentType = new ContentType();
          contentType.mediaType = part.mediaType;

          lines.push(`Content-Type: ${contentType}`);
        }

        lines.push('');
        lines.push(typeof part.content === 'string' ? part.content : binaryToString(part.content));
      }
    }
  }

  lines.push(`--${boundary}--`);

  return lines.join(CRLF);
}

export function createMultipartMockRequest(
  boundary: string,
  parts?: { [name: string]: PartValue }
): Request {
  let headers = new SuperHeaders();
  headers.contentType.mediaType = 'multipart/form-data';
  headers.contentType.boundary = boundary;

  let body = createMultipartBody(boundary, parts);

  return createMockRequest({ headers, body });
}
