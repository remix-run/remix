import type { Middleware, RequestContext, RequestMethod } from '@remix-run/fetch-router'
import { Session } from '@remix-run/session'

const defaultSafeMethods: RequestMethod[] = ['GET', 'HEAD', 'OPTIONS']
const defaultTokenHeaderNames = ['x-csrf-token', 'x-xsrf-token', 'csrf-token']

type OriginMatcher = string | RegExp | ReadonlyArray<string | RegExp>

/**
 * Return shape for a dynamic CSRF origin resolver.
 */
export type CsrfOriginResolverResult = boolean | null | undefined

/**
 * Resolves whether an unsafe cross-origin request should be allowed.
 */
export interface CsrfOriginResolver {
  /**
   * Resolves whether an unsafe request origin should be trusted.
   */
  (
    origin: string,
    context: RequestContext,
  ): CsrfOriginResolverResult | Promise<CsrfOriginResolverResult>
}

/**
 * Accepted forms for configuring allowed CSRF origins.
 */
export type CsrfOrigin = OriginMatcher | CsrfOriginResolver

/**
 * Return shape for a dynamic CSRF token resolver.
 */
export type CsrfTokenResolverResult = string | null | undefined

/**
 * Resolves the submitted CSRF token for a request.
 */
export interface CsrfTokenResolver {
  /**
   * Resolves the submitted CSRF token for the current request.
   */
  (context: RequestContext): CsrfTokenResolverResult | Promise<CsrfTokenResolverResult>
}

/**
 * The reason a CSRF request was rejected.
 */
export type CsrfFailureReason = 'invalid-origin' | 'missing-token' | 'invalid-token'

/**
 * Options for the CSRF middleware.
 */
export interface CsrfOptions {
  /**
   * Session key used to store the server-generated CSRF token.
   *
   * @default '_csrf'
   */
  tokenKey?: string

  /**
   * Form field name to read CSRF tokens from.
   *
   * @default '_csrf'
   */
  fieldName?: string

  /**
   * Header names checked (in order) for CSRF tokens.
   *
   * @default ['x-csrf-token', 'x-xsrf-token', 'csrf-token']
   */
  headerNames?: readonly string[]

  /**
   * Methods that do not require CSRF validation.
   *
   * @default ['GET', 'HEAD', 'OPTIONS']
   */
  safeMethods?: readonly RequestMethod[]

  /**
   * Allowed cross-origin origins for unsafe requests.
   *
   * When omitted, requests are validated as same-origin.
   */
  origin?: CsrfOrigin

  /**
   * Allow requests without Origin/Referer headers.
   *
   * @default true
   */
  allowMissingOrigin?: boolean

  /**
   * Custom function for extracting the submitted token.
   */
  value?: CsrfTokenResolver

  /**
   * Optional custom error response for rejected requests.
   */
  onError?: (reason: CsrfFailureReason, context: RequestContext) => Response | Promise<Response>
}

/**
 * Session-backed CSRF protection middleware.
 *
 * This middleware requires the session middleware to run before it.
 *
 * @param options CSRF options
 * @returns CSRF middleware
 */
export function csrf(options: CsrfOptions = {}): Middleware {
  let safeMethods = options.safeMethods ?? defaultSafeMethods
  let tokenKey = options.tokenKey ?? '_csrf'
  let fieldName = options.fieldName ?? '_csrf'
  let headerNames = options.headerNames ?? defaultTokenHeaderNames
  let allowMissingOrigin = options.allowMissingOrigin ?? true

  return async (context, next) => {
    if (!context.has(Session)) {
      throw new Error('csrf middleware requires session() middleware to run before it')
    }

    let expectedToken = getCsrfToken(context, tokenKey)

    if (safeMethods.includes(context.method)) {
      return next()
    }

    let validOrigin = await validateRequestOrigin(
      context,
      options.origin,
      allowMissingOrigin,
      context.url.origin,
    )
    if (!validOrigin) {
      return getErrorResponse(options, 'invalid-origin', context)
    }

    let submittedToken = await resolveSubmittedToken(context, options.value, fieldName, headerNames)

    if (submittedToken == null || submittedToken === '') {
      return getErrorResponse(options, 'missing-token', context)
    }

    if (!constantTimeEqual(submittedToken, expectedToken)) {
      return getErrorResponse(options, 'invalid-token', context)
    }

    return next()
  }
}

/**
 * Gets the CSRF token from the session. Creates one if missing.
 *
 * @param context Request context with a started session
 * @param tokenKey Session key that stores the token
 * @returns The active CSRF token
 */
export function getCsrfToken(context: RequestContext, tokenKey = '_csrf'): string {
  if (!context.has(Session)) {
    throw new Error('Session is not started. Use session() middleware before csrf().')
  }

  let session = context.get(Session)
  let token = session.get(tokenKey)
  if (typeof token === 'string' && token !== '') {
    return token
  }

  let createdToken = createCsrfToken()
  session.set(tokenKey, createdToken)

  return createdToken
}

function createCsrfToken(): string {
  let bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)

  let token = ''
  for (let byte of bytes) {
    token += byte.toString(16).padStart(2, '0')
  }

  return token
}

function getErrorResponse(
  options: CsrfOptions,
  reason: CsrfFailureReason,
  context: RequestContext,
): Response | Promise<Response> {
  if (options.onError) {
    return options.onError(reason, context)
  }

  if (reason === 'invalid-origin') {
    return new Response('Forbidden: invalid CSRF origin', { status: 403 })
  }

  if (reason === 'missing-token') {
    return new Response('Forbidden: missing CSRF token', { status: 403 })
  }

  return new Response('Forbidden: invalid CSRF token', { status: 403 })
}

async function resolveSubmittedToken(
  context: RequestContext,
  valueResolver: CsrfTokenResolver | undefined,
  fieldName: string,
  headerNames: readonly string[],
): Promise<string | null> {
  if (valueResolver) {
    let value = await valueResolver(context)
    if (value == null) {
      return null
    }

    let trimmedValue = value.trim()
    return trimmedValue === '' ? null : trimmedValue
  }

  for (let headerName of headerNames) {
    let headerValue = context.headers.get(headerName)
    if (headerValue == null) {
      continue
    }

    let trimmedHeaderValue = headerValue.trim()
    if (trimmedHeaderValue !== '') {
      return trimmedHeaderValue
    }
  }

  let formValue = context.has(FormData) ? context.get(FormData).get(fieldName) : undefined
  if (typeof formValue === 'string') {
    let trimmedFormValue = formValue.trim()
    if (trimmedFormValue !== '') {
      return trimmedFormValue
    }
  }

  let queryValue = context.url.searchParams.get(fieldName)
  if (queryValue == null) {
    return null
  }

  let trimmedQueryValue = queryValue.trim()
  return trimmedQueryValue === '' ? null : trimmedQueryValue
}

async function validateRequestOrigin(
  context: RequestContext,
  configuredOrigin: CsrfOrigin | undefined,
  allowMissingOrigin: boolean,
  defaultOrigin: string,
): Promise<boolean> {
  let requestOrigin = getRequestOrigin(context)
  if (requestOrigin == null) {
    return allowMissingOrigin
  }

  if (configuredOrigin == null) {
    return requestOrigin === defaultOrigin
  }

  if (typeof configuredOrigin === 'function') {
    let result = await configuredOrigin(requestOrigin, context)
    return result === true
  }

  if (typeof configuredOrigin === 'string') {
    return configuredOrigin === requestOrigin
  }

  if (configuredOrigin instanceof RegExp) {
    return configuredOrigin.test(requestOrigin)
  }

  for (let allowedOrigin of configuredOrigin) {
    if (typeof allowedOrigin === 'string' && allowedOrigin === requestOrigin) {
      return true
    }

    if (allowedOrigin instanceof RegExp && allowedOrigin.test(requestOrigin)) {
      return true
    }
  }

  return false
}

function getRequestOrigin(context: RequestContext): string | null {
  let origin = context.headers.get('Origin')
  if (origin != null && origin.trim() !== '') {
    return origin
  }

  let referer = context.headers.get('Referer')
  if (referer == null || referer.trim() === '') {
    return null
  }

  try {
    return new URL(referer).origin
  } catch {
    return null
  }
}

function constantTimeEqual(left: string, right: string): boolean {
  let mismatch = left.length === right.length ? 0 : 1
  let maxLength = Math.max(left.length, right.length)

  for (let index = 0; index < maxLength; index++) {
    let leftCode = left.charCodeAt(index) || 0
    let rightCode = right.charCodeAt(index) || 0
    mismatch |= leftCode ^ rightCode
  }

  return mismatch === 0
}
