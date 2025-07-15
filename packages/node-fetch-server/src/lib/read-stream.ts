export async function* readStream(stream: ReadableStream<Uint8Array>): AsyncIterable<Uint8Array> {
  let reader = stream.getReader();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    yield value;
  }
}
