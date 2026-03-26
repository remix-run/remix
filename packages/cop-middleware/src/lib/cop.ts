import { RequestMethods } from '@remix-run/fetch-router'
import type { Middleware, RequestContext, RequestMethod } from '@remix-run/fetch-router'

const safeMethods: RequestMethod[] = ['GET', 'HEAD', 'OPTIONS']

type BypassSegment = { type: 'static'; value: string } | { type: 'wildcard' } | { type: 'rest' }

interface BypassPattern {
  method: RequestMethod | null
  pathname: string
  segments: BypassSegment[]
  matchesSubtree: boolean
}

/**
 * Reason reported when cross-origin protection rejects a request.
 */
export type CopFailureReason = 'cross-origin-request' | 'cross-origin-request-from-old-browser'

/**
 * Custom response handler for rejected cross-origin requests.
 */
export interface CopDenyHandler {
  /**
   * Builds the response returned when a request is denied.
   */
  (reason: CopFailureReason, context: RequestContext): Response | Promise<Response>
}

/**
 * Configuration for the cross-origin protection middleware.
 */
export interface CopOptions {
  /**
   * Exact origins that should bypass cross-origin rejection.
   */
  trustedOrigins?: readonly string[]

  /**
   * Path patterns that should bypass protection for matching requests.
   */
  insecureBypassPatterns?: readonly string[]

  /**
   * Optional custom response handler for rejected requests.
   */
  onDeny?: CopDenyHandler
}

class CrossOriginProtection {
  #trustedOrigins = new Set<string>()
  #insecureBypassPatterns: BypassPattern[] = []
  #onDeny?: CopDenyHandler

  constructor(options: CopOptions = {}) {
    for (let trustedOrigin of options.trustedOrigins ?? []) {
      this.addTrustedOrigin(trustedOrigin)
    }

    for (let insecureBypassPattern of options.insecureBypassPatterns ?? []) {
      this.addInsecureBypassPattern(insecureBypassPattern)
    }

    this.setDenyHandler(options.onDeny)
  }

  addTrustedOrigin(origin: string): void {
    this.#trustedOrigins.add(validateTrustedOrigin(origin))
  }

  addInsecureBypassPattern(pattern: string): void {
    this.#insecureBypassPatterns.push(parseBypassPattern(pattern))
  }

  setDenyHandler(onDeny?: CopDenyHandler): void {
    this.#onDeny = onDeny
  }

  check(context: RequestContext): CopFailureReason | null {
    if (safeMethods.includes(context.method)) {
      return null
    }

    let secFetchSite = getHeaderValue(context.headers, 'Sec-Fetch-Site')?.toLowerCase() ?? ''
    switch (secFetchSite) {
      case '':
        break
      case 'same-origin':
      case 'none':
        return null
      default:
        return this.#isRequestExempt(context) ? null : 'cross-origin-request'
    }

    let requestOrigin = getHeaderValue(context.headers, 'Origin')
    if (requestOrigin == null) {
      return null
    }

    let parsedOrigin = parseOrigin(requestOrigin)
    if (parsedOrigin != null && parsedOrigin.host === context.url.host) {
      return null
    }

    return this.#isRequestExempt(context) ? null : 'cross-origin-request-from-old-browser'
  }

  deny(reason: CopFailureReason, context: RequestContext): Response | Promise<Response> {
    if (this.#onDeny) {
      return this.#onDeny(reason, context)
    }

    return new Response(getDefaultErrorMessage(reason), { status: 403 })
  }

  #isRequestExempt(context: RequestContext): boolean {
    for (let pattern of this.#insecureBypassPatterns) {
      if (matchesBypassPattern(pattern, context)) {
        return true
      }
    }

    let requestOrigin = getHeaderValue(context.headers, 'Origin')
    if (requestOrigin == null) {
      return false
    }

    let normalizedOrigin = normalizeOrigin(requestOrigin)
    return normalizedOrigin != null && this.#trustedOrigins.has(normalizedOrigin)
  }
}

/**
 * Creates middleware that rejects unsafe cross-origin requests.
 *
 * @param options Cross-origin protection options.
 * @returns Middleware that validates request origin headers.
 */
export function cop(options: CopOptions = {}): Middleware {
  let protection = new CrossOriginProtection(options)

  return async (context, next) => {
    let reason = protection.check(context)
    if (reason == null) {
      return next()
    }

    return protection.deny(reason, context)
  }
}

function getDefaultErrorMessage(reason: CopFailureReason): string {
  if (reason === 'cross-origin-request') {
    return 'Forbidden: cross-origin request detected from Sec-Fetch-Site header'
  }

  return 'Forbidden: cross-origin request detected, and/or browser is out of date: Sec-Fetch-Site is missing, and Origin does not match Host'
}

function getHeaderValue(headers: Headers, name: string): string | null {
  let value = headers.get(name)
  if (value == null) {
    return null
  }

  let trimmedValue = value.trim()
  return trimmedValue === '' ? null : trimmedValue
}

function validateTrustedOrigin(origin: string): string {
  let trimmedOrigin = origin.trim()
  if (trimmedOrigin === '') {
    throw new Error('trusted origin must not be empty')
  }

  if (trimmedOrigin.endsWith('/')) {
    throw new Error(`invalid origin ${JSON.stringify(origin)}: trailing slash is not allowed`)
  }

  let parsedOrigin = parseOrigin(trimmedOrigin)
  if (parsedOrigin == null) {
    throw new Error(`invalid origin ${JSON.stringify(origin)}`)
  }

  if (parsedOrigin.pathname !== '/' || parsedOrigin.search !== '' || parsedOrigin.hash !== '') {
    throw new Error(
      `invalid origin ${JSON.stringify(origin)}: path, query, and fragment are not allowed`,
    )
  }

  return serializeOrigin(parsedOrigin)
}

function normalizeOrigin(origin: string): string | null {
  let parsedOrigin = parseOrigin(origin)
  return parsedOrigin == null ? null : serializeOrigin(parsedOrigin)
}

function parseOrigin(origin: string): URL | null {
  try {
    let parsedOrigin = new URL(origin)
    if (parsedOrigin.host === '') {
      return null
    }

    if (parsedOrigin.username !== '' || parsedOrigin.password !== '') {
      return null
    }

    return parsedOrigin
  } catch {
    return null
  }
}

function serializeOrigin(origin: URL): string {
  return `${origin.protocol}//${origin.host}`
}

function parseBypassPattern(pattern: string): BypassPattern {
  let trimmedPattern = pattern.trim()
  if (trimmedPattern === '') {
    throw new Error('bypass pattern must not be empty')
  }

  let method: RequestMethod | null = null
  let pathname = trimmedPattern
  let methodPattern = /^([A-Z]+)\s+(.+)$/.exec(trimmedPattern)

  if (methodPattern != null && methodPattern[2].startsWith('/')) {
    let maybeMethod = methodPattern[1] as RequestMethod
    if (!RequestMethods.includes(maybeMethod)) {
      throw new Error(`invalid request method in bypass pattern ${JSON.stringify(pattern)}`)
    }

    method = maybeMethod
    pathname = methodPattern[2]
  }

  if (!pathname.startsWith('/')) {
    throw new Error(`invalid bypass pattern ${JSON.stringify(pattern)}: path must start with "/"`)
  }

  if (pathname.includes('?') || pathname.includes('#')) {
    throw new Error(
      `invalid bypass pattern ${JSON.stringify(pattern)}: query strings and fragments are not supported`,
    )
  }

  let matchesSubtree = pathname.endsWith('/')
  let normalizedPathname =
    pathname.length > 1 && matchesSubtree ? pathname.slice(0, pathname.length - 1) : pathname
  let rawSegments = normalizedPathname === '/' ? [] : normalizedPathname.slice(1).split('/')
  let segments = rawSegments.map((segment, index) =>
    parseBypassSegment(pattern, segment, index === rawSegments.length - 1),
  )

  return { method, pathname, segments, matchesSubtree }
}

function parseBypassSegment(
  pattern: string,
  segment: string,
  isLastSegment: boolean,
): BypassSegment {
  if (segment === '') {
    throw new Error(
      `invalid bypass pattern ${JSON.stringify(pattern)}: empty path segments are not allowed`,
    )
  }

  if (!segment.startsWith('{') || !segment.endsWith('}')) {
    return { type: 'static', value: segment }
  }

  let wildcardName = segment.slice(1, segment.length - 1)
  if (wildcardName === '') {
    throw new Error(
      `invalid bypass pattern ${JSON.stringify(pattern)}: empty wildcards are not allowed`,
    )
  }

  if (wildcardName === '$') {
    throw new Error(
      `invalid bypass pattern ${JSON.stringify(pattern)}: "{$}" is not supported in cop-middleware`,
    )
  }

  if (wildcardName.endsWith('...')) {
    if (!isLastSegment) {
      throw new Error(
        `invalid bypass pattern ${JSON.stringify(pattern)}: tail wildcards must be last`,
      )
    }

    if (wildcardName.length === 3) {
      throw new Error(
        `invalid bypass pattern ${JSON.stringify(pattern)}: tail wildcards require a name`,
      )
    }

    return { type: 'rest' }
  }

  return { type: 'wildcard' }
}

function matchesBypassPattern(pattern: BypassPattern, context: RequestContext): boolean {
  if (pattern.method != null && pattern.method !== context.method) {
    return false
  }

  let pathname = context.url.pathname
  let hasTrailingSlash = pathname.length > 1 && pathname.endsWith('/')
  let normalizedPathname =
    pathname.length > 1 && hasTrailingSlash ? pathname.slice(0, pathname.length - 1) : pathname
  let pathSegments = normalizedPathname === '/' ? [] : normalizedPathname.slice(1).split('/')

  let segmentIndex = 0
  while (segmentIndex < pattern.segments.length) {
    let pathSegment = pathSegments[segmentIndex]
    let segment = pattern.segments[segmentIndex]

    if (segment.type === 'rest') {
      return true
    }

    if (pathSegment == null) {
      return false
    }

    if (segment.type === 'static' && segment.value !== pathSegment) {
      return false
    }

    segmentIndex++
  }

  if (pattern.matchesSubtree) {
    if (pathSegments.length === pattern.segments.length) {
      return pattern.pathname === '/' || hasTrailingSlash
    }

    return pathSegments.length > pattern.segments.length
  }

  return pathSegments.length === pattern.segments.length && !hasTrailingSlash
}
