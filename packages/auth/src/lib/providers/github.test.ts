import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createCookie } from '@remix-run/cookie'
import { createRouter } from '@remix-run/fetch-router'
import { createMemorySessionStorage } from '@remix-run/session/memory-storage'
import { session as sessionMiddleware } from '@remix-run/session-middleware'

import { callback } from '../callback.ts'
import { login } from '../login.ts'
import { github } from './github.ts'
import { createRequest, mockFetch } from '../test-utils.ts'

describe('github provider', () => {
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
      let provider = github({
        clientId: 'github-client-id',
        clientSecret: 'github-client-secret',
        redirectUri: 'https://app.example.com/auth/github/callback',
      })
      let router = createRouter({
        middleware: [sessionMiddleware(cookie, storage)],
      })

      router.get('/login/github', login(provider))
      router.get(
        '/auth/github/callback',
        callback(provider, {
          createSessionAuth(result) {
            return { userId: String(result.profile.id), method: 'github' as const }
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
})
