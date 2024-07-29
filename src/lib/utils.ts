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

export async function* readStream<T>(stream: ReadableStream<T>): AsyncGenerator<T> {
  let reader = stream.getReader();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      yield value;
    }
  } finally {
    reader.releaseLock();
  }
}

export function binaryToString(binary: Uint8Array): string {
  let string = '';
  for (let i = 0; i < binary.length; ++i) {
    string += String.fromCharCode(binary[i]);
  }
  return string;
}

export function stringToBinary(string: string): Uint8Array {
  let binary = new Uint8Array(string.length);
  for (let i = 0; i < string.length; ++i) {
    binary[i] = string.charCodeAt(i);
  }
  return binary;
}
