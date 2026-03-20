import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createCookie } from '@remix-run/cookie'
import { createRouter } from '@remix-run/fetch-router'
import { createMemorySessionStorage } from '@remix-run/session/memory-storage'
import { session as sessionMiddleware } from '@remix-run/session-middleware'

import { createExternalAuthLoginRequestHandler } from '../external-login.ts'
import { mockFetch } from '../test-utils.ts'
import { createMicrosoftAuthProvider } from './microsoft.ts'

describe('microsoft provider', () => {
  it('uses the tenant-specific Microsoft issuer and provider name', async () => {
    let cookie = createCookie('__session', { secrets: ['secret1'] })
    let storage = createMemorySessionStorage()
    let provider = createMicrosoftAuthProvider({
      tenant: 'organizations',
      clientId: 'client-id',
      clientSecret: 'client-secret',
      redirectUri: 'https://app.example.com/auth/microsoft/callback',
    })
    let restoreFetch = mockFetch(async (input) => {
      let url =
        typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url

      assert.equal(
        url,
        'https://login.microsoftonline.com/organizations/v2.0/.well-known/openid-configuration',
      )

      return Response.json({
        issuer: 'https://login.microsoftonline.com/organizations/v2.0',
        authorization_endpoint:
          'https://login.microsoftonline.com/organizations/oauth2/v2.0/authorize',
        token_endpoint: 'https://login.microsoftonline.com/organizations/oauth2/v2.0/token',
        userinfo_endpoint: 'https://graph.microsoft.com/oidc/userinfo',
      })
    })

    try {
      let router = createRouter({
        middleware: [sessionMiddleware(cookie, storage)],
      })

      router.get('/login/microsoft', createExternalAuthLoginRequestHandler(provider))

      let response = await router.fetch('https://app.example.com/login/microsoft')

      assert.equal(provider.name, 'microsoft')
      assert.equal(response.status, 302)
      assert.equal(
        new URL(response.headers.get('Location')!).origin,
        'https://login.microsoftonline.com',
      )
    } finally {
      restoreFetch()
    }
  })
})
