export function sleep(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason)
      return
    }

    let timeout = setTimeout(() => {
      signal.removeEventListener('abort', handleAbort)
      resolve()
    }, milliseconds)

    function handleAbort() {
      clearTimeout(timeout)
      reject(signal.reason)
    }

    signal.addEventListener('abort', handleAbort, { once: true })
  })
}
