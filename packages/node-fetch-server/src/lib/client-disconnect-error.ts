/**
 * Error used to settle pending request body reads when the client goes away
 * (an `error`, legacy `aborted`, or close-before-`end` on the incoming request)
 * before the body has been fully received.
 */
export class ClientDisconnectError extends Error {
  constructor(cause?: unknown) {
    super(
      'Client disconnected before the request body was fully received',
      cause === undefined ? undefined : { cause },
    )
    this.name = 'ClientDisconnectError'
  }
}

export function isClientDisconnectError(error: unknown): error is ClientDisconnectError {
  return error instanceof ClientDisconnectError
}
