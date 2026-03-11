import * as assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'

import { createCookie } from '@remix-run/cookie'
import { createRouter } from '@remix-run/fetch-router'
import { createMemorySessionStorage } from '@remix-run/session/memory-storage'
import { session as sessionMiddleware } from '@remix-run/session-middleware'

import { callback } from '../callback.ts'
import { login } from '../login.ts'
import { createRequest, mockFetch } from '../test-utils.ts'
import { createOIDCAuthProvider } from './oidc.ts'

describe('oidc provider', () => {
  afterEach(() => {
    globalThis.fetch = fetch
  })

  it('discovers metadata and caches it across login requests', async () => {
    let cookie = createCookie('__session', { secrets: ['secret1'] })
    let storage = createMemorySessionStorage()
    let discoveryRequests = 0
    let provider = createOIDCAuthProvider({
      issuer: 'https://issuer.example.com',
      clientId: 'client-id',
      clientSecret: 'client-secret',
      redirectUri: 'https://app.example.com/auth/oidc/callback',
    })
    let restoreFetch = mockFetch(async input => {
      let url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url

      if (url === 'https://issuer.example.com/.well-known/openid-configuration') {
        discoveryRequests += 1
        return Response.json({
          issuer: 'https://issuer.example.com',
          authorization_endpoint: 'https://issuer.example.com/oauth2/v1/authorize',
          token_endpoint: 'https://issuer.example.com/oauth2/v1/token',
          userinfo_endpoint: 'https://issuer.example.com/oauth2/v1/userinfo',
        })
      }

      throw new Error(`Unexpected fetch: ${url}`)
    })

    try {
      let router = createRouter({
        middleware: [sessionMiddleware(cookie, storage)],
      })

      router.get('/login/oidc', login(provider))

      let response1 = await router.fetch('https://app.example.com/login/oidc')
      let response2 = await router.fetch('https://app.example.com/login/oidc')
      let location1 = new URL(response1.headers.get('Location')!)
      let location2 = new URL(response2.headers.get('Location')!)

      assert.equal(discoveryRequests, 1)
      assert.equal(location1.origin, 'https://issuer.example.com')
      assert.equal(location1.pathname, '/oauth2/v1/authorize')
      assert.equal(location1.origin, location2.origin)
      assert.equal(location1.pathname, location2.pathname)
      assert.equal(location1.searchParams.get('scope'), 'openid profile email')
      assert.equal(location2.searchParams.get('scope'), 'openid profile email')
    } finally {
      restoreFetch()
    }
  })

  it('retries discovery after a failed metadata request', async () => {
    let cookie = createCookie('__session', { secrets: ['secret1'] })
    let storage = createMemorySessionStorage()
    let discoveryRequests = 0
    let provider = createOIDCAuthProvider({
      issuer: 'https://issuer.example.com',
      clientId: 'client-id',
      clientSecret: 'client-secret',
      redirectUri: 'https://app.example.com/auth/oidc/callback',
    })
    let restoreFetch = mockFetch(async input => {
      let url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url

      if (url === 'https://issuer.example.com/.well-known/openid-configuration') {
        discoveryRequests += 1

        if (discoveryRequests === 1) {
          return Response.json({}, { status: 500 })
        }

        return Response.json({
          issuer: 'https://issuer.example.com',
          authorization_endpoint: 'https://issuer.example.com/oauth2/v1/authorize',
          token_endpoint: 'https://issuer.example.com/oauth2/v1/token',
          userinfo_endpoint: 'https://issuer.example.com/oauth2/v1/userinfo',
        })
      }

      throw new Error(`Unexpected fetch: ${url}`)
    })

    try {
      let router = createRouter({
        middleware: [sessionMiddleware(cookie, storage)],
      })

      router.get('/login/oidc', login(provider))

      await assert.rejects(
        () => router.fetch('https://app.example.com/login/oidc'),
        /Failed to load OIDC metadata for "oidc"\./,
      )

      let response = await router.fetch('https://app.example.com/login/oidc')
      let location = new URL(response.headers.get('Location')!)

      assert.equal(response.status, 302)
      assert.equal(discoveryRequests, 2)
      assert.equal(location.origin, 'https://issuer.example.com')
      assert.equal(location.pathname, '/oauth2/v1/authorize')
    } finally {
      restoreFetch()
    }
  })

  it('includes authorizationParams in the authorization URL', async () => {
    let cookie = createCookie('__session', { secrets: ['secret1'] })
    let storage = createMemorySessionStorage()
    let provider = createOIDCAuthProvider({
      issuer: 'https://issuer.example.com',
      clientId: 'client-id',
      clientSecret: 'client-secret',
      redirectUri: 'https://app.example.com/auth/oidc/callback',
      authorizationParams: {
        prompt: 'login',
        audience: 'https://api.example.com',
      },
    })
    let restoreFetch = mockFetch(async input => {
      let url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url

      if (url === 'https://issuer.example.com/.well-known/openid-configuration') {
        return Response.json({
          issuer: 'https://issuer.example.com',
          authorization_endpoint: 'https://issuer.example.com/oauth2/v1/authorize',
          token_endpoint: 'https://issuer.example.com/oauth2/v1/token',
          userinfo_endpoint: 'https://issuer.example.com/oauth2/v1/userinfo',
        })
      }

      throw new Error(`Unexpected fetch: ${url}`)
    })

    try {
      let router = createRouter({
        middleware: [sessionMiddleware(cookie, storage)],
      })

      router.get('/login/oidc', login(provider))

      let response = await router.fetch('https://app.example.com/login/oidc')
      let location = new URL(response.headers.get('Location')!)

      assert.equal(location.searchParams.get('prompt'), 'login')
      assert.equal(location.searchParams.get('audience'), 'https://api.example.com')
      assert.equal(location.searchParams.get('client_id'), 'client-id')
    } finally {
      restoreFetch()
    }
  })

  it('uses metadata override without discovery', async () => {
    let cookie = createCookie('__session', { secrets: ['secret1'] })
    let storage = createMemorySessionStorage()
    let fetchCalls = 0
    let provider = createOIDCAuthProvider({
      issuer: 'https://issuer.example.com',
      clientId: 'client-id',
      clientSecret: 'client-secret',
      redirectUri: 'https://app.example.com/auth/oidc/callback',
      metadata: {
        issuer: 'https://issuer.example.com',
        authorization_endpoint: 'https://issuer.example.com/oauth2/v1/authorize',
        token_endpoint: 'https://issuer.example.com/oauth2/v1/token',
        userinfo_endpoint: 'https://issuer.example.com/oauth2/v1/userinfo',
      },
    })
    let restoreFetch = mockFetch(async input => {
      fetchCalls += 1
      let url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
      throw new Error(`Unexpected fetch: ${url}`)
    })

    try {
      let router = createRouter({
        middleware: [sessionMiddleware(cookie, storage)],
      })

      router.get('/login/oidc', login(provider))

      let response = await router.fetch('https://app.example.com/login/oidc')

      assert.equal(response.status, 302)
      assert.equal(fetchCalls, 0)
      assert.equal(
        new URL(response.headers.get('Location')!).origin,
        'https://issuer.example.com',
      )
    } finally {
      restoreFetch()
    }
  })

  it('completes callback, normalizes claims, and applies mapProfile', async () => {
    let cookie = createCookie('__session', { secrets: ['secret1'] })
    let storage = createMemorySessionStorage()
    let provider = createOIDCAuthProvider({
      name: 'company-sso',
      issuer: 'https://issuer.example.com',
      clientId: 'client-id',
      clientSecret: 'client-secret',
      redirectUri: 'https://app.example.com/auth/oidc/callback',
      mapProfile({ claims }) {
        return {
          sub: claims.sub,
          email: claims.email,
          handle: claims.preferred_username,
        }
      },
    })
    let restoreFetch = mockFetch(async (input, init) => {
      let url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url

      if (url === 'https://issuer.example.com/.well-known/openid-configuration') {
        return Response.json({
          issuer: 'https://issuer.example.com',
          authorization_endpoint: 'https://issuer.example.com/oauth2/v1/authorize',
          token_endpoint: 'https://issuer.example.com/oauth2/v1/token',
          userinfo_endpoint: 'https://issuer.example.com/oauth2/v1/userinfo',
        })
      }

      if (url === 'https://issuer.example.com/oauth2/v1/token') {
        let body = new URLSearchParams(init?.body as string)
        assert.equal(body.get('code'), 'good-code')
        assert.equal(typeof body.get('code_verifier'), 'string')
        return Response.json({
          access_token: 'oidc-access-token',
          token_type: 'Bearer',
          scope: 'openid profile email',
        })
      }

      if (url === 'https://issuer.example.com/oauth2/v1/userinfo') {
        return Response.json({
          sub: 'user-1',
          email: 'user@example.com',
          preferred_username: 'user.one',
        })
      }

      throw new Error(`Unexpected fetch: ${url}`)
    })

    try {
      let router = createRouter({
        middleware: [sessionMiddleware(cookie, storage)],
      })

      router.get('/login/oidc', login(provider))
      router.get(
        '/auth/oidc/callback',
        callback(provider, {
          writeSession(session, result) {
            session.set('auth', { userId: result.account.providerAccountId })
          },
          onSuccess(result) {
            return Response.json(result)
          },
        }),
      )

      let loginResponse = await router.fetch('https://app.example.com/login/oidc')
      let state = new URL(loginResponse.headers.get('Location')!).searchParams.get('state')
      let response = await router.fetch(
        createRequest(
          `https://app.example.com/auth/oidc/callback?code=good-code&state=${state}`,
          loginResponse,
        ),
      )

      assert.deepEqual(await response.json(), {
        provider: 'company-sso',
        account: {
          provider: 'company-sso',
          providerAccountId: 'user-1',
        },
        profile: {
          sub: 'user-1',
          email: 'user@example.com',
          handle: 'user.one',
        },
        tokens: {
          accessToken: 'oidc-access-token',
          tokenType: 'Bearer',
          scope: ['openid', 'profile', 'email'],
        },
      })
    } finally {
      restoreFetch()
    }
  })

  it('fails when metadata does not include a userinfo endpoint', async () => {
    let cookie = createCookie('__session', { secrets: ['secret1'] })
    let storage = createMemorySessionStorage()
    let provider = createOIDCAuthProvider({
      issuer: 'https://issuer.example.com',
      clientId: 'client-id',
      clientSecret: 'client-secret',
      redirectUri: 'https://app.example.com/auth/oidc/callback',
      metadata: {
        issuer: 'https://issuer.example.com',
        authorization_endpoint: 'https://issuer.example.com/oauth2/v1/authorize',
        token_endpoint: 'https://issuer.example.com/oauth2/v1/token',
      },
    })
    let restoreFetch = mockFetch(async (input, init) => {
      let url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url

      if (url === 'https://issuer.example.com/oauth2/v1/token') {
        let body = new URLSearchParams(init?.body as string)
        assert.equal(body.get('code'), 'good-code')
        return Response.json({
          access_token: 'oidc-access-token',
          token_type: 'Bearer',
        })
      }

      throw new Error(`Unexpected fetch: ${url}`)
    })

    try {
      let router = createRouter({
        middleware: [sessionMiddleware(cookie, storage)],
      })

      router.get('/login/oidc', login(provider))
      router.get(
        '/auth/oidc/callback',
        callback(provider, {
          writeSession(session, result) {
            session.set('auth', { userId: result.account.providerAccountId })
          },
          onFailure(error) {
            return Response.json(
              {
                error: error instanceof Error ? error.message : 'unknown',
              },
              { status: 400 },
            )
          },
        }),
      )

      let loginResponse = await router.fetch('https://app.example.com/login/oidc')
      let state = new URL(loginResponse.headers.get('Location')!).searchParams.get('state')
      let response = await router.fetch(
        createRequest(
          `https://app.example.com/auth/oidc/callback?code=good-code&state=${state}`,
          loginResponse,
        ),
      )

      assert.equal(response.status, 400)
      assert.deepEqual(await response.json(), {
        error: 'OIDC provider "oidc" did not publish a userinfo_endpoint.',
      })
    } finally {
      restoreFetch()
    }
  })
})
