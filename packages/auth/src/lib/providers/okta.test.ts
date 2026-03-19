import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createCookie } from '@remix-run/cookie'
import { createRouter } from '@remix-run/fetch-router'
import { createMemorySessionStorage } from '@remix-run/session/memory-storage'
import { session as sessionMiddleware } from '@remix-run/session-middleware'

import { createExternalAuthLoginRequestHandler } from '../external-login.ts'
import { mockFetch } from '../test-utils.ts'
import { createOktaAuthProvider } from './okta.ts'

describe('okta provider', () => {
  it('uses the provided Okta issuer and provider name', async () => {
    let cookie = createCookie('__session', { secrets: ['secret1'] })
    let storage = createMemorySessionStorage()
    let provider = createOktaAuthProvider({
      issuer: 'https://example.okta.com/oauth2/default',
      clientId: 'client-id',
      clientSecret: 'client-secret',
      redirectUri: 'https://app.example.com/auth/okta/callback',
    })
    let restoreFetch = mockFetch(async input => {
      let url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url

      assert.equal(
        url,
        'https://example.okta.com/oauth2/default/.well-known/openid-configuration',
      )

      return Response.json({
        issuer: 'https://example.okta.com/oauth2/default',
        authorization_endpoint: 'https://example.okta.com/oauth2/default/v1/authorize',
        token_endpoint: 'https://example.okta.com/oauth2/default/v1/token',
        userinfo_endpoint: 'https://example.okta.com/oauth2/default/v1/userinfo',
      })
    })

    try {
      let router = createRouter({
        middleware: [sessionMiddleware(cookie, storage)],
      })

      router.get('/login/okta', createExternalAuthLoginRequestHandler(provider))

      let response = await router.fetch('https://app.example.com/login/okta')

      assert.equal(provider.name, 'okta')
      assert.equal(response.status, 302)
      assert.equal(new URL(response.headers.get('Location')!).origin, 'https://example.okta.com')
    } finally {
      restoreFetch()
    }
  })
})
