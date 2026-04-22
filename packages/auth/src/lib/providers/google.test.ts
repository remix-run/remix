import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { createCookie } from '@remix-run/cookie'
import { createRouter } from '@remix-run/fetch-router'
import { createMemorySessionStorage } from '@remix-run/session/memory-storage'
import { session as sessionMiddleware } from '@remix-run/session-middleware'

import { startExternalAuth } from '../start-external-auth.ts'
import { createGoogleAuthProvider } from './google.ts'

describe('google provider', () => {
  it('uses the Google OIDC defaults and provider name', async () => {
    let cookie = createCookie('__session', { secrets: ['secret1'] })
    let storage = createMemorySessionStorage()
    let provider = createGoogleAuthProvider({
      clientId: 'client-id',
      clientSecret: 'client-secret',
      redirectUri: 'https://app.example.com/auth/google/callback',
    })
    let router = createRouter({
      middleware: [sessionMiddleware(cookie, storage)],
    })

    router.get('/login/google', (context) => startExternalAuth(provider, context))

    let response = await router.fetch('https://app.example.com/login/google')
    let location = new URL(response.headers.get('Location')!)

    assert.equal(provider.name, 'google')
    assert.equal(response.status, 302)
    assert.equal(location.origin, 'https://accounts.google.com')
    assert.equal(location.pathname, '/o/oauth2/v2/auth')
    assert.equal(location.searchParams.get('scope'), 'openid email profile')
  })
})
