// The router treats `request.signal` cooperatively: once it aborts, the router starts no more
// middleware or handlers and rejects with the abort reason, but it waits for work already in
// progress instead of racing it. See decisions/011-cooperative-request-aborts.md.

/**
 * Throws the abort reason if the request has aborted, cancelling the body of `value` when it is a
 * `Response` that nothing will read.
 *
 * @param value The result that arrived, if any
 * @param signal The request's abort signal
 */
export function throwIfRequestAborted(value: unknown, signal: AbortSignal): void {
  if (signal.aborted) {
    if (value instanceof Response) value.body?.cancel(signal.reason).catch(() => {})
    throw signal.reason
  }
}
