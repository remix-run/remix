import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createCookie } from '@remix-run/cookie'
import { createRouter } from '@remix-run/fetch-router'
import { createMemorySessionStorage } from '@remix-run/session/memory-storage'
import { session as sessionMiddleware } from '@remix-run/session-middleware'

import { callback } from '../callback.ts'
import { login } from '../login.ts'
import { createRequest, mockFetch } from '../test-utils.ts'
import { facebook } from './facebook.ts'

describe('facebook provider', () => {
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
      let provider = facebook({
        clientId: 'facebook-client-id',
        clientSecret: 'facebook-client-secret',
        redirectUri: 'https://app.example.com/auth/facebook/callback',
      })
      let router = createRouter({
        middleware: [sessionMiddleware(cookie, storage)],
      })

      router.get('/login/facebook', login(provider))
      router.get(
        '/auth/facebook/callback',
        callback(provider, {
          createSessionAuth(result) {
            return { userId: result.profile.id, method: 'facebook' as const }
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
})
