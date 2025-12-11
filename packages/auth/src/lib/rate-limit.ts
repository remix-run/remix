import type { SecondaryStorage } from './secondary-storage/types.ts'

/**
 * Rate limit rule configuration
 */
export interface RateLimitRule {
  /** Time window in seconds */
  window: number
  /** Maximum requests allowed in the window */
  max: number
}

/**
 * Rate limit data stored in secondary storage
 */
interface RateLimitData {
  count: number
  lastRequest: number
}

/**
 * Result of a rate limit check
 */
export type RateLimitResult = { limited: false } | { limited: true; retryAfter: number }

/**
 * Get the IP address from a request
 *
 * Checks headers in order and returns the first valid IP found.
 * Returns null if IP cannot be determined (rate limiting should be skipped)
 */
export function getIp(request: Request, ipAddressHeaders: string[]): string | null {
  for (let header of ipAddressHeaders) {
    let value = request.headers.get(header)
    if (value) {
      // Headers like x-forwarded-for can be comma-separated, take the first (client) IP
      let ip = value.split(',')[0].trim()
      if (ip) {
        return ip
      }
    }
  }

  // Cannot determine IP - return null to skip rate limiting
  return null
}

/**
 * Check rate limit for an operation
 */
export async function checkRateLimit(
  storage: SecondaryStorage,
  key: string,
  rule: RateLimitRule,
): Promise<RateLimitResult> {
  let now = Date.now()
  let windowMs = rule.window * 1000

  let stored = await storage.get(key)
  let data: RateLimitData = stored ? JSON.parse(stored) : { count: 0, lastRequest: 0 }

  let timeSinceLastRequest = now - data.lastRequest

  // If window has passed, reset the count
  if (timeSinceLastRequest > windowMs) {
    data = { count: 1, lastRequest: now }
    await storage.set(key, JSON.stringify(data), rule.window)
    return { limited: false }
  }

  // Check if rate limited
  if (data.count >= rule.max) {
    let retryAfter = Math.ceil((data.lastRequest + windowMs - now) / 1000)
    return { limited: true, retryAfter }
  }

  // Increment count
  data.count++
  data.lastRequest = now
  await storage.set(key, JSON.stringify(data), rule.window)

  return { limited: false }
}

/**
 * Find the matching rate limit rule for an operation
 *
 * Matching priority:
 * 1. Exact match: 'password.signIn'
 * 2. Feature wildcard: 'password.*'
 * 3. Method wildcard: '*.signIn'
 * 4. Default
 */
export function findRateLimitRule(
  operation: string,
  rules: Record<string, RateLimitRule | false> | undefined,
  defaultRule: RateLimitRule,
): RateLimitRule | false {
  if (!rules) return defaultRule

  let [feature, method] = operation.split('.')

  // 1. Exact match
  if (operation in rules) {
    return rules[operation]
  }

  // 2. Feature wildcard
  let featureWildcard = `${feature}.*`
  if (featureWildcard in rules) {
    return rules[featureWildcard]
  }

  // 3. Method wildcard
  let methodWildcard = `*.${method}`
  if (methodWildcard in rules) {
    return rules[methodWildcard]
  }

  // 4. Default
  return defaultRule
}
