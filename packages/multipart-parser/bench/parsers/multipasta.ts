import * as Multipasta from 'multipasta'

import { MultipartMessage } from '../messages.ts'

export function parse(message: MultipartMessage): Promise<number> {
  return new Promise((resolve, reject) => {
    const start = performance.now()
    const parser = Multipasta.make({
      headers: { 'content-type': `multipart/form-data; boundary=${message.boundary}` },
      onDone() {
        resolve(performance.now() - start)
      },
      onError: reject,
      onFile(_info) {
        return (_chunk) => {}
      },
      onField() {},
    })
    for (const chunk of message.generateChunks()) {
      parser.write(chunk)
    }
    parser.end()
  })
}
