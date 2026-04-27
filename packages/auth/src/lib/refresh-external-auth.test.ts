import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import type { OAuthTokens } from './provider.ts'
import { refreshExternalAuth } from './refresh-external-auth.ts'
import { createGitHubAuthProvider } from './providers/github.ts'
import { createGoogleAuthProvider } from './providers/google.ts'
import { createXAuthProvider } from './providers/x.ts'
import { mockFetch } from './test-utils.ts'

describe('refreshExternalAuth()', () => {
  it('refreshes Google tokens and preserves the existing refresh token when the provider omits one', async () => {
    let provider = createGoogleAuthProvider({
      clientId: 'google-client-id',
      clientSecret: 'google-client-secret',
      redirectUri: 'https://app.example.com/auth/google/callback',
    })
    let restoreFetch = mockFetch(async (input, init) => {
      let url = toRequestUrl(input)

      if (url.href === 'https://oauth2.googleapis.com/token') {
        let body = new URLSearchParams(String(init?.body ?? ''))

        assert.equal(body.get('grant_type'), 'refresh_token')
        assert.equal(body.get('refresh_token'), 'google-refresh-token')
        assert.equal(body.get('client_id'), 'google-client-id')
        assert.equal(body.get('client_secret'), 'google-client-secret')

        return Response.json({
          access_token: 'google-access-token-2',
          token_type: 'Bearer',
          expires_in: 7200,
          scope: 'openid email profile',
        })
      }

      throw new Error(`Unexpected fetch: ${url}`)
    })

    try {
      let currentTokens: OAuthTokens = {
        accessToken: 'google-access-token-1',
        refreshToken: 'google-refresh-token',
        tokenType: 'Bearer',
        scope: ['openid', 'email'],
      }
      let result = await refreshExternalAuth(provider, currentTokens)

      assert.equal(result.provider, 'google')
      assert.equal(result.tokens.accessToken, 'google-access-token-2')
      assert.equal(result.tokens.refreshToken, 'google-refresh-token')
      assert.equal(result.tokens.tokenType, 'Bearer')
      assert.deepEqual(result.tokens.scope, ['openid', 'email', 'profile'])
      assert.ok(result.tokens.expiresAt instanceof Date)
    } finally {
      restoreFetch()
    }
  })

  it('refreshes X tokens with HTTP basic auth', async () => {
    let provider = createXAuthProvider({
      clientId: 'x-client-id',
      clientSecret: 'x-client-secret',
      redirectUri: 'https://app.example.com/auth/x/callback',
    })
    let restoreFetch = mockFetch(async (input, init) => {
      let url = toRequestUrl(input)

      if (url.href === 'https://api.x.com/2/oauth2/token') {
        let body = new URLSearchParams(String(init?.body ?? ''))
        let headers = new Headers(init?.headers)

        assert.equal(headers.get('Authorization'), `Basic ${btoa('x-client-id:x-client-secret')}`)
        assert.equal(body.get('grant_type'), 'refresh_token')
        assert.equal(body.get('refresh_token'), 'x-refresh-token')
        assert.equal(body.get('client_id'), null)
        assert.equal(body.get('client_secret'), null)

        return Response.json({
          access_token: 'x-access-token-2',
          refresh_token: 'x-refresh-token-2',
          token_type: 'bearer',
          scope: 'tweet.read users.read offline.access',
        })
      }

      throw new Error(`Unexpected fetch: ${url}`)
    })

    try {
      let currentTokens: OAuthTokens = {
        accessToken: 'x-access-token-1',
        refreshToken: 'x-refresh-token',
        tokenType: 'bearer',
        scope: ['tweet.read', 'users.read', 'offline.access'],
      }
      let result = await refreshExternalAuth(provider, currentTokens)

      assert.equal(result.provider, 'x')
      assert.equal(result.tokens.accessToken, 'x-access-token-2')
      assert.equal(result.tokens.refreshToken, 'x-refresh-token-2')
      assert.equal(result.tokens.tokenType, 'bearer')
      assert.deepEqual(result.tokens.scope, ['tweet.read', 'users.read', 'offline.access'])
    } finally {
      restoreFetch()
    }
  })

  it('fails for providers that do not implement refresh-token exchange', async () => {
    let provider = createGitHubAuthProvider({
      clientId: 'github-client-id',
      clientSecret: 'github-client-secret',
      redirectUri: 'https://app.example.com/auth/github/callback',
    })

    await assert.rejects(
      () =>
        refreshExternalAuth(provider, {
          accessToken: 'github-access-token',
          refreshToken: 'github-refresh-token',
        }),
      /does not support refresh-token exchange/,
    )
  })
})

function toRequestUrl(input: RequestInfo | URL): URL {
  if (typeof input === 'string') {
    return new URL(input)
  }

  if (input instanceof URL) {
    return input
  }

  return new URL(input.url)
}
