export class AbortRace {
  readonly signal: AbortSignal
  #rejectors: Array<(reason: unknown) => void> | undefined
  #listening = false
  #disposed = false

  constructor(request: Request) {
    this.signal = request.signal
  }

  handleEvent(): void {
    this.#listening = false
    let reason = this.signal.reason
    let rejectors = this.#rejectors
    if (rejectors !== undefined) {
      for (let i = 0; i < rejectors.length; i++) {
        rejectors[i](reason)
      }
      rejectors.length = 0
    }
  }

  addRejector(reject: (reason: unknown) => void): void {
    if (this.signal.aborted) {
      reject(this.signal.reason)
      return
    }
    if (this.#disposed) return

    if (this.#rejectors === undefined) {
      this.#rejectors = [reject]
    } else {
      this.#rejectors.push(reject)
    }

    if (!this.#listening) {
      this.#listening = true
      this.signal.addEventListener('abort', this, { once: true })
    }
  }

  removeRejector(reject: (reason: unknown) => void): void {
    let rejectors = this.#rejectors
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

  race<value>(promise: Promise<value>): Promise<value> {
    let signal = this.signal
    if (signal.aborted) {
      promise.then(
        (value) => cancelAbandonedResponse(value, signal.reason),
        () => {},
      )
      return Promise.reject(signal.reason)
    }
    if (this.#disposed) return promise

    return new Promise<value>((resolve, reject) => {
      this.addRejector(reject)

      promise.then(
        (value) => {
          this.removeRejector(reject)
          // The race already rejected, so nothing else will read this response's body
          if (signal.aborted) cancelAbandonedResponse(value, signal.reason)
          resolve(value)
        },
        (error) => {
          this.removeRejector(reject)
          reject(error)
        },
      )
    })
  }

  dispose(): void {
    this.#disposed = true
    if (this.#listening) {
      this.#listening = false
      this.signal.removeEventListener('abort', this)
    }
    if (this.#rejectors !== undefined) {
      this.#rejectors.length = 0
    }
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
