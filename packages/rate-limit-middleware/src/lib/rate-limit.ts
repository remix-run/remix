import type { Middleware, RequestContext } from '@remix-run/fetch-router'

import { withRateLimitHeaders } from './headers.ts'
import type { RateLimitStore, RateLimitStoreEntry } from './store.ts'

const POLICY_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9._-]{0,63}$/
const MAX_KEY_LENGTH = 1024

/** Rate limit state for one named policy and client bucket. */
export interface RateLimitState {
  /** Number of requests counted in the active window. */
  readonly count: number
  /** Maximum requests allowed in the window. */
  readonly limit: number
  /** Name of the policy. */
  readonly name: string
  /** Requests remaining in the active window. */
  readonly remaining: number
  /** Unix epoch timestamp in milliseconds when the active window resets. */
  readonly resetAt: number
  /** Seconds until the active window resets. */
  readonly retryAfter: number
}

/** Options for fixed-window rate limit middleware. */
export interface RateLimitOptions {
  /**
   * Computes a stable, non-secret client bucket key.
   *
   * Keys must contain between 1 and 1,024 characters. Fetch requests do not expose a trusted
   * client address, so applications must derive this value from authenticated identity or other
   * trusted server data.
   */
  key(context: RequestContext): string | Promise<string>
  /** Maximum requests allowed in each window. */
  limit: number
  /** Policy name used for store namespacing and response fields. */
  name: string
  /**
   * Creates a custom response when the policy is exceeded.
   *
   * The middleware normalizes the response status to `429` and adds rate limit fields.
   */
  onLimitExceeded?: (context: RequestContext, state: RateLimitState) => Response | Promise<Response>
  /** Store that atomically counts requests. Use `memoryStore()` only for single-process servers. */
  store: RateLimitStore
  /** Window size in milliseconds. */
  window: number
}

/**
 * Creates fixed-window rate limit middleware for one named policy.
 *
 * @param options Policy, client key, store, and rejection response configuration.
 * @returns Middleware that rejects requests after the configured limit.
 */
export function rateLimit(options: RateLimitOptions): Middleware {
  validateOptions(options)
  let { key, limit, name, onLimitExceeded, store, window } = options

  return async (context, next) => {
    let clientKey = await key(context)
    validateKey(clientKey)

    let entry = await store.increment({
      key: clientKey,
      name,
      window,
    })
    validateStoreEntry(entry)

    let state = createRateLimitState(name, limit, entry)

    if (state.count > state.limit) {
      let response = onLimitExceeded
        ? await onLimitExceeded(context, state)
        : defaultLimitExceededResponse()

      return withRateLimitHeaders(ensureTooManyRequestsResponse(response), state, window, true)
    }

    let response = await next()
    return withRateLimitHeaders(response, state, window, false)
  }
}

/**
 * Creates public state from a store result.
 *
 * @param name Policy name.
 * @param limit Maximum requests allowed.
 * @param entry Current store entry.
 * @returns Current rate limit state.
 */
function createRateLimitState(
  name: string,
  limit: number,
  entry: RateLimitStoreEntry,
): RateLimitState {
  return {
    count: entry.count,
    limit,
    name,
    remaining: Math.max(0, limit - entry.count),
    resetAt: entry.resetAt,
    retryAfter: Math.max(0, Math.ceil((entry.resetAt - Date.now()) / 1000)),
  }
}

/** @returns The default rejected response. */
function defaultLimitExceededResponse(): Response {
  return new Response('Too Many Requests', {
    status: 429,
    statusText: 'Too Many Requests',
  })
}

/**
 * Normalizes custom rejection responses to status 429.
 *
 * @param response Custom rejection response.
 * @returns A response with status 429.
 */
function ensureTooManyRequestsResponse(response: Response): Response {
  if (response.status === 429) return response

  return new Response(response.body, {
    status: 429,
    statusText: 'Too Many Requests',
    headers: response.headers,
  })
}

/**
 * Validates middleware configuration at startup.
 *
 * @param options Rate limit options.
 */
function validateOptions(options: RateLimitOptions): void {
  if (!POLICY_NAME_PATTERN.test(options.name)) {
    throw new Error(
      'Rate limit `name` must start with a letter and contain at most 64 letters, numbers, dots, underscores, or dashes.',
    )
  }

  if (!Number.isSafeInteger(options.limit) || options.limit < 1) {
    throw new Error('Rate limit `limit` must be a positive safe integer.')
  }

  if (!Number.isSafeInteger(options.window) || options.window < 1) {
    throw new Error('Rate limit `window` must be a positive safe integer.')
  }
}

/**
 * Validates a client key before passing it to storage.
 *
 * @param key Client bucket key.
 */
function validateKey(key: string): void {
  if (typeof key !== 'string' || key.length < 1 || key.length > MAX_KEY_LENGTH) {
    throw new Error('Rate limit `key` must return a string between 1 and 1,024 characters.')
  }
}

/**
 * Validates untrusted store output before using it in response fields.
 *
 * @param entry Store result.
 */
function validateStoreEntry(entry: RateLimitStoreEntry): void {
  if (!Number.isSafeInteger(entry.count) || entry.count < 1) {
    throw new Error('Rate limit store `count` must be a positive safe integer.')
  }

  if (!Number.isSafeInteger(entry.resetAt) || entry.resetAt < 1) {
    throw new Error('Rate limit store `resetAt` must be a positive safe integer.')
  }
}
