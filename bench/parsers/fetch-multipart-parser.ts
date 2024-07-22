import { parseMultipartFormData } from '../../dist/index.js';

import { MultipartMessage } from '../messages.js';

export async function parse(message: MultipartMessage): Promise<number> {
  let request = {
    headers: new Headers({
      'Content-Type': `multipart/form-data; boundary=${message.boundary}`,
    }),
    body: new ReadableStream({
      start(controller) {
        for (let chunk of message.generateChunks()) {
          controller.enqueue(chunk);
        }
        controller.close();
      },
    }),
  } as Request;

  let start = performance.now();

  let options = {
    maxBufferSize: Math.pow(2, 26),
    maxFileSize: Infinity,
  };
  for await (let _ of parseMultipartFormData(request, options)) {
    // Do nothing
  }

  return performance.now() - start;
}
