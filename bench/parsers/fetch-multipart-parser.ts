import { parseMultipartFormData } from '../../dist/index.js';

import { MultipartMessage } from '../messages.js';

export async function parse(message: MultipartMessage): Promise<number> {
  let buffer = new TextEncoder().encode(message.content);
  let request = {
    headers: new Headers({
      'Content-Type': `multipart/form-data; boundary=${message.boundary}`,
    }),
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(buffer);
        controller.close();
      },
    }),
  } as Request;

  let start = performance.now();

  for await (let part of parseMultipartFormData(request, { maxFileSize: Infinity })) {
    // Do nothing
  }

  return performance.now() - start;
}
