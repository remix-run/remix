// We need this little helper for environments that do not support
// ReadableStream.prototype[Symbol.asyncIterator] yet. See #46
export async function* readStream(stream: ReadableStream<Uint8Array>): AsyncIterable<Uint8Array> {
  let reader = stream.getReader()
  let done = false

  try {
    while (true) {
      let result = await reader.read()
      if (result.done) {
        done = true
        break
      }
      yield result.value
    }
  } finally {
    // Cancel on early exit, as native ReadableStream async iteration does
    if (!done) await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}
