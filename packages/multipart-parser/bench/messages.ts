import { concat, getRandomBytes } from './utils.ts'

const NodeDefaultHighWaterMark = 65536

export class MultipartMessage {
  boundary: string
  content: Uint8Array
  #chunkCache: Map<number, Uint8Array[]> = new Map()

  constructor(boundary: string, partSizesOrContents: number[] | Uint8Array[]) {
    this.boundary = boundary

    let chunks: Uint8Array[] = []

    function pushString(string: string): void {
      chunks.push(new TextEncoder().encode(string))
    }

    function pushLine(line = ''): void {
      pushString(line + '\r\n')
    }

    let partContents =
      typeof partSizesOrContents[0] === 'number'
        ? (partSizesOrContents as number[]).map((size) => getRandomBytes(size))
        : (partSizesOrContents as Uint8Array[])

    for (let i = 0; i < partContents.length; i++) {
      pushLine(`--${boundary}`)
      pushLine(`Content-Disposition: form-data; name="file${i}"; filename="file${i}.dat"`)
      pushLine('Content-Type: application/octet-stream')
      pushLine()
      chunks.push(partContents[i])
      pushLine()
    }

    pushString(`--${boundary}--`)

    this.content = concat(chunks)
  }

  getChunks(chunkSize = NodeDefaultHighWaterMark): Uint8Array[] {
    let cached = this.#chunkCache.get(chunkSize)
    if (cached !== undefined) {
      return cached
    }

    let chunks: Uint8Array[] = []
    for (let i = 0; i < this.content.length; i += chunkSize) {
      chunks.push(this.content.subarray(i, i + chunkSize))
    }

    this.#chunkCache.set(chunkSize, chunks)
    return chunks
  }

  *generateChunks(chunkSize = NodeDefaultHighWaterMark): Generator<Uint8Array> {
    for (let chunk of this.getChunks(chunkSize)) {
      yield chunk
    }
  }
}

const oneKb = 1024
const oneMb = 1024 * oneKb
const boundary = '----WebKitFormBoundaryzv0Og5zWtGjvzP2A'

function createAdversarialBytes(size: number, boundary: string): Uint8Array {
  let repeatingPattern = new TextEncoder().encode(`\r\n--${boundary.slice(0, -1)}X`)
  let bytes = new Uint8Array(size)

  for (let i = 0; i < size; i += repeatingPattern.length) {
    bytes.set(repeatingPattern.subarray(0, Math.min(repeatingPattern.length, size - i)), i)
  }

  return bytes
}

export const oneSmallFile = new MultipartMessage(boundary, [oneKb])

export const oneLargeFile = new MultipartMessage(boundary, [10 * oneMb])

export const oneHundredSmallFiles = new MultipartMessage(boundary, Array(100).fill(oneKb))

export const fiveLargeFiles = new MultipartMessage(boundary, [
  10 * oneMb,
  10 * oneMb,
  10 * oneMb,
  20 * oneMb,
  50 * oneMb,
])

export const oneLargeFileAdversarial = new MultipartMessage(boundary, [
  createAdversarialBytes(10 * oneMb, boundary),
])

export const fiveLargeFilesAdversarial = new MultipartMessage(boundary, [
  createAdversarialBytes(10 * oneMb, boundary),
  createAdversarialBytes(10 * oneMb, boundary),
  createAdversarialBytes(10 * oneMb, boundary),
  createAdversarialBytes(20 * oneMb, boundary),
  createAdversarialBytes(50 * oneMb, boundary),
])
