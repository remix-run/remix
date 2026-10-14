/**
 * Reason a passkey registration or authentication response was rejected.
 */
export type PasskeyErrorCode =
  | 'invalid_response'
  | 'challenge_missing'
  | 'challenge_expired'
  | 'challenge_consumed'
  | 'origin_mismatch'
  | 'rp_id_mismatch'
  | 'user_not_present'
  | 'user_not_verified'
  | 'user_mismatch'
  | 'unsupported_algorithm'
  | 'credential_exists'
  | 'credential_not_found'
  | 'credential_not_allowed'
  | 'invalid_signature'
  | 'counter_regression'

/**
 * Details for a rejected passkey response.
 */
export interface PasskeyError {
  /** Machine-readable reason the response was rejected. */
  code: PasskeyErrorCode
  /** Human-readable explanation intended for logs and diagnostics. */
  message: string
}

/**
 * Result returned when a passkey response is rejected.
 */
export interface PasskeyFailure {
  /** Indicates that verification failed. */
  ok: false
  /** Details explaining why verification failed. */
  error: PasskeyError
}

export class PasskeyVerificationError extends Error {
  code: PasskeyErrorCode

  constructor(code: PasskeyErrorCode, message: string) {
    super(message)
    this.name = 'PasskeyVerificationError'
    this.code = code
  }
}

export function toPasskeyFailure(error: unknown): PasskeyFailure {
  if (error instanceof PasskeyVerificationError) {
    return { ok: false, error: { code: error.code, message: error.message } }
  }

  throw error
}

export function invalidResponse(message: string): PasskeyVerificationError {
  return new PasskeyVerificationError('invalid_response', message)
}
