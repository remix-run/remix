import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createCookie } from '@remix-run/cookie'
import { createRouter } from '@remix-run/fetch-router'
import { createMemorySessionStorage } from '@remix-run/session/memory-storage'
import { session as sessionMiddleware } from '@remix-run/session-middleware'

import { createAuthCallbackRequestHandler } from '../callback.ts'
import { createAuthLoginRequestHandler } from '../login.ts'
import { createGitHubAuthProvider } from './github.ts'
import { createRequest, mockFetch } from '../test-utils.ts'

describe('github provider', () => {
  it('redirects to the GitHub authorization endpoint with configured scopes', async () => {
    let cookie = createCookie('__session', { secrets: ['secret1'] })
    let storage = createMemorySessionStorage()
    let provider = createGitHubAuthProvider({
      clientId: 'github-client-id',
      clientSecret: 'github-client-secret',
      redirectUri: 'https://app.example.com/auth/github/callback',
      scopes: ['read:user', 'repo'],
    })
    let router = createRouter({
      middleware: [sessionMiddleware(cookie, storage)],
    })

    router.get('/login/github', createAuthLoginRequestHandler(provider))

    let response = await router.fetch('https://app.example.com/login/github')
    let location = new URL(response.headers.get('Location')!)

    assert.equal(response.status, 302)
    assert.equal(location.origin, 'https://github.com')
    assert.equal(location.pathname, '/login/oauth/authorize')
    assert.equal(location.searchParams.get('client_id'), 'github-client-id')
    assert.equal(
      location.searchParams.get('redirect_uri'),
      'https://app.example.com/auth/github/callback',
    )
    assert.equal(location.searchParams.get('scope'), 'read:user repo')
    assert.equal(typeof location.searchParams.get('state'), 'string')
    assert.equal(typeof location.searchParams.get('code_challenge'), 'string')
    assert.equal(location.searchParams.get('code_challenge_method'), 'S256')
  })

  it('hydrates missing email addresses from the GitHub email API', async () => {
    let restoreFetch = mockFetch(async input => {
      let url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url

      if (url === 'https://github.com/login/oauth/access_token') {
        return Response.json({
          access_token: 'github-token',
          token_type: 'bearer',
          scope: 'read:user,user:email',
        })
      }

      if (url === 'https://api.github.com/user') {
        return Response.json({
          id: 123,
          login: 'mjackson',
          email: null,
          name: 'Michael Jackson',
        })
      }

      if (url === 'https://api.github.com/user/emails') {
        return Response.json([
          {
            email: 'mj@example.com',
            primary: true,
            verified: true,
          },
        ])
      }

      throw new Error(`Unexpected fetch: ${url}`)
    })

    try {
      let cookie = createCookie('__session', { secrets: ['secret1'] })
      let storage = createMemorySessionStorage()
      let provider = createGitHubAuthProvider({
        clientId: 'github-client-id',
        clientSecret: 'github-client-secret',
        redirectUri: 'https://app.example.com/auth/github/callback',
      })
      let router = createRouter({
        middleware: [sessionMiddleware(cookie, storage)],
      })

      router.get('/login/github', createAuthLoginRequestHandler(provider))
      router.get(
        '/auth/github/callback',
        createAuthCallbackRequestHandler(provider, {
          writeSession(session, result) {
            session.set('auth', { userId: String(result.profile.id) })
          },
          onSuccess(result) {
            return Response.json(result)
          },
        }),
      )

      let loginResponse = await router.fetch('https://app.example.com/login/github')
      let state = new URL(loginResponse.headers.get('Location')!).searchParams.get('state')
      let response = await router.fetch(
        createRequest(
          `https://app.example.com/auth/github/callback?code=github-code&state=${state}`,
          loginResponse,
        ),
      )

      assert.deepEqual(await response.json(), {
        provider: 'github',
        account: {
          provider: 'github',
          providerAccountId: '123',
        },
        profile: {
          id: 123,
          login: 'mjackson',
          email: 'mj@example.com',
          name: 'Michael Jackson',
        },
        tokens: {
          accessToken: 'github-token',
          tokenType: 'bearer',
          scope: ['read:user', 'user:email'],
        },
      })
    } finally {
      restoreFetch()
    }
  })

  it('uses the primary profile email without calling the GitHub email API', async () => {
    let emailRequests = 0
    let restoreFetch = mockFetch(async input => {
      let url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url

      if (url === 'https://github.com/login/oauth/access_token') {
        return Response.json({
          access_token: 'github-token',
          token_type: 'bearer',
          scope: 'read:user,user:email',
        })
      }

      if (url === 'https://api.github.com/user') {
        return Response.json({
          id: 123,
          login: 'mjackson',
          email: 'mj@example.com',
          name: 'Michael Jackson',
        })
      }

      if (url === 'https://api.github.com/user/emails') {
        emailRequests += 1
        return Response.json([])
      }

      throw new Error(`Unexpected fetch: ${url}`)
    })

    try {
      let cookie = createCookie('__session', { secrets: ['secret1'] })
      let storage = createMemorySessionStorage()
      let provider = createGitHubAuthProvider({
        clientId: 'github-client-id',
        clientSecret: 'github-client-secret',
        redirectUri: 'https://app.example.com/auth/github/callback',
      })
      let router = createRouter({
        middleware: [sessionMiddleware(cookie, storage)],
      })

      router.get('/login/github', createAuthLoginRequestHandler(provider))
      router.get(
        '/auth/github/callback',
        createAuthCallbackRequestHandler(provider, {
          writeSession(session, result) {
            session.set('auth', { userId: String(result.profile.id) })
          },
          onSuccess(result) {
            return Response.json(result)
          },
        }),
      )

      let loginResponse = await router.fetch('https://app.example.com/login/github')
      let state = new URL(loginResponse.headers.get('Location')!).searchParams.get('state')
      let response = await router.fetch(
        createRequest(
          `https://app.example.com/auth/github/callback?code=github-code&state=${state}`,
          loginResponse,
        ),
      )

      let body = await response.json()

      assert.equal(body.profile.email, 'mj@example.com')
      assert.equal(emailRequests, 0)
    } finally {
      restoreFetch()
    }
  })

  it('keeps the GitHub profile email unchanged when the email API returns no addresses', async () => {
    let restoreFetch = mockFetch(async input => {
      let url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url

      if (url === 'https://github.com/login/oauth/access_token') {
        return Response.json({
          access_token: 'github-token',
          token_type: 'bearer',
          scope: 'read:user,user:email',
        })
      }

      if (url === 'https://api.github.com/user') {
        return Response.json({
          id: 123,
          login: 'mjackson',
          email: null,
          name: 'Michael Jackson',
        })
      }

      if (url === 'https://api.github.com/user/emails') {
        return Response.json([])
      }

      throw new Error(`Unexpected fetch: ${url}`)
    })

    try {
      let cookie = createCookie('__session', { secrets: ['secret1'] })
      let storage = createMemorySessionStorage()
      let provider = createGitHubAuthProvider({
        clientId: 'github-client-id',
        clientSecret: 'github-client-secret',
        redirectUri: 'https://app.example.com/auth/github/callback',
      })
      let router = createRouter({
        middleware: [sessionMiddleware(cookie, storage)],
      })

      router.get('/login/github', createAuthLoginRequestHandler(provider))
      router.get(
        '/auth/github/callback',
        createAuthCallbackRequestHandler(provider, {
          writeSession(session, result) {
            session.set('auth', { userId: String(result.profile.id) })
          },
          onSuccess(result) {
            return Response.json(result)
          },
        }),
      )

      let loginResponse = await router.fetch('https://app.example.com/login/github')
      let state = new URL(loginResponse.headers.get('Location')!).searchParams.get('state')
      let response = await router.fetch(
        createRequest(
          `https://app.example.com/auth/github/callback?code=github-code&state=${state}`,
          loginResponse,
        ),
      )

      let body = await response.json()

      assert.equal(body.profile.email, null)
      assert.equal(body.account.providerAccountId, '123')
    } finally {
      restoreFetch()
    }
  })

  it('fails when the GitHub profile does not include a valid id', async () => {
    let restoreFetch = mockFetch(async input => {
      let url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url

      if (url === 'https://github.com/login/oauth/access_token') {
        return Response.json({
          access_token: 'github-token',
          token_type: 'bearer',
          scope: 'read:user,user:email',
        })
      }

      if (url === 'https://api.github.com/user') {
        return Response.json({
          login: 'mjackson',
          email: 'mj@example.com',
          name: 'Michael Jackson',
        })
      }

      throw new Error(`Unexpected fetch: ${url}`)
    })

    try {
      let cookie = createCookie('__session', { secrets: ['secret1'] })
      let storage = createMemorySessionStorage()
      let provider = createGitHubAuthProvider({
        clientId: 'github-client-id',
        clientSecret: 'github-client-secret',
        redirectUri: 'https://app.example.com/auth/github/callback',
      })
      let router = createRouter({
        middleware: [sessionMiddleware(cookie, storage)],
      })

      router.get('/login/github', createAuthLoginRequestHandler(provider))
      router.get(
        '/auth/github/callback',
        createAuthCallbackRequestHandler(provider, {
          writeSession(session, result) {
            session.set('auth', { userId: String(result.profile.id) })
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

      let loginResponse = await router.fetch('https://app.example.com/login/github')
      let state = new URL(loginResponse.headers.get('Location')!).searchParams.get('state')
      let response = await router.fetch(
        createRequest(
          `https://app.example.com/auth/github/callback?code=github-code&state=${state}`,
          loginResponse,
        ),
      )

      assert.equal(response.status, 400)
      assert.deepEqual(await response.json(), {
        error: 'GitHub profile did not include a valid id.',
      })
    } finally {
      restoreFetch()
    }
  })
})
