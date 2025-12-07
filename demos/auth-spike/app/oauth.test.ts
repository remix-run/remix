import * as assert from 'node:assert/strict'
import { describe, it, beforeEach } from 'node:test'
import { createRouter, type RouteHandler } from '@remix-run/fetch-router'
import { formData as formDataMiddleware } from '@remix-run/form-data-middleware'
import { session as sessionMiddleware } from '@remix-run/session-middleware'
import { createAuthClient } from '@remix-run/auth'
import type { MemoryDB } from '@remix-run/auth/storage-adapters/memory'
import { createMemoryStorageAdapter } from '@remix-run/auth/storage-adapters/memory'
import { createTestMockOAuthProvider } from './mock-oauth/provider.ts'
import { createAuthMiddleware } from '@remix-run/auth-middleware'
import { createCookie } from '@remix-run/cookie'
import { createMemorySessionStorage } from '@remix-run/session/memory-storage'
import { setupTest, getSessionCookie, assertContains } from '../test/helpers.ts'

describe('OAuth integration', () => {
  beforeEach(setupTest)

  it('signs up new user via OAuth', async () => {
    // Set up auth client with mock provider (no HTTP calls)
    let sessionCookie = createCookie('session', { secrets: ['secret'] })
    let sessionStorage = createMemorySessionStorage()

    let db: MemoryDB = {
      user: [],
      password: [],
      oauthAccount: [],
      passwordResetToken: [],
    }

    let authClient = createAuthClient({
      secret: 'test-secret-key',
      user: {
        additionalFields: {
          name: { type: 'string', required: true },
        },
      },
      oauth: {
        enabled: true,
        providers: {
          mock: {
            provider: createTestMockOAuthProvider({
              id: 'mock-oauth-123',
              email: 'oauth-user@example.com',
              name: 'OAuth User',
            }),
            clientId: 'test-client-id',
            clientSecret: 'test-client-secret',
          },
        },
        baseURL: 'https://app.example.com',
        successURL: '/home',
        errorURL: '/login',
      },
      storage: createMemoryStorageAdapter(db),
    })

    let { auth, getUser } = createAuthMiddleware(authClient)

    // Set up app router
    let router = createRouter({
      middleware: [formDataMiddleware(), sessionMiddleware(sessionCookie, sessionStorage), auth],
    })

    // Map OAuth handlers directly from authClient.oauth
    if (authClient.oauth.flows.mock) {
      router.get('/auth/mock', ({ request, session }) =>
        authClient.oauth.flows.mock.initiate(request, session),
      )
      router.get('/auth/mock/callback', ({ request, session }) =>
        authClient.oauth.flows.mock.callback(request, session),
      )
    }
    router.get('/home', () => {
      let user = getUser()
      return new Response(user ? `Welcome ${user.name}!` : 'Not logged in')
    })

    // Step 1: Initiate OAuth flow
    let initiateResponse = await router.fetch('https://app.example.com/auth/mock', {
      redirect: 'manual',
    })

    assert.equal(initiateResponse.status, 302)
    let authUrl = initiateResponse.headers.get('Location')
    assert.ok(authUrl)

    // Extract state from auth URL
    let authUrlParsed = new URL(authUrl!)
    let state = authUrlParsed.searchParams.get('state')
    let redirectUri = authUrlParsed.searchParams.get('redirect_uri')

    // Step 2: Simulate OAuth provider redirecting back with code
    // (In real flow, user would authorize and provider would redirect)
    let callbackResponse = await router.fetch(
      `${redirectUri}?code=mock_auth_code_123&state=${state}`,
      { redirect: 'manual' },
    )

    assert.equal(callbackResponse.status, 302)
    assert.equal(callbackResponse.headers.get('Location'), '/home')

    // Step 3: Verify user is logged in
    let sessionId = getSessionCookie(callbackResponse)
    assert.ok(sessionId)

    let homeResponse = await router.fetch('https://app.example.com/home', {
      headers: {
        Cookie: `session=${sessionId}`,
      },
    })

    let html = await homeResponse.text()
    assertContains(html, 'Welcome OAuth User!')
  })

  it('links OAuth account to existing user with same email', async () => {
    let sessionCookie = createCookie('session', { secrets: ['secret'] })
    let sessionStorage = createMemorySessionStorage()

    let db: MemoryDB = {
      user: [
        {
          id: 'existing-user-id',
          email: 'existing@example.com',
          name: 'Existing User',
        },
      ],
      password: [
        {
          userId: 'existing-user-id',
          hashedPassword: 'hashed-password',
        },
      ],
      oauthAccount: [],
      passwordResetToken: [],
    }

    let authClient = createAuthClient({
      secret: 'test-secret-key',
      oauth: {
        enabled: true,
        providers: {
          mock: {
            provider: createTestMockOAuthProvider({
              id: 'mock-oauth-456',
              email: 'existing@example.com', // Same email!
              name: 'Existing User',
            }),
            clientId: 'test-client-id',
            clientSecret: 'test-client-secret',
          },
        },
        baseURL: 'https://app.example.com',
        successURL: '/home',
        errorURL: '/login',
      },
      storage: createMemoryStorageAdapter(db),
    })

    let { auth, getUser } = createAuthMiddleware(authClient)

    let router = createRouter({
      middleware: [formDataMiddleware(), sessionMiddleware(sessionCookie, sessionStorage), auth],
    })

    // Map OAuth handlers directly from authClient.oauth
    if (authClient.oauth.flows.mock) {
      router.get('/auth/mock', ({ request, session }) =>
        authClient.oauth.flows.mock.initiate(request, session),
      )
      router.get('/auth/mock/callback', ({ request, session }) =>
        authClient.oauth.flows.mock.callback(request, session),
      )
    }

    // Initiate and complete OAuth flow
    let initiateResponse = await router.fetch('https://app.example.com/auth/mock', {
      redirect: 'manual',
    })

    let authUrl = initiateResponse.headers.get('Location')!
    let authUrlParsed = new URL(authUrl)
    let state = authUrlParsed.searchParams.get('state')
    let redirectUri = authUrlParsed.searchParams.get('redirect_uri')

    let callbackResponse = await router.fetch(
      `${redirectUri}?code=mock_auth_code_456&state=${state}`,
      { redirect: 'manual' },
    )

    assert.equal(callbackResponse.status, 302)
    assert.equal(callbackResponse.headers.get('Location'), '/home')
  })

  it('handles OAuth error during callback', async () => {
    let sessionCookie = createCookie('session', { secrets: ['secret'] })
    let sessionStorage = createMemorySessionStorage()

    let db: MemoryDB = {
      user: [],
      password: [],
      oauthAccount: [],
      passwordResetToken: [],
    }

    let authClient = createAuthClient({
      secret: 'test-secret-key',
      oauth: {
        enabled: true,
        providers: {
          mock: {
            provider: createTestMockOAuthProvider({
              id: '123',
              email: 'test@example.com',
            }),
            clientId: 'test-client-id',
            clientSecret: 'test-client-secret',
          },
        },
        baseURL: 'https://app.example.com',
        successURL: '/home',
        errorURL: '/login',
      },
      storage: createMemoryStorageAdapter(db),
    })

    let { auth } = createAuthMiddleware(authClient)

    let router = createRouter({
      middleware: [formDataMiddleware(), sessionMiddleware(sessionCookie, sessionStorage), auth],
    })

    // Map OAuth handlers directly from authClient.oauth
    if (authClient.oauth.flows.mock) {
      router.get('/auth/mock', ({ request, session }) =>
        authClient.oauth.flows.mock.initiate(request, session),
      )
      router.get('/auth/mock/callback', ({ request, session }) =>
        authClient.oauth.flows.mock.callback(request, session),
      )
    }

    // Add login route to display errors
    router.get('/login', ({ session }) => {
      let error = session.get('error')
      return new Response(
        error
          ? `<html><body>Error: ${error}</body></html>`
          : '<html><body>Login page</body></html>',
        { headers: { 'Content-Type': 'text/html' } },
      )
    })

    // Step 1: Initiate OAuth flow to get a valid state
    let initiateResponse = await router.fetch('https://app.example.com/auth/mock', {
      redirect: 'manual',
    })
    let authUrl = initiateResponse.headers.get('Location')!
    let state = new URL(authUrl).searchParams.get('state')!

    // Step 2: Simulate OAuth provider error during callback
    let errorResponse = await router.fetch(
      `https://app.example.com/auth/mock/callback?error=access_denied&error_description=User+denied+authorization&state=${state}`,
      { redirect: 'manual' },
    )

    assert.equal(errorResponse.status, 302)
    assert.equal(errorResponse.headers.get('Location'), '/login')

    // Step 3: Follow redirect and verify error message is displayed
    let errorSessionCookie = errorResponse.headers.get('Set-Cookie')
    assert.ok(errorSessionCookie, 'Should have session cookie')

    let loginResponse = await router.fetch('https://app.example.com/login', {
      headers: { Cookie: errorSessionCookie },
    })

    let html = await loginResponse.text()
    assert.ok(html.includes('User denied authorization'), 'Should display OAuth error message')
  })
})
