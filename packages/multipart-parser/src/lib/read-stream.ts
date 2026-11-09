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
    // Stop the sender if the consumer quit early, e.g. because a limit was exceeded
    if (!done) await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}
