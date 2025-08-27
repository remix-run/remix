// We need this little helper for environments that do not support
// ReadableStream.prototype[Symbol.asyncIterator] yet. See #46
export async function* readStream(stream: ReadableStream<Uint8Array>): AsyncIterable<Uint8Array> {
  let reader = stream.getReader()

  try {
    while (true) {
      let result = await reader.read()
      if (result.done) break
      yield result.value
    }
  } finally {
    reader.releaseLock()
  }
}
