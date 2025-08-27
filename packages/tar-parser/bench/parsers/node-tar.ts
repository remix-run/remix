import * as fs from 'node:fs'
import * as tar from 'tar'

export async function parse(filename: string): Promise<number> {
  let stream = fs.createReadStream(filename)

  let start = performance.now()

  await new Promise<void>((resolve, reject) => {
    stream
      .pipe(tar.t())
      .on('entry', (entry) => {
        entry.resume()
      })
      .on('finish', () => {
        resolve()
      })
  })

  return performance.now() - start
}
