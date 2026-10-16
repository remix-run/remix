import { parseMultipartStream } from '@remix-run/multipart-parser'

import { MultipartMessage } from '../messages.ts'

const BenchmarkMaxFileSize = 100 * 1024 * 1024 // 100 MiB

export async function parse(message: MultipartMessage): Promise<number> {
  let chunks = message.generateChunks()
  let stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      let result = chunks.next()
      if (result.done) {
        controller.close()
      } else {
        controller.enqueue(result.value)
      }
    },
  })

  let start = performance.now()

  for await (let part of parseMultipartStream(stream, {
    boundary: message.boundary,
    maxFileSize: BenchmarkMaxFileSize,
  })) {
    // Read each part's content without keeping it, like the other parsers
    for await (let _ of part) {
    }
  }

  return performance.now() - start
}
