import type { RateLimitState } from './rate-limit.ts'

interface RateLimitHeaderValues {
  rateLimit: string
  rateLimitPolicy: string
}

/**
 * Adds current RateLimit draft fields to a response without replacing other named policies.
 *
 * @param response Response to decorate.
 * @param state Current policy state.
 * @param window Window size in milliseconds.
 * @param retryAfter Whether to add `Retry-After` for a rejected request.
 * @returns A response with rate limit fields.
 */
export function withRateLimitHeaders(
  response: Response,
  state: RateLimitState,
  window: number,
  retryAfter: boolean,
): Response {
  let headers = new Headers(response.headers)
  let values = createRateLimitHeaderValues(state, window)

  headers.append('Ratelimit', values.rateLimit)
  headers.append('Ratelimit-Policy', values.rateLimitPolicy)

  if (retryAfter) {
    headers.set('Retry-After', String(state.retryAfter))
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

/**
 * Serializes one named policy using the current IETF RateLimit field syntax.
 *
 * @param state Current policy state.
 * @param window Window size in milliseconds.
 * @returns Serialized `RateLimit` and `RateLimit-Policy` values.
 */
export function createRateLimitHeaderValues(
  state: RateLimitState,
  window: number,
): RateLimitHeaderValues {
  let name = JSON.stringify(state.name)
  let windowSeconds = Math.max(1, Math.ceil(window / 1000))

  return {
    rateLimit: `${name};r=${state.remaining};t=${state.retryAfter}`,
    rateLimitPolicy: `${name};q=${state.limit};w=${windowSeconds}`,
  }
}
