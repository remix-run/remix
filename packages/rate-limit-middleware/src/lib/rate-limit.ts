import { createContextKey, type Middleware, type RequestContext } from '@remix-run/fetch-router'

import { createRateLimitHeaderValues } from './headers.ts'
import { memoryStore, type RateLimitStore, type RateLimitStoreEntry } from './store.ts'

/**
 * Currently supported rate limit counting strategy.
 */
export type RateLimitStrategy = 'fixed-window'

/**
 * Rate limit state for the current request.
 */
export interface RateLimitState {
  /**
   * Maximum requests allowed in the window.
   */
  limit: number
  /**
   * Requests counted in the current window.
   */
  count: number
  /**
   * Requests remaining in the current window.
   */
  remaining: number
  /**
   * Seconds until the current window resets.
   */
  reset: number
  /**
   * Unix epoch timestamp in milliseconds when the current window resets.
   */
  resetAt: number
  /**
   * Window size in milliseconds.
   */
  window: number
  /**
   * Whether this request exceeded the configured limit.
   */
  exceeded: boolean
}

/**
 * Function used to compute a rate limit bucket key for a request.
 */
export interface RateLimitKeyFunction {
  /**
   * Computes the bucket key for a request.
   *
   * @param context Request context for the current request.
   * @returns Bucket key for the current request.
   */
  (context: RequestContext): string | Promise<string>
}

/**
 * Function used to create a response when the limit is exceeded.
 */
export interface RateLimitExceededHandler {
  /**
   * Creates the response for an over-limit request.
   *
   * @param context Request context for the current request.
   * @param rateLimit Rate limit state for the current request.
   * @returns The response to send to the client.
   */
  (context: RequestContext, rateLimit: RateLimitState): Response | Promise<Response>
}

/**
 * Options for the {@link rateLimit} middleware.
 */
export interface RateLimitOptions {
  /**
   * Maximum number of requests allowed in each window.
   */
  limit: number
  /**
   * Window size in milliseconds.
   */
  window: number
  /**
   * Function used to compute a bucket key for each request.
   *
   * Defaults to a stable key derived from request identity headers when present. Apps that need IP
   * based limits should provide a key from trusted client address data.
   */
  key?: RateLimitKeyFunction
  /**
   * Store used to count requests.
   *
   * Defaults to `memoryStore()`.
   */
  store?: RateLimitStore
  /**
   * Counting strategy to use.
   *
   * Defaults to `'fixed-window'`.
   */
  strategy?: RateLimitStrategy
  /**
   * Creates a custom response when the limit is exceeded.
   *
   * The middleware sends the response with status `429`.
   *
   * Defaults to a plain text `429 Too Many Requests` response.
   */
  onLimitExceeded?: RateLimitExceededHandler
}

/**
 * Context key used to read the current rate limit state with `context.get(RateLimit)`.
 * The `rateLimit()` middleware also installs the state as `context.rateLimit`.
 */
export const RateLimit = createContextKey<RateLimitState>()

/**
 * Creates middleware that limits requests by key and adds standard rate limit headers.
 *
 * @param options Rate limit options.
 * @returns The rate limit middleware.
 */
export function rateLimit(
  options: RateLimitOptions,
): Middleware<{ key: typeof RateLimit; value: RateLimitState; property: 'rateLimit' }> {
  let {
    key = defaultRateLimitKey,
    limit,
    onLimitExceeded = defaultLimitExceededHandler,
    store = memoryStore(),
    strategy = 'fixed-window',
    window,
  } = options

  validateRateLimitOptions({ limit, strategy, window })

  return async (context, next) => {
    let bucketKey = await key(context)
    let entry = await store.increment(bucketKey, window)
    let state = createRateLimitState(entry, limit, window)

    context.set(RateLimit, state, { property: 'rateLimit' })

    if (state.exceeded) {
      let response = await onLimitExceeded(context, state)
      return withRateLimitHeaders(ensureLimitExceededResponse(response), state, {
        retryAfter: true,
      })
    }

    let response = await next()

    return withRateLimitHeaders(response, state)
  }
}

function createRateLimitState(
  entry: RateLimitStoreEntry,
  limit: number,
  window: number,
): RateLimitState {
  let reset = secondsUntil(entry.resetAt)
  let remaining = Math.max(0, limit - entry.count)

  return {
    limit,
    count: entry.count,
    remaining,
    reset,
    resetAt: entry.resetAt,
    window,
    exceeded: entry.count > limit,
  }
}

function withRateLimitHeaders(
  response: Response,
  state: RateLimitState,
  options: { retryAfter?: boolean } = {},
): Response {
  let headers = new Headers(response.headers)
  let headerValues = createRateLimitHeaderValues({
    limit: state.limit,
    remaining: state.remaining,
    reset: state.reset,
    window: millisecondsToSeconds(state.window),
  })

  headers.set('RateLimit', headerValues.rateLimit)
  headers.set('RateLimit-Policy', headerValues.rateLimitPolicy)

  if (options.retryAfter === true) {
    headers.set('Retry-After', String(state.reset))
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

function defaultLimitExceededHandler(): Response {
  return new Response('Too Many Requests', {
    status: 429,
    statusText: 'Too Many Requests',
  })
}

function ensureLimitExceededResponse(response: Response): Response {
  if (response.status === 429) {
    return response
  }

  return new Response(response.body, {
    status: 429,
    statusText: 'Too Many Requests',
    headers: response.headers,
  })
}

function defaultRateLimitKey(context: RequestContext): string {
  let authorization = context.headers.get('Authorization')
  if (authorization != null) {
    return `authorization:${hashString(authorization)}`
  }

  let cookie = context.headers.get('Cookie')
  if (cookie != null) {
    return `cookie:${hashString(cookie)}`
  }

  let userAgent = context.headers.get('User-Agent')
  if (userAgent != null) {
    return `user-agent:${hashString(userAgent)}`
  }

  return `origin:${context.url.origin}`
}

function hashString(value: string): string {
  let hash = 0x811c9dc5

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }

  return (hash >>> 0).toString(36)
}

function millisecondsToSeconds(value: number): number {
  return Math.max(1, Math.ceil(value / 1000))
}

function secondsUntil(timestamp: number): number {
  return Math.max(0, Math.ceil((timestamp - Date.now()) / 1000))
}

function validateRateLimitOptions(options: {
  limit: number
  strategy: string
  window: number
}): void {
  if (!Number.isSafeInteger(options.limit) || options.limit < 1) {
    throw new Error('Rate limit `limit` must be a positive safe integer.')
  }

  if (!Number.isSafeInteger(options.window) || options.window < 1) {
    throw new Error('Rate limit `window` must be a positive safe integer.')
  }

  if (options.strategy !== 'fixed-window') {
    throw new Error(`Unsupported rate limit strategy: ${options.strategy}`)
  }
}
