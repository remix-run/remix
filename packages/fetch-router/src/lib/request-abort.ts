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
export function throwIfRequestAborted(signal: AbortSignal, response?: Response): void {
  if (signal.aborted) {
    if (response instanceof Response) {
      response.body?.cancel(signal.reason).catch(() => {})
    }
    throw signal.reason
  }
}

/**
 * Returns the error to reject with when work fails: the abort reason if the request has aborted,
 * so callers see the same rejection however the work ended, or else the work's own error.
 *
 * @param signal The request's abort signal
 * @param error The error the work failed with
 * @returns The abort reason or `error`
 */
export function getRejectionReason(signal: AbortSignal, error: unknown): unknown {
  return signal.aborted ? signal.reason : error
}
