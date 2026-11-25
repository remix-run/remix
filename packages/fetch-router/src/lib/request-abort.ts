export class AbortRace {
  #signal: AbortSignal
  #rejectors = new Set<(reason: unknown) => void>()
  #listening = false
  #disposed = false

  constructor(request: Request) {
    this.#signal = request.signal
  }

  handleEvent(): void {
    this.#listening = false
    this.#signal.removeEventListener('abort', this)
    let reason = this.#signal.reason
    for (let reject of this.#rejectors) {
      reject(reason)
    }
    this.#rejectors.clear()
  }

  race<value>(promise: Promise<value>): Promise<value> {
    let signal = this.#signal
    if (signal.aborted) {
      promise.then(
        (value) => cancelAbandonedResponse(value, signal.reason),
        () => {},
      )
      return Promise.reject(signal.reason)
    }
    if (this.#disposed) return promise

    if (!this.#listening) {
      this.#listening = true
      signal.addEventListener('abort', this)
    }

    return new Promise<value>((resolve, reject) => {
      this.#rejectors.add(reject)

      promise.then(
        (value) => {
          this.#rejectors.delete(reject)
          // The race already rejected, so nothing else will read this response's body
          if (signal.aborted) cancelAbandonedResponse(value, signal.reason)
          resolve(value)
        },
        (error) => {
          this.#rejectors.delete(reject)
          reject(error)
        },
      )
    })
  }

  dispose(): void {
    this.#disposed = true
    if (this.#listening) {
      this.#listening = false
      this.#signal.removeEventListener('abort', this)
    }
    this.#rejectors.clear()
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
    let onAbort = () => {
      signal.removeEventListener('abort', onAbort)
      reject(signal.reason)
    }

    signal.addEventListener('abort', onAbort)

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
