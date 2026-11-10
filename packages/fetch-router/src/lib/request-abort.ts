export function raceRequestAbort<T>(promise: Promise<T>, request: Request): Promise<T> {
  let signal = request.signal

  if (signal.aborted) {
    promise.then(
      (value) => cancelAbandonedResponse(value, signal.reason),
      () => {},
    )
    throw signal.reason
  }

  return new Promise<T>((resolve, reject) => {
    let onAbort = () => reject(signal.reason)

    signal.addEventListener('abort', onAbort, { once: true })

    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort)
        // The race already rejected, so nothing else will read this response's body
        if (signal.aborted) cancelAbandonedResponse(value, signal.reason)
        resolve(value)
      },
      (error) => {
        signal.removeEventListener('abort', onAbort)
        reject(error)
      },
    )
  })
}

function cancelAbandonedResponse(value: unknown, reason: unknown): void {
  if (value instanceof Response) value.body?.cancel(reason).catch(() => {})
}
