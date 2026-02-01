export type Assert<T extends true> = T

export type Equal<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? true : false

export async function drain(stream: ReadableStream<Uint8Array>): Promise<string> {
  let reader = stream.getReader()
  let decoder = new TextDecoder()
  let html = ''

  while (true) {
    let { done, value } = await reader.read()
    if (done) break
    html += decoder.decode(value)
  }

  return html
}

export function readChunks(stream: ReadableStream<Uint8Array>): AsyncGenerator<string, void, void> {
  let reader = stream.getReader()
  let decoder = new TextDecoder()

  return (async function* () {
    while (true) {
      let { done, value } = await reader.read()
      if (done) break
      yield decoder.decode(value)
    }
  })()
}

export function withResolvers<T = unknown>(): [
  Promise<T>,
  (value: T) => void,
  (error: unknown) => void,
] {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  let promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return [promise, resolve, reject]
}
