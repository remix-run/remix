import * as fs from 'node:fs'
import gunzip from 'gunzip-maybe'
import tar from 'tar-stream'

export async function parse(filename: string): Promise<number> {
  let stream = fs.createReadStream(filename).pipe(gunzip())

  let start = performance.now()

  await new Promise<void>((resolve, reject) => {
    let extract = tar.extract()

    extract.on('error', reject)

    extract.on('entry', function (_header, stream, next) {
      stream.on('end', function () {
        next() // ready for next entry
      })

      stream.resume() // just auto drain the stream
    })

    extract.on('finish', function () {
      resolve()
    })

    stream.pipe(extract)
  })

  return performance.now() - start
}
