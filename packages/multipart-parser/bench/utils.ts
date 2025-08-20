export function concat(chunks: Uint8Array[]): Uint8Array {
  if (chunks.length === 1) return chunks[0]

  let length = 0
  for (let chunk of chunks) {
    length += chunk.length
  }

  let result = new Uint8Array(length)
  let offset = 0

  for (let chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.length
  }

  return result
}

export function getRandomBytes(size: number): Uint8Array {
  let chunks: Uint8Array[] = []

  for (let i = 0; i < size; i += 65536) {
    chunks.push(crypto.getRandomValues(new Uint8Array(Math.min(size - i, 65536))))
  }

  return concat(chunks)
}
