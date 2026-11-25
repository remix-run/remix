// The router treats `request.signal` cooperatively: once it aborts, the router starts no more
// middleware or handlers and rejects with the abort reason, but it waits for work already in
// progress instead of racing it. See decisions/011-cooperative-request-aborts.md.

/**
 * Throws the abort reason if the request has aborted, cancelling the body of `response` because
 * nothing will read it.
 *
 * @param signal The request's abort signal
 * @param response The response that arrived, if any
 */
export function throwIfRequestAborted(signal: AbortSignal, response?: unknown): void {
  if (signal.aborted) {
    cancelUnreadResponse(response, signal.reason)
    throw signal.reason
  }
}

/**
 * Rethrows `error` from work that settled, or the abort reason instead if the request aborted
 * first, so callers see the same rejection however the work ended.
 *
 * @param signal The request's abort signal
 * @param error The error the work rejected with
 */
export function rethrowUnlessAborted(signal: AbortSignal, error: unknown): never {
  throw signal.aborted ? signal.reason : error
}

/**
 * Cancels the body of a response, or of the response a promise resolves to, that nothing will read.
 *
 * @param response A response, a promise for one, or any other value
 * @param reason The reason to cancel the body with
 */
export function cancelUnreadResponse(response: unknown, reason: unknown): void {
  if (response instanceof Promise) {
    response.then(
      (value) => cancelUnreadResponse(value, reason),
      () => {},
    )
  } else if (response instanceof Response) {
    response.body?.cancel(reason).catch(() => {})
  }
}
