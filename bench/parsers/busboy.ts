import { Readable } from 'node:stream';
import busboy from 'busboy';

import { MultipartMessage } from '../messages.js';

export function parse(message: MultipartMessage): Promise<number> {
  let stream = new Readable({
    read() {
      this.push(message.content);
      this.push(null);
    },
  });

  return new Promise((resolve, reject) => {
    let start = performance.now();

    let bb = busboy({
      headers: { 'content-type': `multipart/form-data; boundary=${message.boundary}` },
      limits: { fileSize: Infinity },
    });

    bb.on('error', reject);

    bb.on('close', () => {
      resolve(performance.now() - start);
    });

    stream.pipe(bb);
  });
}
