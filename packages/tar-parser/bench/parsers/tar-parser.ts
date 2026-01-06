import { parseTar } from '@remix-run/tar-parser'
import { openLazyFile } from '@remix-run/fs'

export async function parse(filename: string): Promise<number> {
  let stream = openLazyFile(filename).stream().pipeThrough(new DecompressionStream('gzip'))

  let start = performance.now()

  await parseTar(stream, (_entry) => {
    // Do nothing
  })

  return performance.now() - start
}
