export function concatChunks(chunks: Uint8Array[]): Uint8Array {
  if (chunks.length === 1) return chunks[0];

  let length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  let result = new Uint8Array(length);
  let offset = 0;

  for (let i = 0; i < chunks.length; ++i) {
    result.set(chunks[i], offset);
    offset += chunks[i].length;
  }

  return result;
}

export async function readStream<T>(
  stream: ReadableStream<T>,
  callback: (chunk: T) => void
): Promise<void> {
  let reader = stream.getReader();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      callback(value);
    }
  } finally {
    reader.releaseLock();
  }
}
