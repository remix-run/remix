import { parseMultipart } from '@mjackson/multipart-parser';

import { MultipartMessage } from '../messages.ts';

export async function parse(message: MultipartMessage): Promise<number> {
  let start = performance.now();

  await parseMultipart(message.generateChunks(), { boundary: message.boundary }, (_part) => {
    // Do nothing
  });

  return performance.now() - start;
}
