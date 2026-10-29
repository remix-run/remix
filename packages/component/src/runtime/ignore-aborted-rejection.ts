/**
 * Ignores a rejection from async runtime work once that work's signal has been
 * aborted. Rejections from work whose signal is still live are re-thrown so
 * they continue to surface as unhandled rejections.
 *
 * @param result The value returned by an event handler or task.
 * @param signal The signal passed to that handler or task.
 */
export function ignoreAbortedRejection(result: unknown, signal: AbortSignal): void {
  if (!isThenable(result)) return
  result.then(undefined, (error: unknown) => {
    if (signal.aborted) return
    throw error
  })
}

function isThenable(value: unknown): value is PromiseLike<unknown> {
  return (
    value !== null &&
    (typeof value === 'object' || typeof value === 'function') &&
    typeof (value as { then?: unknown }).then === 'function'
  )
}
