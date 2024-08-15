import { parseMultipart } from '@mjackson/multipart-parser';

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

  for await (let _ of parseMultipart(stream, message.boundary)) {
    // Do nothing
  }

  return performance.now() - start;
}
