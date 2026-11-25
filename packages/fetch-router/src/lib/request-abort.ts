export interface AbortRace {
  readonly signal: AbortSignal
  addRejector(reject: (reason: unknown) => void): void
  removeRejector(reject: (reason: unknown) => void): void
  race<value>(promise: Promise<value>): Promise<value>
  dispose(): void
}

export function createAbortRace(request: Request): AbortRace {
  let signal = request.signal
  let rejectors: Array<(reason: unknown) => void> | undefined
  let onAbort: (() => void) | undefined

  function addRejector(reject: (reason: unknown) => void): void {
    if (onAbort === undefined) {
      rejectors = [reject]
      onAbort = () => {
        let reason = signal.reason
        if (rejectors !== undefined) {
          for (let i = 0; i < rejectors.length; i++) {
            rejectors[i](reason)
          }
          rejectors.length = 0
        }
      }
      signal.addEventListener('abort', onAbort, { once: true })
    } else {
      rejectors!.push(reject)
    }
  }

  function removeRejector(reject: (reason: unknown) => void): void {
    if (rejectors === undefined || rejectors.length === 0) return
    // Middleware unwinds LIFO, so the common case is popping the last entry in O(1)
    let last = rejectors.length - 1
    if (rejectors[last] === reject) {
      rejectors.pop()
      return
    }
    let idx = rejectors.indexOf(reject)
    if (idx !== -1) {
      rejectors.splice(idx, 1)
    }
  }

  return {
    signal,
    addRejector,
    removeRejector,
    race<value>(promise: Promise<value>): Promise<value> {
      if (signal.aborted) {
        promise.then(
          (value) => cancelAbandonedResponse(value, signal.reason),
          () => {},
        )
        return Promise.reject(signal.reason)
      }

      return new Promise<value>((resolve, reject) => {
        addRejector(reject)

        promise.then(
          (value) => {
            removeRejector(reject)
            // The race already rejected, so nothing else will read this response's body
            if (signal.aborted) cancelAbandonedResponse(value, signal.reason)
            resolve(value)
          },
          (error) => {
            removeRejector(reject)
            reject(error)
          },
        )
      })
    },
    dispose(): void {
      if (onAbort !== undefined) {
        signal.removeEventListener('abort', onAbort)
        onAbort = undefined
        if (rejectors !== undefined) rejectors.length = 0
      }
    },
  }
}

export function raceRequestAbort<value>(promise: Promise<value>, request: Request): Promise<value> {
  let signal = request.signal

  if (signal.aborted) {
    promise.then(
      (value) => cancelAbandonedResponse(value, signal.reason),
      () => {},
    )
    throw signal.reason
  }

  return new Promise<value>((resolve, reject) => {
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

export function cancelAbandonedResponse(value: unknown, reason: unknown): void {
  if (value instanceof Response) value.body?.cancel(reason).catch(() => {})
}
