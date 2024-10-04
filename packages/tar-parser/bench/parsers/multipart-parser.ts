import { MultipartParser } from '@mjackson/multipart-parser';

import { MultipartMessage } from '../messages.js';

export async function parse(message: MultipartMessage): Promise<number> {
  let start = performance.now();

  await new MultipartParser(message.boundary).parse(message.generateChunks(), (_part) => {
    // Do nothing
  });

  return performance.now() - start;
}
