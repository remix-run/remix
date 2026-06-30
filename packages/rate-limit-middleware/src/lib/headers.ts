/**
 * Values used to serialize rate limit response headers.
 */
export interface RateLimitHeaderOptions {
  /**
   * Maximum requests allowed in the window.
   */
  limit: number
  /**
   * Requests remaining in the current window.
   */
  remaining: number
  /**
   * Seconds until the current window resets.
   */
  reset: number
  /**
   * Window size in seconds.
   */
  window: number
}

/**
 * Serialized rate limit response header values.
 */
export interface RateLimitHeaderValues {
  /**
   * Value for the `RateLimit` response header.
   */
  rateLimit: string
  /**
   * Value for the `RateLimit-Policy` response header.
   */
  rateLimitPolicy: string
}

/**
 * Serializes both standard rate limit response headers.
 *
 * @param options Header field values.
 * @returns Serialized `RateLimit` and `RateLimit-Policy` header values.
 */
export function createRateLimitHeaderValues(
  options: RateLimitHeaderOptions,
): RateLimitHeaderValues {
  return {
    rateLimit: serializeRateLimitHeader(options),
    rateLimitPolicy: serializeRateLimitPolicyHeader(options),
  }
}

/**
 * Serializes the standard `RateLimit` response header.
 *
 * @param options Header field values.
 * @returns A `RateLimit` header value.
 */
export function serializeRateLimitHeader(options: RateLimitHeaderOptions): string {
  return `limit=${options.limit}, remaining=${options.remaining}, reset=${options.reset}`
}

/**
 * Serializes the standard `RateLimit-Policy` response header.
 *
 * @param options Header field values.
 * @returns A `RateLimit-Policy` header value.
 */
export function serializeRateLimitPolicyHeader(options: RateLimitHeaderOptions): string {
  return `${options.limit};w=${options.window}`
}
