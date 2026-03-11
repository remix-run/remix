import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createCookie } from '@remix-run/cookie'
import { createRouter } from '@remix-run/fetch-router'
import { createMemorySessionStorage } from '@remix-run/session/memory-storage'
import { session as sessionMiddleware } from '@remix-run/session-middleware'

import { login } from '../login.ts'
import { mockFetch } from '../test-utils.ts'
import { createAuth0AuthProvider } from './auth0.ts'

describe('auth0 provider', () => {
  it('derives the issuer from the Auth0 domain and provider name', async () => {
    let cookie = createCookie('__session', { secrets: ['secret1'] })
    let storage = createMemorySessionStorage()
    let provider = createAuth0AuthProvider({
      domain: 'tenant.us.auth0.com',
      clientId: 'client-id',
      clientSecret: 'client-secret',
      redirectUri: 'https://app.example.com/auth/auth0/callback',
    })
    let restoreFetch = mockFetch(async input => {
      let url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url

      assert.equal(url, 'https://tenant.us.auth0.com/.well-known/openid-configuration')

      return Response.json({
        issuer: 'https://tenant.us.auth0.com/',
        authorization_endpoint: 'https://tenant.us.auth0.com/authorize',
        token_endpoint: 'https://tenant.us.auth0.com/oauth/token',
        userinfo_endpoint: 'https://tenant.us.auth0.com/userinfo',
      })
    })

    try {
      let router = createRouter({
        middleware: [sessionMiddleware(cookie, storage)],
      })

      router.get('/login/auth0', login(provider))

      let response = await router.fetch('https://app.example.com/login/auth0')

      assert.equal(provider.name, 'auth0')
      assert.equal(response.status, 302)
      assert.equal(new URL(response.headers.get('Location')!).origin, 'https://tenant.us.auth0.com')
    } finally {
      restoreFetch()
    }
  })
})
