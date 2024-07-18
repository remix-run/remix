import { Readable } from 'node:stream';
import busboy from '@fastify/busboy';

import { MultipartMessage } from '../content.js';

export function parse(message: MultipartMessage): Promise<number> {
  let stream = new Readable({
    read() {
      this.push(message.payload);
      this.push(null);
    },
  });

  return new Promise((resolve, reject) => {
    let start = performance.now();

    let bb = new busboy.Busboy({
      headers: { 'content-type': `multipart/form-data; boundary=${message.boundary}` },
      limits: { fileSize: Infinity },
    });

    bb.on('error', reject);

    bb.on('finish', () => {
      resolve(performance.now() - start);
    });

    stream.pipe(bb);
  });
}
