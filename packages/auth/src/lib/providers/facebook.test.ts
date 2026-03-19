import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createCookie } from '@remix-run/cookie'
import { createRouter } from '@remix-run/fetch-router'
import { createMemorySessionStorage } from '@remix-run/session/memory-storage'
import { session as sessionMiddleware } from '@remix-run/session-middleware'

import { createExternalAuthCallbackRequestHandler } from '../external-callback.ts'
import { createExternalAuthLoginRequestHandler } from '../external-login.ts'
import { createRequest, mockFetch } from '../test-utils.ts'
import { createFacebookAuthProvider } from './facebook.ts'

describe('facebook provider', () => {
  it('redirects to the Facebook authorization endpoint with default PKCE parameters', async () => {
    let cookie = createCookie('__session', { secrets: ['secret1'] })
    let storage = createMemorySessionStorage()
    let provider = createFacebookAuthProvider({
      clientId: 'facebook-client-id',
      clientSecret: 'facebook-client-secret',
      redirectUri: 'https://app.example.com/auth/facebook/callback',
    })
    let router = createRouter({
      middleware: [sessionMiddleware(cookie, storage)],
    })

    router.get('/login/facebook', createExternalAuthLoginRequestHandler(provider))

    let response = await router.fetch('https://app.example.com/login/facebook')
    let location = new URL(response.headers.get('Location')!)

    assert.equal(response.status, 302)
    assert.equal(location.origin, 'https://www.facebook.com')
    assert.equal(location.pathname, '/dialog/oauth')
    assert.equal(location.searchParams.get('client_id'), 'facebook-client-id')
    assert.equal(
      location.searchParams.get('redirect_uri'),
      'https://app.example.com/auth/facebook/callback',
    )
    assert.equal(location.searchParams.get('response_type'), 'code')
    assert.equal(location.searchParams.get('scope'), 'public_profile email')
    assert.equal(typeof location.searchParams.get('state'), 'string')
    assert.equal(typeof location.searchParams.get('code_challenge'), 'string')
    assert.equal(location.searchParams.get('code_challenge_method'), 'S256')
  })

  it('uses configured scopes in the Facebook authorization URL', async () => {
    let cookie = createCookie('__session', { secrets: ['secret1'] })
    let storage = createMemorySessionStorage()
    let provider = createFacebookAuthProvider({
      clientId: 'facebook-client-id',
      clientSecret: 'facebook-client-secret',
      redirectUri: 'https://app.example.com/auth/facebook/callback',
      scopes: ['email'],
    })
    let router = createRouter({
      middleware: [sessionMiddleware(cookie, storage)],
    })

    router.get('/login/facebook', createExternalAuthLoginRequestHandler(provider))

    let response = await router.fetch('https://app.example.com/login/facebook')
    let location = new URL(response.headers.get('Location')!)

    assert.equal(location.searchParams.get('scope'), 'email')
  })

  it('normalizes Facebook profiles and tokens', async () => {
    let restoreFetch = mockFetch(async input => {
      let url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url

      if (url === 'https://graph.facebook.com/oauth/access_token') {
        return Response.json({
          access_token: 'facebook-token',
          token_type: 'bearer',
          expires_in: 3600,
        })
      }

      if (url === 'https://graph.facebook.com/me?fields=id,name,email,picture') {
        return Response.json({
          id: 'fb_123',
          name: 'Michael Jackson',
          email: 'mj@example.com',
          picture: {
            data: {
              url: 'https://example.com/avatar.png',
            },
          },
        })
      }

      throw new Error(`Unexpected fetch: ${url}`)
    })

    try {
      let cookie = createCookie('__session', { secrets: ['secret1'] })
      let storage = createMemorySessionStorage()
      let provider = createFacebookAuthProvider({
        clientId: 'facebook-client-id',
        clientSecret: 'facebook-client-secret',
        redirectUri: 'https://app.example.com/auth/facebook/callback',
      })
      let router = createRouter({
        middleware: [sessionMiddleware(cookie, storage)],
      })

      router.get('/login/facebook', createExternalAuthLoginRequestHandler(provider))
      router.get(
        '/auth/facebook/callback',
        createExternalAuthCallbackRequestHandler(provider, {
          writeSession(session, result) {
            session.set('auth', { userId: result.profile.id })
          },
          onSuccess(result) {
            return Response.json(result)
          },
        }),
      )

      let loginResponse = await router.fetch('https://app.example.com/login/facebook')
      let state = new URL(loginResponse.headers.get('Location')!).searchParams.get('state')
      let response = await router.fetch(
        createRequest(
          `https://app.example.com/auth/facebook/callback?code=facebook-code&state=${state}`,
          loginResponse,
        ),
      )

      let body = await response.json()

      assert.equal(body.provider, 'facebook')
      assert.deepEqual(body.account, {
        provider: 'facebook',
        providerAccountId: 'fb_123',
      })
      assert.deepEqual(body.profile, {
        id: 'fb_123',
        name: 'Michael Jackson',
        email: 'mj@example.com',
        picture: {
          data: {
            url: 'https://example.com/avatar.png',
          },
        },
      })
      assert.equal(body.tokens.accessToken, 'facebook-token')
      assert.equal(body.tokens.tokenType, 'bearer')
      assert.equal(typeof body.tokens.expiresAt, 'string')
    } finally {
      restoreFetch()
    }
  })

  it('fails when the Facebook profile does not include a valid id', async () => {
    let restoreFetch = mockFetch(async input => {
      let url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url

      if (url === 'https://graph.facebook.com/oauth/access_token') {
        return Response.json({
          access_token: 'facebook-token',
          token_type: 'bearer',
          expires_in: 3600,
        })
      }

      if (url === 'https://graph.facebook.com/me?fields=id,name,email,picture') {
        return Response.json({
          name: 'Michael Jackson',
          email: 'mj@example.com',
        })
      }

      throw new Error(`Unexpected fetch: ${url}`)
    })

    try {
      let cookie = createCookie('__session', { secrets: ['secret1'] })
      let storage = createMemorySessionStorage()
      let provider = createFacebookAuthProvider({
        clientId: 'facebook-client-id',
        clientSecret: 'facebook-client-secret',
        redirectUri: 'https://app.example.com/auth/facebook/callback',
      })
      let router = createRouter({
        middleware: [sessionMiddleware(cookie, storage)],
      })

      router.get('/login/facebook', createExternalAuthLoginRequestHandler(provider))
      router.get(
        '/auth/facebook/callback',
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

      let loginResponse = await router.fetch('https://app.example.com/login/facebook')
      let state = new URL(loginResponse.headers.get('Location')!).searchParams.get('state')
      let response = await router.fetch(
        createRequest(
          `https://app.example.com/auth/facebook/callback?code=facebook-code&state=${state}`,
          loginResponse,
        ),
      )

      assert.equal(response.status, 400)
      assert.deepEqual(await response.json(), {
        error: 'Facebook profile did not include a valid id.',
      })
    } finally {
      restoreFetch()
    }
  })
})
