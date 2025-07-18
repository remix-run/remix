import { parseMultipart } from '@remix-run/multipart-parser';

import { MultipartMessage } from '../messages.ts';

export async function parse(message: MultipartMessage): Promise<number> {
  let start = performance.now();

  for (let _ of parseMultipart(message.generateChunks(), { boundary: message.boundary })) {
    // Do nothing with the part, just iterate through it to measure parsing time
  }

  return performance.now() - start;
}
