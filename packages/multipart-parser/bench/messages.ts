import { concat, getRandomBytes } from './utils.ts'

const NodeDefaultHighWaterMark = 65536

export class MultipartMessage {
  boundary: string
  content: Uint8Array

  constructor(boundary: string, partSizes: number[]) {
    this.boundary = boundary

    let chunks: Uint8Array[] = []

    function pushString(string: string): void {
      chunks.push(new TextEncoder().encode(string))
    }

    function pushLine(line = ''): void {
      pushString(line + '\r\n')
    }

    for (let i = 0; i < partSizes.length; i++) {
      pushLine(`--${boundary}`)
      pushLine(`Content-Disposition: form-data; name="file${i}"; filename="file${i}.dat"`)
      pushLine('Content-Type: application/octet-stream')
      pushLine()
      chunks.push(getRandomBytes(partSizes[i]))
      pushLine()
    }

    pushString(`--${boundary}--`)

    this.content = concat(chunks)
  }

  *generateChunks(chunkSize = NodeDefaultHighWaterMark): Generator<Uint8Array> {
    for (let i = 0; i < this.content.length; i += chunkSize) {
      yield this.content.subarray(i, i + chunkSize)
    }
  }
}

const oneKb = 1024
const oneMb = 1024 * oneKb

export const oneSmallFile = new MultipartMessage('----WebKitFormBoundaryzv0Og5zWtGjvzP2A', [oneKb])

export const oneLargeFile = new MultipartMessage('----WebKitFormBoundaryzv0Og5zWtGjvzP2A', [
  10 * oneMb,
])

export const oneHundredSmallFiles = new MultipartMessage(
  '----WebKitFormBoundaryzv0Og5zWtGjvzP2A',
  Array(100).fill(oneKb),
)

export const fiveLargeFiles = new MultipartMessage('----WebKitFormBoundaryzv0Og5zWtGjvzP2A', [
  10 * oneMb,
  10 * oneMb,
  10 * oneMb,
  20 * oneMb,
  50 * oneMb,
])
