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

    let db: MemoryDB = {}

    let authClient = createAuthClient({
      secret: 'test-secret-key',
      authBasePath: '/api/auth',
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
      },
      storage: createMemoryStorageAdapter(db),
    })

    let { auth, getUser } = createAuthMiddleware(authClient)

    // Set up app router - auth middleware handles API routes automatically
    let router = createRouter({
      middleware: [formDataMiddleware(), sessionMiddleware(sessionCookie, sessionStorage), auth],
    })

    router.get('/home', () => {
      let user = getUser()
      return new Response(user ? `Welcome ${user.name}!` : 'Not logged in')
    })

    // Step 1: Initiate OAuth flow via POST form
    let initiateResponse = await router.fetch(
      'https://app.example.com/api/auth/oauth/sign-in/mock',
      {
        method: 'POST',
        body: new URLSearchParams({
          callbackURL: '/home',
          errorCallbackURL: '/login',
        }),
        redirect: 'manual',
      },
    )

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
      authUser: [
        {
          id: 'existing-user-id',
          email: 'existing@example.com',
          name: 'Existing User',
          emailVerified: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      authAccount: [
        {
          userId: 'existing-user-id',
          strategy: 'password',
          passwordHash: 'hashed-password',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      authVerification: [],
    }

    let authClient = createAuthClient({
      secret: 'test-secret-key',
      authBasePath: '/api/auth',
      oauth: {
        enabled: true,
        providers: {
          mock: {
            provider: createTestMockOAuthProvider({
              id: 'mock-oauth-456',
              email: 'existing@example.com', // Same email!
              emailVerified: true, // Must be verified to link to existing account
              name: 'Existing User',
            }),
            clientId: 'test-client-id',
            clientSecret: 'test-client-secret',
          },
        },
      },
      storage: createMemoryStorageAdapter(db),
    })

    let { auth, getUser } = createAuthMiddleware(authClient)

    // Set up app router - auth middleware handles API routes automatically
    let router = createRouter({
      middleware: [formDataMiddleware(), sessionMiddleware(sessionCookie, sessionStorage), auth],
    })

    // Initiate and complete OAuth flow via POST
    let initiateResponse = await router.fetch(
      'https://app.example.com/api/auth/oauth/sign-in/mock',
      {
        method: 'POST',
        body: new URLSearchParams({
          callbackURL: '/home',
          errorCallbackURL: '/login',
        }),
        redirect: 'manual',
      },
    )

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

    let db: MemoryDB = {}

    let authClient = createAuthClient({
      secret: 'test-secret-key',
      authBasePath: '/api/auth',
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
      },
      storage: createMemoryStorageAdapter(db),
    })

    let { auth } = createAuthMiddleware(authClient)

    // Set up app router - auth middleware handles API routes automatically
    let router = createRouter({
      middleware: [formDataMiddleware(), sessionMiddleware(sessionCookie, sessionStorage), auth],
    })

    // Add login route to display errors using structured flash
    router.get('/login', ({ session }) => {
      let flash = authClient.oauth.getFlash(session)
      if (flash?.type === 'error') {
        return new Response(`<html><body>Error: ${flash.code}</body></html>`, {
          headers: { 'Content-Type': 'text/html' },
        })
      }
      return new Response('<html><body>Login page</body></html>', {
        headers: { 'Content-Type': 'text/html' },
      })
    })

    // Step 1: Initiate OAuth flow to get a valid state
    let initiateResponse = await router.fetch(
      'https://app.example.com/api/auth/oauth/sign-in/mock',
      {
        method: 'POST',
        body: new URLSearchParams({
          callbackURL: '/home',
          errorCallbackURL: '/login',
        }),
        redirect: 'manual',
      },
    )
    let authUrl = initiateResponse.headers.get('Location')!
    let state = new URL(authUrl).searchParams.get('state')!

    // Step 2: Simulate OAuth provider error during callback
    let errorResponse = await router.fetch(
      `https://app.example.com/api/auth/oauth/callback/mock?error=access_denied&error_description=User+denied+authorization&state=${state}`,
      { redirect: 'manual' },
    )

    assert.equal(errorResponse.status, 302)
    assert.equal(errorResponse.headers.get('Location'), '/login')

    // Step 3: Follow redirect and verify error code is flashed
    let errorSessionCookie = errorResponse.headers.get('Set-Cookie')
    assert.ok(errorSessionCookie, 'Should have session cookie')

    let loginResponse = await router.fetch('https://app.example.com/login', {
      headers: { Cookie: errorSessionCookie },
    })

    let html = await loginResponse.text()
    assert.ok(html.includes('access_denied'), 'Should display OAuth error code')
  })

  it('blocks account linking when OAuth email is unverified', async () => {
    let sessionCookie = createCookie('session', { secrets: ['secret'] })
    let sessionStorage = createMemorySessionStorage()

    // Pre-existing user created via email/password
    let db: MemoryDB = {
      authUser: [
        {
          id: 'existing-user-789',
          email: 'existing@example.com',
          name: 'Existing User',
          emailVerified: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      authAccount: [
        {
          userId: 'existing-user-789',
          strategy: 'password',
          passwordHash: 'hashed',
        },
      ],
    }

    let authClient = createAuthClient({
      secret: 'test-secret-key',
      authBasePath: '/api/auth',
      oauth: {
        enabled: true,
        providers: {
          mock: {
            provider: createTestMockOAuthProvider({
              id: 'mock-oauth-789',
              email: 'existing@example.com', // Same email as existing user
              emailVerified: false, // Unverified email - should block linking
              name: 'Existing User',
            }),
            clientId: 'test-client-id',
            clientSecret: 'test-client-secret',
          },
        },
      },
      storage: createMemoryStorageAdapter(db),
    })

    let { auth } = createAuthMiddleware(authClient)

    // Set up app router - auth middleware handles API routes automatically
    let router = createRouter({
      middleware: [formDataMiddleware(), sessionMiddleware(sessionCookie, sessionStorage), auth],
    })

    // Add login route to display errors using structured flash
    router.get('/login', ({ session }) => {
      let flash = authClient.oauth.getFlash(session)
      if (flash?.type === 'error') {
        return new Response(`<html><body>Error: ${flash.code}</body></html>`, {
          headers: { 'Content-Type': 'text/html' },
        })
      }
      return new Response('<html><body>Login page</body></html>', {
        headers: { 'Content-Type': 'text/html' },
      })
    })

    // Initiate and complete OAuth flow via POST
    let initiateResponse = await router.fetch(
      'https://app.example.com/api/auth/oauth/sign-in/mock',
      {
        method: 'POST',
        body: new URLSearchParams({
          callbackURL: '/home',
          errorCallbackURL: '/login',
        }),
        redirect: 'manual',
      },
    )

    let authUrl = initiateResponse.headers.get('Location')!
    let authUrlParsed = new URL(authUrl)
    let state = authUrlParsed.searchParams.get('state')
    let redirectUri = authUrlParsed.searchParams.get('redirect_uri')

    let callbackResponse = await router.fetch(
      `${redirectUri}?code=mock_auth_code_789&state=${state}`,
      { redirect: 'manual' },
    )

    // Should redirect to error URL, not success
    assert.equal(callbackResponse.status, 302)
    assert.equal(callbackResponse.headers.get('Location'), '/login')

    // Should show error code about existing account with unverified email
    let errorSessionCookie = callbackResponse.headers.get('Set-Cookie')
    let loginResponse = await router.fetch('https://app.example.com/login', {
      headers: { Cookie: errorSessionCookie! },
    })
    let html = await loginResponse.text()
    assert.ok(
      html.includes('account_exists_unverified_email'),
      'Should display error code about existing account',
    )
  })
})
