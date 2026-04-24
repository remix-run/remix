export function chunkPairs<value>(values: value[]): value[][] {
  let chunks: value[][] = []
  for (let index = 0; index < values.length; index += 2) {
    chunks.push(values.slice(index, index + 2))
  }
  return chunks
}
