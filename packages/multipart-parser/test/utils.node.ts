import type * as http from 'node:http';
import { Readable } from 'node:stream';

import { type PartValue, createMultipartBody } from './utils.ts';

export function createReadable(content: Uint8Array, chunkSize = 16 * 1024): Readable {
  let i = 0;

  return new Readable({
    read() {
      if (i < content.length) {
        this.push(content.subarray(i, i + chunkSize));
        i += chunkSize;
      } else {
        this.push(null);
      }
    },
  });
}

export function createMultipartMockRequest(
  boundary: string,
  parts?: { [name: string]: PartValue },
): http.IncomingMessage {
  let body = createMultipartBody(boundary, parts);

  let request = createReadable(body) as http.IncomingMessage;
  request.headers = {
    'content-type': `multipart/form-data; boundary=${boundary}`,
  };

  return request;
}
