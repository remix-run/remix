// See https://github.com/DefinitelyTyped/DefinitelyTyped/discussions/62651

interface ReadableStream<R = any> {
  values(options?: { preventCancel?: boolean }): AsyncIterableIterator<R>
  [Symbol.asyncIterator](): AsyncIterableIterator<R>
}
