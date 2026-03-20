import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createCookie } from '@remix-run/cookie'
import { createRouter } from '@remix-run/fetch-router'
import { createMemorySessionStorage } from '@remix-run/session/memory-storage'
import { session as sessionMiddleware } from '@remix-run/session-middleware'

import { createExternalAuthLoginRequestHandler } from './external-login.ts'
import { createGoogleAuthProvider } from './providers/google.ts'

describe('createExternalAuthLoginRequestHandler()', () => {
  it('redirects OAuth login requests to the provider authorization URL and stores a transaction', async () => {
    let cookie = createCookie('__session', { secrets: ['secret1'] })
    let storage = createMemorySessionStorage()
    let provider = createGoogleAuthProvider({
      clientId: 'google-client-id',
      clientSecret: 'google-client-secret',
      redirectUri: 'https://app.example.com/auth/google/callback',
    })
    let router = createRouter({
      middleware: [sessionMiddleware(cookie, storage)],
    })

    router.get('/login/google', createExternalAuthLoginRequestHandler(provider))

    let response = await router.fetch('https://app.example.com/login/google?returnTo=/dashboard')
    let location = new URL(response.headers.get('Location')!)

    assert.equal(response.status, 302)
    assert.equal(response.headers.getSetCookie().length, 1)
    assert.equal(location.origin, 'https://accounts.google.com')
    assert.equal(location.pathname, '/o/oauth2/v2/auth')
    assert.equal(location.searchParams.get('client_id'), 'google-client-id')
    assert.equal(
      location.searchParams.get('redirect_uri'),
      'https://app.example.com/auth/google/callback',
    )
    assert.equal(location.searchParams.get('response_type'), 'code')
    assert.equal(location.searchParams.get('scope'), 'openid email profile')
    assert.equal(typeof location.searchParams.get('state'), 'string')
    assert.equal(typeof location.searchParams.get('code_challenge'), 'string')
    assert.equal(location.searchParams.get('code_challenge_method'), 'S256')
  })
})
