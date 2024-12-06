import * as http from 'node:http';
import * as stream from 'node:stream';

import { PartValue, createMultipartBody } from './utils.js';

export function createReadable(content: Uint8Array, chunkSize = 16 * 1024): stream.Readable {
  let i = 0;

  return new stream.Readable({
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
