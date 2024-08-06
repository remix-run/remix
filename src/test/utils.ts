import Headers from '@mjackson/headers';

import { concat } from '../lib/buffer-utils.js';

export function createReadableStream(
  content: string | Uint8Array,
  chunkSize = 64 * 1024,
): ReadableStream<Uint8Array> {
  let encoder = new TextEncoder();

  return new ReadableStream({
    start(controller) {
      for (let i = 0; i < content.length; i += chunkSize) {
        controller.enqueue(
          typeof content === 'string'
            ? encoder.encode(content.slice(i, i + chunkSize))
            : content.subarray(i, i + chunkSize),
        );
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
  body?: string | Uint8Array | ReadableStream<Uint8Array>;
}): Request {
  return {
    headers: headers instanceof Headers ? headers : new Headers(headers),
    body:
      typeof body === 'string' || body instanceof Uint8Array ? createReadableStream(body) : body,
  } as unknown as Request;
}

export type PartValue =
  | string
  | {
      filename?: string;
      filenameSplat?: string;
      mediaType?: string;
      content: string | Uint8Array;
    };

export function createMultipartBody(
  boundary: string,
  parts?: { [name: string]: PartValue },
): Uint8Array {
  let chunks: Uint8Array[] = [];

  function pushString(string: string) {
    chunks.push(new TextEncoder().encode(string));
  }

  function pushLine(line = '') {
    pushString(line + '\r\n');
  }

  if (parts) {
    for (let [name, part] of Object.entries(parts)) {
      pushLine(`--${boundary}`);

      if (typeof part === 'string') {
        let headers = new Headers({
          contentDisposition: {
            type: 'form-data',
            name,
          },
        });

        pushLine(`${headers}`);
        pushLine();
        pushLine(part);
      } else {
        let headers = new Headers({
          contentDisposition: {
            type: 'form-data',
            name,
            filename: part.filename,
            filenameSplat: part.filenameSplat,
          },
        });

        if (part.mediaType) {
          headers.contentType = part.mediaType;
        }

        pushLine(`${headers}`);
        pushLine();
        if (typeof part.content === 'string') {
          pushLine(part.content);
        } else {
          chunks.push(part.content);
          pushLine();
        }
      }
    }
  }

  pushString(`--${boundary}--`);

  return concat(chunks);
}

export function createMultipartMockRequest(
  boundary: string,
  parts?: { [name: string]: PartValue },
): Request {
  let headers = new Headers({
    contentType: {
      mediaType: 'multipart/form-data',
      boundary,
    },
  });

  let body = createMultipartBody(boundary, parts);

  return createMockRequest({ headers, body });
}
