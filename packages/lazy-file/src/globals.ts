// This file provides global type augmentation for ReadableStream async iteration.
// See https://github.com/DefinitelyTyped/DefinitelyTyped/discussions/62651

declare global {
  interface ReadableStream<R = any> {
    values(options?: { preventCancel?: boolean }): AsyncIterableIterator<R>
    [Symbol.asyncIterator](): AsyncIterableIterator<R>
  }
}

export {}
