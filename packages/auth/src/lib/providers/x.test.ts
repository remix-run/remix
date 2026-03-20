import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createCookie } from '@remix-run/cookie'
import { createRouter } from '@remix-run/fetch-router'
import { createMemorySessionStorage } from '@remix-run/session/memory-storage'
import { session as sessionMiddleware } from '@remix-run/session-middleware'

import { createExternalAuthCallbackRequestHandler } from '../external-callback.ts'
import { createExternalAuthLoginRequestHandler } from '../external-login.ts'
import { createRequest, mockFetch } from '../test-utils.ts'
import { createXAuthProvider } from './x.ts'

describe('x provider', () => {
  it('redirects to the X authorization endpoint with default PKCE parameters', async () => {
    let cookie = createCookie('__session', { secrets: ['secret1'] })
    let storage = createMemorySessionStorage()
    let provider = createXAuthProvider({
      clientId: 'x-client-id',
      clientSecret: 'x-client-secret',
      redirectUri: 'https://app.example.com/auth/x/callback',
    })
    let router = createRouter({
      middleware: [sessionMiddleware(cookie, storage)],
    })

    router.get('/login/x', createExternalAuthLoginRequestHandler(provider))

    let response = await router.fetch('https://app.example.com/login/x')
    let location = new URL(response.headers.get('Location')!)

    assert.equal(response.status, 302)
    assert.equal(location.origin, 'https://x.com')
    assert.equal(location.pathname, '/i/oauth2/authorize')
    assert.equal(location.searchParams.get('client_id'), 'x-client-id')
    assert.equal(
      location.searchParams.get('redirect_uri'),
      'https://app.example.com/auth/x/callback',
    )
    assert.equal(location.searchParams.get('response_type'), 'code')
    assert.equal(location.searchParams.get('scope'), 'tweet.read users.read')
    assert.equal(typeof location.searchParams.get('state'), 'string')
    assert.equal(typeof location.searchParams.get('code_challenge'), 'string')
    assert.equal(location.searchParams.get('code_challenge_method'), 'S256')
  })

  it('uses configured scopes in the X authorization URL', async () => {
    let cookie = createCookie('__session', { secrets: ['secret1'] })
    let storage = createMemorySessionStorage()
    let provider = createXAuthProvider({
      clientId: 'x-client-id',
      clientSecret: 'x-client-secret',
      redirectUri: 'https://app.example.com/auth/x/callback',
      scopes: ['users.read'],
    })
    let router = createRouter({
      middleware: [sessionMiddleware(cookie, storage)],
    })

    router.get('/login/x', createExternalAuthLoginRequestHandler(provider))

    let response = await router.fetch('https://app.example.com/login/x')
    let location = new URL(response.headers.get('Location')!)

    assert.equal(location.searchParams.get('scope'), 'users.read')
  })

  it('normalizes X profiles and exchanges tokens with HTTP basic auth', async () => {
    let restoreFetch = mockFetch(async (input, init) => {
      let url =
        typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url

      if (url === 'https://api.x.com/2/oauth2/token') {
        let body =
          init?.body instanceof URLSearchParams ? init.body.toString() : String(init?.body ?? '')

        let headers = new Headers(init?.headers)
        assert.equal(headers.get('Authorization'), `Basic ${btoa('x-client-id:x-client-secret')}`)
        assert.match(body, /grant_type=authorization_code/)
        assert.match(body, /code_verifier=/)
        assert.match(body, /redirect_uri=https%3A%2F%2Fapp\.example\.com%2Fauth%2Fx%2Fcallback/)
        assert.doesNotMatch(body, /client_id=/)
        assert.doesNotMatch(body, /client_secret=/)

        return Response.json({
          access_token: 'x-token',
          token_type: 'bearer',
          scope: 'tweet.read users.read',
        })
      }

      if (
        url ===
        'https://api.x.com/2/users/me?user.fields=profile_image_url,verified,description,url'
      ) {
        return Response.json({
          data: {
            id: 'x-user-1',
            name: 'X Person',
            username: 'xperson',
            profile_image_url: 'https://example.com/x-avatar.png',
            verified: true,
          },
        })
      }

      throw new Error(`Unexpected fetch: ${url}`)
    })

    try {
      let cookie = createCookie('__session', { secrets: ['secret1'] })
      let storage = createMemorySessionStorage()
      let provider = createXAuthProvider({
        clientId: 'x-client-id',
        clientSecret: 'x-client-secret',
        redirectUri: 'https://app.example.com/auth/x/callback',
      })
      let router = createRouter({
        middleware: [sessionMiddleware(cookie, storage)],
      })

      router.get('/login/x', createExternalAuthLoginRequestHandler(provider))
      router.get(
        '/auth/x/callback',
        createExternalAuthCallbackRequestHandler(provider, {
          writeSession(session, result) {
            session.set('auth', { userId: result.profile.id })
          },
          onSuccess(result) {
            return Response.json(result)
          },
        }),
      )

      let loginResponse = await router.fetch('https://app.example.com/login/x')
      let state = new URL(loginResponse.headers.get('Location')!).searchParams.get('state')
      let response = await router.fetch(
        createRequest(
          `https://app.example.com/auth/x/callback?code=x-code&state=${state}`,
          loginResponse,
        ),
      )

      let body = await response.json()

      assert.equal(body.provider, 'x')
      assert.deepEqual(body.account, {
        provider: 'x',
        providerAccountId: 'x-user-1',
      })
      assert.deepEqual(body.profile, {
        id: 'x-user-1',
        name: 'X Person',
        username: 'xperson',
        profile_image_url: 'https://example.com/x-avatar.png',
        verified: true,
      })
      assert.equal(body.tokens.accessToken, 'x-token')
      assert.equal(body.tokens.tokenType, 'bearer')
      assert.deepEqual(body.tokens.scope, ['tweet.read', 'users.read'])
    } finally {
      restoreFetch()
    }
  })

  it('fails when the X profile does not include a valid id', async () => {
    let restoreFetch = mockFetch(async (input) => {
      let url =
        typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url

      if (url === 'https://api.x.com/2/oauth2/token') {
        return Response.json({
          access_token: 'x-token',
          token_type: 'bearer',
          scope: 'tweet.read users.read',
        })
      }

      if (
        url ===
        'https://api.x.com/2/users/me?user.fields=profile_image_url,verified,description,url'
      ) {
        return Response.json({
          data: {
            name: 'X Person',
            username: 'xperson',
          },
        })
      }

      throw new Error(`Unexpected fetch: ${url}`)
    })

    try {
      let cookie = createCookie('__session', { secrets: ['secret1'] })
      let storage = createMemorySessionStorage()
      let provider = createXAuthProvider({
        clientId: 'x-client-id',
        clientSecret: 'x-client-secret',
        redirectUri: 'https://app.example.com/auth/x/callback',
      })
      let router = createRouter({
        middleware: [sessionMiddleware(cookie, storage)],
      })

      router.get('/login/x', createExternalAuthLoginRequestHandler(provider))
      router.get(
        '/auth/x/callback',
        createExternalAuthCallbackRequestHandler(provider, {
          writeSession(session, result) {
            session.set('auth', { userId: result.profile.id })
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

      let loginResponse = await router.fetch('https://app.example.com/login/x')
      let state = new URL(loginResponse.headers.get('Location')!).searchParams.get('state')
      let response = await router.fetch(
        createRequest(
          `https://app.example.com/auth/x/callback?code=x-code&state=${state}`,
          loginResponse,
        ),
      )

      assert.equal(response.status, 400)
      assert.deepEqual(await response.json(), {
        error: 'X profile did not include a valid id.',
      })
    } finally {
      restoreFetch()
    }
  })

  it('fails when the X profile does not include a valid username', async () => {
    let restoreFetch = mockFetch(async (input) => {
      let url =
        typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url

      if (url === 'https://api.x.com/2/oauth2/token') {
        return Response.json({
          access_token: 'x-token',
          token_type: 'bearer',
          scope: 'tweet.read users.read',
        })
      }

      if (
        url ===
        'https://api.x.com/2/users/me?user.fields=profile_image_url,verified,description,url'
      ) {
        return Response.json({
          data: {
            id: 'x-user-1',
            name: 'X Person',
          },
        })
      }

      throw new Error(`Unexpected fetch: ${url}`)
    })

    try {
      let cookie = createCookie('__session', { secrets: ['secret1'] })
      let storage = createMemorySessionStorage()
      let provider = createXAuthProvider({
        clientId: 'x-client-id',
        clientSecret: 'x-client-secret',
        redirectUri: 'https://app.example.com/auth/x/callback',
      })
      let router = createRouter({
        middleware: [sessionMiddleware(cookie, storage)],
      })

      router.get('/login/x', createExternalAuthLoginRequestHandler(provider))
      router.get(
        '/auth/x/callback',
        createExternalAuthCallbackRequestHandler(provider, {
          writeSession(session, result) {
            session.set('auth', { userId: result.profile.id })
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

      let loginResponse = await router.fetch('https://app.example.com/login/x')
      let state = new URL(loginResponse.headers.get('Location')!).searchParams.get('state')
      let response = await router.fetch(
        createRequest(
          `https://app.example.com/auth/x/callback?code=x-code&state=${state}`,
          loginResponse,
        ),
      )

      assert.equal(response.status, 400)
      assert.deepEqual(await response.json(), {
        error: 'X profile did not include a valid username.',
      })
    } finally {
      restoreFetch()
    }
  })

  it('fails when the X profile does not include a valid name', async () => {
    let restoreFetch = mockFetch(async (input) => {
      let url =
        typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url

      if (url === 'https://api.x.com/2/oauth2/token') {
        return Response.json({
          access_token: 'x-token',
          token_type: 'bearer',
          scope: 'tweet.read users.read',
        })
      }

      if (
        url ===
        'https://api.x.com/2/users/me?user.fields=profile_image_url,verified,description,url'
      ) {
        return Response.json({
          data: {
            id: 'x-user-1',
            username: 'xperson',
          },
        })
      }

      throw new Error(`Unexpected fetch: ${url}`)
    })

    try {
      let cookie = createCookie('__session', { secrets: ['secret1'] })
      let storage = createMemorySessionStorage()
      let provider = createXAuthProvider({
        clientId: 'x-client-id',
        clientSecret: 'x-client-secret',
        redirectUri: 'https://app.example.com/auth/x/callback',
      })
      let router = createRouter({
        middleware: [sessionMiddleware(cookie, storage)],
      })

      router.get('/login/x', createExternalAuthLoginRequestHandler(provider))
      router.get(
        '/auth/x/callback',
        createExternalAuthCallbackRequestHandler(provider, {
          writeSession(session, result) {
            session.set('auth', { userId: result.profile.id })
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

      let loginResponse = await router.fetch('https://app.example.com/login/x')
      let state = new URL(loginResponse.headers.get('Location')!).searchParams.get('state')
      let response = await router.fetch(
        createRequest(
          `https://app.example.com/auth/x/callback?code=x-code&state=${state}`,
          loginResponse,
        ),
      )

      assert.equal(response.status, 400)
      assert.deepEqual(await response.json(), {
        error: 'X profile did not include a valid name.',
      })
    } finally {
      restoreFetch()
    }
  })
})
