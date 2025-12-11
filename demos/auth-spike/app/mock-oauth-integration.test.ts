import * as assert from 'node:assert/strict'
import { describe, it, beforeEach } from 'node:test'
import { router } from './router.ts'
import { setupTest, getSessionCookie, assertContains } from '../test/helpers.ts'
import { createMockOAuthHandlers } from './mock-oauth/handlers.ts'
import { createRouter } from '@remix-run/fetch-router'

describe('Mock OAuth Integration (Full Flow)', () => {
  beforeEach(setupTest)

  it('completes full OAuth flow with mock endpoints', async () => {
    // Intercept fetch calls to route mock OAuth requests through the router
    let originalFetch = globalThis.fetch
    globalThis.fetch = ((url: string | URL | Request, init?: RequestInit) => {
      let urlString = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url
      if (urlString.includes('/mock-oauth/')) {
        // Route through the test router
        return router.fetch(
          urlString.replace('https://app.example.com', 'https://app.example.com'),
          init,
        )
      }
      return originalFetch(url, init)
    }) as typeof fetch

    try {
      // Step 1: Initiate OAuth flow via POST form
      let initiateResponse = await router.fetch(
        'https://app.example.com/api/auth/oauth/sign-in/mock',
        {
          method: 'POST',
          body: new URLSearchParams({
            callbackURL: '/',
            errorCallbackURL: '/login',
          }),
          redirect: 'manual',
        },
      )

      assert.equal(
        initiateResponse.status,
        302,
        'Should redirect from /api/auth/oauth/sign-in/mock',
      )
      let authUrl = initiateResponse.headers.get('Location')
      assert.ok(authUrl, 'Should have Location header')

      // Step 2: Follow redirect to mock OAuth authorize endpoint
      let authUrlParsed = new URL(authUrl!)
      let state = authUrlParsed.searchParams.get('state')

      let authorizeResponse = await router.fetch(authUrl!, {
        redirect: 'manual',
      })

      // Should auto-redirect with code (no UI in test mode)
      assert.equal(authorizeResponse.status, 302, 'Should redirect from authorize endpoint')

      let callbackUrl = authorizeResponse.headers.get('Location')
      assert.ok(callbackUrl, 'Should have callback URL')

      let callbackUrlParsed = new URL(callbackUrl!)
      let code = callbackUrlParsed.searchParams.get('code')
      let returnedState = callbackUrlParsed.searchParams.get('state')

      assert.ok(code, 'Should have authorization code')
      assert.equal(returnedState, state, 'State should match')

      // Step 3: Hit the callback endpoint
      let callbackResponse = await router.fetch(callbackUrl!, {
        redirect: 'manual',
      })

      assert.equal(callbackResponse.status, 302, 'Should redirect after callback')
      assert.equal(callbackResponse.headers.get('Location'), '/', 'Should redirect to home')

      // Step 4: Verify user is logged in
      let sessionId = getSessionCookie(callbackResponse)
      assert.ok(sessionId, 'Should have session cookie')

      let homeResponse = await router.fetch('https://app.example.com/', {
        headers: {
          Cookie: `session=${sessionId}`,
        },
      })

      let html = await homeResponse.text()
      assertContains(html, 'Dev User')
    } finally {
      // Restore original fetch
      globalThis.fetch = originalFetch
    }
  })

  it('handles authorization UI flow with form submission', async () => {
    // Create a separate auth client with showUI enabled to test the form flow
    let mockEndpointsWithUI = createMockOAuthHandlers({
      profile: {
        id: 'ui-test-user',
        email: 'ui-test@example.com',
        name: 'UI Test User',
      },
      showUI: true, // Force UI to be shown
    })

    // Create a test router with formData middleware for the mock OAuth endpoints
    let mockOAuthRouter = createRouter({
      middleware: [(await import('@remix-run/form-data-middleware')).formData()],
    })
    mockOAuthRouter.get('/authorize', mockEndpointsWithUI.authorize.index)
    mockOAuthRouter.post('/authorize', mockEndpointsWithUI.authorize.action)

    // Step 1: GET /authorize - should return HTML form
    let authorizeGetResponse = await mockOAuthRouter.fetch(
      'https://mock-oauth.example.com/authorize?client_id=test&redirect_uri=http://localhost/callback&state=abc123',
    )

    assert.equal(authorizeGetResponse.status, 200, 'Should return HTML form')
    let html = await authorizeGetResponse.text()
    assertContains(html, 'Mock OAuth Authorization')
    assertContains(html, '<form')
    assertContains(html, 'name="action" value="approve"')

    // Step 2: POST /authorize (approve) - should redirect with code
    let authorizePostResponse = await mockOAuthRouter.fetch(
      'https://mock-oauth.example.com/authorize',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          redirect_uri: 'http://localhost/callback',
          state: 'abc123',
          action: 'approve',
          id: 'custom-id-456',
          email: 'custom@example.com',
          name: 'Custom User',
        }).toString(),
        redirect: 'manual',
      },
    )

    assert.equal(authorizePostResponse.status, 302, 'Should redirect after approval')
    let location = authorizePostResponse.headers.get('Location')
    assert.ok(location, 'Should have Location header')

    let locationUrl = new URL(location!)
    assert.equal(locationUrl.origin + locationUrl.pathname, 'http://localhost/callback')
    assert.ok(locationUrl.searchParams.get('code'), 'Should have authorization code')
    assert.equal(locationUrl.searchParams.get('state'), 'abc123', 'Should return state')
  })

  it('handles authorization denial via form', async () => {
    let mockEndpointsWithUI = createMockOAuthHandlers({
      profile: { id: '123', email: 'test@example.com' },
      showUI: true,
    })

    let mockOAuthRouter = createRouter({
      middleware: [(await import('@remix-run/form-data-middleware')).formData()],
    })
    mockOAuthRouter.post('/authorize', mockEndpointsWithUI.authorize.action)

    let authorizePostResponse = await mockOAuthRouter.fetch(
      'https://mock-oauth.example.com/authorize',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          redirect_uri: 'http://localhost/callback',
          state: 'abc123',
          action: 'deny', // User clicks deny
        }).toString(),
        redirect: 'manual',
      },
    )

    assert.equal(authorizePostResponse.status, 302, 'Should redirect after denial')
    let location = authorizePostResponse.headers.get('Location')
    assert.ok(location, 'Should have Location header')

    let locationUrl = new URL(location!)
    assert.equal(locationUrl.searchParams.get('error'), 'access_denied')
    assert.equal(locationUrl.searchParams.get('state'), 'abc123')
  })
})
