import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import type { OAuthDpopTokens, OAuthStandardTokens } from './provider.ts'
import { refreshExternalAuth } from './refresh-external-auth.ts'
import { createAtmosphereAuthProvider } from './providers/atmosphere.ts'
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
      let currentTokens: OAuthStandardTokens = {
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
      let currentTokens: OAuthStandardTokens = {
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

  it('refreshes Atmosphere DPoP tokens and updates the nonce', async () => {
    let restoreFetch = mockFetch(async (input, init) => {
      let url = toRequestUrl(input)

      if (url.href === 'https://plc.directory/did%3Aplc%3Aalice') {
        return Response.json({
          id: 'did:plc:alice',
          alsoKnownAs: ['at://alice.example.com'],
          service: [
            {
              id: '#atproto_pds',
              type: 'AtprotoPersonalDataServer',
              serviceEndpoint: 'https://pds.example.com',
            },
          ],
        })
      }

      if (url.href === 'https://pds.example.com/.well-known/oauth-protected-resource') {
        return Response.json({
          authorization_servers: ['https://auth.example.com'],
        })
      }

      if (url.href === 'https://auth.example.com/.well-known/oauth-authorization-server') {
        return Response.json({
          issuer: 'https://auth.example.com',
          authorization_endpoint: 'https://auth.example.com/oauth/authorize',
          token_endpoint: 'https://auth.example.com/oauth/token',
          pushed_authorization_request_endpoint: 'https://auth.example.com/oauth/par',
          response_types_supported: ['code'],
          grant_types_supported: ['authorization_code', 'refresh_token'],
          code_challenge_methods_supported: ['S256'],
          token_endpoint_auth_methods_supported: ['none'],
          scopes_supported: ['atproto'],
          authorization_response_iss_parameter_supported: true,
          require_pushed_authorization_requests: true,
          client_id_metadata_document_supported: true,
          dpop_signing_alg_values_supported: ['ES256'],
        })
      }

      if (url.href === 'https://auth.example.com/oauth/token') {
        let body = new URLSearchParams(String(init?.body ?? ''))
        let proof = decodeJwt(new Headers(init?.headers).get('DPoP')!)

        assert.equal(body.get('grant_type'), 'refresh_token')
        assert.equal(body.get('refresh_token'), 'atmosphere-refresh-token')
        assert.equal(
          body.get('client_id'),
          'http://localhost/?redirect_uri=http%3A%2F%2F127.0.0.1%3A44100%2Fauth%2Fatmosphere%2Fcallback&scope=atproto',
        )
        assert.equal(proof.payload.nonce, 'old-atmosphere-nonce')

        return Response.json(
          {
            access_token: 'atmosphere-access-token-2',
            token_type: 'DPoP',
            scope: 'atproto',
            sub: 'did:plc:alice',
          },
          {
            headers: {
              'DPoP-Nonce': 'new-atmosphere-nonce',
            },
          },
        )
      }

      throw new Error(`Unexpected fetch: ${url}`)
    })

    try {
      let atmosphereProvider = createAtmosphereAuthProvider({
        clientId: 'http://localhost',
        redirectUri: 'http://127.0.0.1:44100/auth/atmosphere/callback',
        sessionSecret: 'atmosphere-session-secret',
      })
      let provider = await atmosphereProvider('did:plc:alice')
      let dpopKeyPair = (await crypto.subtle.generateKey(
        { name: 'ECDSA', namedCurve: 'P-256' },
        true,
        ['sign', 'verify'],
      )) as CryptoKeyPair
      let currentTokens: OAuthDpopTokens = {
        accessToken: 'atmosphere-access-token-1',
        refreshToken: 'atmosphere-refresh-token',
        tokenType: 'DPoP',
        scope: ['atproto'],
        dpop: {
          publicJwk: (await crypto.subtle.exportKey('jwk', dpopKeyPair.publicKey)) as JsonWebKey,
          privateJwk: (await crypto.subtle.exportKey('jwk', dpopKeyPair.privateKey)) as JsonWebKey,
          nonce: 'old-atmosphere-nonce',
        },
      }
      let result = await refreshExternalAuth(provider, currentTokens)

      assert.equal(result.provider, 'atmosphere')
      assert.equal(result.tokens.accessToken, 'atmosphere-access-token-2')
      assert.equal(result.tokens.refreshToken, 'atmosphere-refresh-token')
      assert.equal(result.tokens.dpop.nonce, 'new-atmosphere-nonce')
      assert.deepEqual(result.tokens.scope, ['atproto'])
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

function decodeJwt(token: string): {
  payload: Record<string, unknown>
} {
  let [, payload] = token.split('.')
  return {
    payload: JSON.parse(decodeBase64Url(payload)),
  }
}

function decodeBase64Url(value: string): string {
  let padding = value.length % 4 === 0 ? '' : '='.repeat(4 - (value.length % 4))
  let base64 = value.replace(/-/g, '+').replace(/_/g, '/') + padding
  let bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}
