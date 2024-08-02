import { MultipartParser } from '@mjackson/multipart-parser';

import { MultipartMessage } from '../messages.js';

export async function parse(message: MultipartMessage): Promise<number> {
  let start = performance.now();

  let parser = new MultipartParser(message.boundary, { maxFileSize: Infinity });

  await parser.parse(message.generateChunks(), (_) => {
    // Do nothing
  });

  return performance.now() - start;
}
