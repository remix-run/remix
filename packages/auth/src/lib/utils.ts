import type { RequestContext } from '@remix-run/fetch-router'
import { Session } from '@remix-run/session'

import type { OAuthTransaction } from './provider.ts'

let textEncoder = new TextEncoder()
let base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

export function createCodeVerifier(): string {
  return createRandomToken(48)
}

export async function createCodeChallenge(codeVerifier: string): Promise<string> {
  let data = textEncoder.encode(codeVerifier)
  let digest = await crypto.subtle.digest('SHA-256', data)
  return toBase64Url(new Uint8Array(digest))
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
  source: 'createAuthLoginRequestHandler()' | 'createAuthCallbackRequestHandler()',
): Session {
  if (!context.has(Session)) {
    throw new Error(`Session not found. Make sure session() middleware runs before ${source}.`)
  }

  return context.get(Session)
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

  if (!value.startsWith('/') || value.startsWith('//')) {
    return
  }

  return value
}

function createRandomToken(byteLength: number): string {
  let bytes = new Uint8Array(byteLength)
  crypto.getRandomValues(bytes)
  return toBase64Url(bytes)
}

function toBase64Url(bytes: Uint8Array): string {
  return toBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function toBase64(bytes: Uint8Array): string {
  let output = ''

  for (let index = 0; index < bytes.length; index += 3) {
    let byte1 = bytes[index] ?? 0
    let byte2 = bytes[index + 1] ?? 0
    let byte3 = bytes[index + 2] ?? 0
    let chunk = (byte1 << 16) | (byte2 << 8) | byte3

    output += base64Chars[(chunk >> 18) & 0x3f]
    output += base64Chars[(chunk >> 12) & 0x3f]
    output += index + 1 < bytes.length ? base64Chars[(chunk >> 6) & 0x3f] : '='
    output += index + 2 < bytes.length ? base64Chars[chunk & 0x3f] : '='
  }

  return output
}
