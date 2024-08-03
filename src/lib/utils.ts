export function isIterable<T>(value: unknown): value is Iterable<T> {
  return typeof value === 'object' && value != null && Symbol.iterator in value;
}

export function isAsyncIterable(value: unknown): value is AsyncIterable<Uint8Array> {
  return typeof value === 'object' && value != null && Symbol.asyncIterator in value;
}

export function concatChunks(chunks: Uint8Array[]): Uint8Array {
  if (chunks.length === 1) return chunks[0];

  let length = 0;
  for (let chunk of chunks) {
    length += chunk.length;
  }

  let result = new Uint8Array(length);
  let offset = 0;

  for (let chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}
