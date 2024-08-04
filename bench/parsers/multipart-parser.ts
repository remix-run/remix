import { MultipartParser } from '@mjackson/multipart-parser';

import { MultipartMessage } from '../messages.js';

export async function parse(message: MultipartMessage): Promise<number> {
  let stream = new ReadableStream({
    start(controller) {
      for (let chunk of message.generateChunks()) {
        controller.enqueue(chunk);
      }
      controller.close();
    },
  });

  let start = performance.now();

  await new MultipartParser(message.boundary, { maxFileSize: Infinity }).parse(stream, (_) => {
    // Do nothing
  });

  return performance.now() - start;
}
