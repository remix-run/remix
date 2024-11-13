import { TarParser } from '@mjackson/tar-parser';
import { openFile } from '@mjackson/lazy-file/fs';

export async function parse(filename: string): Promise<number> {
  let stream = openFile(filename).stream().pipeThrough(new DecompressionStream('gzip'));

  let start = performance.now();

  await new TarParser().parse(stream, (_file) => {
    // Do nothing
  });

  return performance.now() - start;
}
