export function raceRequestAbort<T>(promise: Promise<T>, request: Request): Promise<T> {
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
