import { parseTar } from '@mjackson/tar-parser';
import { openFile } from '@mjackson/lazy-file/fs';

export async function parse(filename: string): Promise<number> {
  let stream = openFile(filename).stream().pipeThrough(new DecompressionStream('gzip'));

  let start = performance.now();

  await parseTar(stream, (_entry) => {
    // Do nothing
  });

  return performance.now() - start;
}
