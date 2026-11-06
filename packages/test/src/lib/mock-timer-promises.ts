interface TimerOptions {
  signal?: AbortSignal
  ref?: boolean
}

export interface TimerScheduler {
  schedule(callback: () => void, delay: number, repeat: boolean): number
  cancel(id: number): void
  onReset(cleanup: () => void): () => void
}

interface TimerPromises {
  setTimeout<value>(
    delay?: number,
    value?: value,
    options?: TimerOptions,
  ): Promise<value | undefined>
  setImmediate<value>(value?: value, options?: TimerOptions): Promise<value | undefined>
  wait(delay?: number, options?: TimerOptions): Promise<void>
  setInterval<value>(
    delay?: number,
    value?: value,
    options?: TimerOptions,
  ): AsyncGenerator<value | undefined, void>
}

export function createTimerPromises(clock: TimerScheduler): TimerPromises {
  function sleep<value>(delay: number, value: value, options?: TimerOptions): Promise<value> {
    return new Promise((resolve, reject) => {
      let signal = options?.signal
      validateSignal(signal)
      if (signal?.aborted) {
        reject(abortError(signal))
        return
      }

      let stopListening = () => {}
      let unregister = () => {}
      function cleanup(): void {
        stopListening()
        unregister()
      }
      let id = clock.schedule(
        () => {
          cleanup()
          resolve(value)
        },
        delay,
        false,
      )
      if (signal) {
        stopListening = listenForAbort(signal, () => {
          clock.cancel(id)
          cleanup()
          reject(abortError(signal))
        })
      }
      unregister = clock.onReset(cleanup)
    })
  }

  return {
    setTimeout<value>(
      delay = 0,
      value?: value,
      options?: TimerOptions,
    ): Promise<value | undefined> {
      return sleep(delay, value, options)
    },
    setImmediate<value>(value?: value, options?: TimerOptions): Promise<value | undefined> {
      return sleep(-1, value, options)
    },
    wait(delay = 0, options?: TimerOptions): Promise<void> {
      return sleep(delay, undefined, options)
    },
    async *setInterval<value>(
      delay = 0,
      value?: value,
      options?: TimerOptions,
    ): AsyncGenerator<value | undefined, void> {
      let signal = options?.signal
      validateSignal(signal)
      if (signal?.aborted) throw abortError(signal)

      let pending = 0
      let stopped = false
      let wake: (() => void) | undefined
      let stopListening = () => {}
      let unregister = () => {}
      let id = clock.schedule(
        () => {
          pending++
          wake?.()
        },
        delay,
        true,
      )

      function cleanup(): void {
        stopped = true
        clock.cancel(id)
        stopListening()
        unregister()
        wake?.()
      }

      if (signal) {
        stopListening = listenForAbort(signal, () => {
          clock.cancel(id)
          wake?.()
        })
      }
      unregister = clock.onReset(cleanup)
      try {
        while (!stopped) {
          if (pending === 0) {
            if (signal?.aborted) throw abortError(signal)
            await new Promise<void>((resolve) => {
              wake = resolve
            })
            wake = undefined
          } else {
            pending--
            yield value
          }
        }
      } finally {
        cleanup()
      }
    },
  }
}

function listenForAbort(signal: AbortSignal, callback: () => void): () => void {
  // A dependent signal cannot be blocked by stopImmediatePropagation on the caller's signal.
  let dependent = AbortSignal.any([signal])
  dependent.addEventListener('abort', callback, { once: true })
  return () => dependent.removeEventListener('abort', callback)
}

function validateSignal(signal: unknown): asserts signal is AbortSignal | undefined {
  if (signal !== undefined && !(signal instanceof AbortSignal)) {
    throw Object.assign(new TypeError('options.signal must be an AbortSignal'), {
      code: 'ERR_INVALID_ARG_TYPE',
    })
  }
}

function abortError(signal: AbortSignal): Error {
  return Object.assign(new Error('The operation was aborted', { cause: signal.reason }), {
    name: 'AbortError',
    code: 'ABORT_ERR',
  })
}
