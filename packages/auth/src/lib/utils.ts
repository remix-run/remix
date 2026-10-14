import type { RequestContext } from '@remix-run/fetch-router'
import { Session } from '@remix-run/session'

import { encodeBase64Url } from './base64url.ts'
import type { OAuthTransaction } from './provider.ts'

const textEncoder = new TextEncoder()
const returnToBaseURL = 'https://remix.local'

export function createCodeVerifier(): string {
  return createRandomToken(48)
}

export async function createCodeChallenge(codeVerifier: string): Promise<string> {
  let data = textEncoder.encode(codeVerifier)
  let digest = await crypto.subtle.digest('SHA-256', data)
  return encodeBase64Url(new Uint8Array(digest))
}

export function createOAuthTransaction(provider: string, returnTo?: string): OAuthTransaction {
  return {
    provider,
    state: createRandomToken(32),
    codeVerifier: createCodeVerifier(),
    returnTo,
  }
}

export function createRedirectResponse(location: string | URL, status = 302): Response {
  return new Response(null, {
    status,
    headers: {
      Location: typeof location === 'string' ? location : location.toString(),
    },
  })
}

export function getRequiredSearchParam(context: RequestContext, name: string): string {
  let value = context.url.searchParams.get(name)
  if (value == null || value.length === 0) {
    throw new Error(`Missing "${name}" in OAuth callback request.`)
  }

  return value
}

export function getSession(
  context: RequestContext,
  source:
    | 'completeAuth()'
    | 'finishExternalAuth()'
    | 'finishPasskeyAuthentication()'
    | 'finishPasskeyRegistration()'
    | 'startExternalAuth()'
    | 'startPasskeyAuthentication()'
    | 'startPasskeyRegistration()',
): Session {
  let session = context.get(Session)
  if (session == null) {
    throw new Error(`Session not found. Make sure session() middleware runs before ${source}.`)
  }

  return session
}

export function resolveRedirectTarget(
  transaction: OAuthTransaction | undefined,
  fallback?: string | URL,
): string {
  if (transaction?.returnTo != null) {
    return transaction.returnTo
  }

  if (fallback == null) {
    return '/'
  }

  return typeof fallback === 'string' ? fallback : fallback.toString()
}

export function sanitizeReturnTo(value: string | null): string | undefined {
  if (value == null || value.length === 0) {
    return
  }

  if (!value.startsWith('/')) {
    return
  }

  let url: URL
  try {
    url = new URL(value, returnToBaseURL)
  } catch {
    return
  }

  if (url.origin !== returnToBaseURL || url.pathname.startsWith('//')) {
    return
  }

  return url.pathname + url.search + url.hash
}

export function createRandomToken(byteLength: number): string {
  let bytes = new Uint8Array(byteLength)
  crypto.getRandomValues(bytes)
  return encodeBase64Url(bytes)
}
