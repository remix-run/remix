export function requestAbortedError() {
  return new DOMException('The request was aborted', 'AbortError')
}

/**
 * Race a promise against an AbortSignal.
 * If the signal is aborted, the returned promise will reject with an AbortError.
 * If the promise settles first, the returned promise will settle with the same value/error.
 */
export async function raceWithAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) {
    throw requestAbortedError()
  }

  return new Promise<T>((resolve, reject) => {
    signal.addEventListener(
      'abort',
      () => {
        reject(requestAbortedError())
      },
      { once: true },
    )

    promise.then(resolve, reject)
  })
}
