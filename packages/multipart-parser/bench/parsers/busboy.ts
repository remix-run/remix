import { Readable } from 'node:stream'
import busboy from 'busboy'

import { MultipartMessage } from '../messages.ts'

export function parse(message: MultipartMessage): Promise<number> {
  let stream = new Readable({
    read() {
      for (let chunk of message.generateChunks()) {
        this.push(chunk)
      }
      this.push(null)
    },
  })

  return new Promise((resolve, reject) => {
    let start = performance.now()

    let bb = busboy({
      headers: { 'content-type': `multipart/form-data; boundary=${message.boundary}` },
      limits: { fileSize: Infinity },
    })

    bb.on('field', () => {})

    bb.on('file', (_name, stream) => {
      stream.resume()
    })

    bb.on('error', reject)

    bb.on('close', () => {
      resolve(performance.now() - start)
    })

    stream.pipe(bb)
  })
}
