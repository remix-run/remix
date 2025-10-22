/**
 * Race a promise against an AbortSignal.
 * If the signal is aborted, the returned promise will reject with an AbortError.
 * If the promise settles first, the returned promise will settle with the same value/error.
 */
export async function raceRequestAbort<T>(promise: Promise<T>, request: Request): Promise<T> {
  if (request.signal.aborted) {
    throw requestAbortError()
  }

  return new Promise<T>((resolve, reject) => {
    request.signal.addEventListener(
      'abort',
      () => {
        reject(requestAbortError())
      },
      { once: true },
    )

    promise.then(resolve, reject)
  })
}

export function requestAbortError() {
  return new DOMException('The request was aborted', 'AbortError')
}
