/**
 * Race a promise against an AbortSignal.
 * If the signal is aborted, the returned promise will reject with an AbortError.
 * If the promise settles first, the returned promise will settle with the same value/error.
 */
export async function raceRequestAbort<T>(promise: Promise<T>, request: Request): Promise<T> {
  let signal = request.signal

  if (signal.aborted) {
    throw signal.reason
  }

  return new Promise<T>((resolve, reject) => {
    let onAbort = () => reject(signal.reason)

    signal.addEventListener('abort', onAbort, { once: true })

    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort)
        resolve(value)
      },
      (error) => {
        signal.removeEventListener('abort', onAbort)
        reject(error)
      },
    )
  })
}
