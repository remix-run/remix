import { describe, test } from 'node:test'
import * as assert from 'node:assert/strict'
import { createRouter } from '@remix-run/fetch-router'
import { formData } from '@remix-run/form-data-middleware'
import { createMockOAuthHandlers } from './handlers.ts'

let defaultProfile = {
  id: 'test-user',
  email: 'test@example.com',
  name: 'Test User',
}

function setupRouter(mockOAuthHandlers: ReturnType<typeof createMockOAuthHandlers>) {
  let router = createRouter({
    middleware: [formData()],
  })
  router.get('/authorize', mockOAuthHandlers.authorize.index)
  router.post('/authorize', mockOAuthHandlers.authorize.action)
  router.post('/token', mockOAuthHandlers.token)
  router.get('/user', mockOAuthHandlers.user)
  return router
}

describe('createMockOAuthHandlers', () => {
  describe('authorize endpoint', () => {
    test('returns authorization UI in development', async () => {
      let mockOAuthHandlers = createMockOAuthHandlers({
        profile: defaultProfile,
        showUI: true,
      })
      let router = setupRouter(mockOAuthHandlers)

      let response = await router.fetch(
        'https://mock-oauth.example.com/authorize?client_id=test&redirect_uri=http://localhost/callback&state=test-state&scope=email',
      )
      assert.equal(response.status, 200)

      let html = await response.text()
      assert.ok(html.includes('Mock OAuth Authorization'))
      assert.ok(html.includes('test-state'))
    })

    test('auto-approves in test mode', async () => {
      let mockOAuthHandlers = createMockOAuthHandlers({
        profile: defaultProfile,
        showUI: false,
      })
      let router = setupRouter(mockOAuthHandlers)

      let response = await router.fetch(
        'https://mock-oauth.example.com/authorize?client_id=test&redirect_uri=http://localhost/callback&state=test-state&scope=email',
        { redirect: 'manual' },
      )
      assert.equal(response.status, 302)

      let location = response.headers.get('Location')
      assert.ok(location)
      let callbackUrl = new URL(location)
      assert.ok(callbackUrl.searchParams.get('code'))
      assert.equal(callbackUrl.searchParams.get('state'), 'test-state')
    })

    test('handles approval via POST', async () => {
      let mockOAuthHandlers = createMockOAuthHandlers({
        profile: defaultProfile,
        showUI: true,
      })
      let router = setupRouter(mockOAuthHandlers)

      let response = await router.fetch('https://mock-oauth.example.com/authorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          action: 'approve',
          redirect_uri: 'http://localhost/callback',
          state: 'test-state',
          email: 'custom@example.com',
          name: 'Custom User',
        }).toString(),
        redirect: 'manual',
      })
      assert.equal(response.status, 302)

      let location = response.headers.get('Location')
      assert.ok(location)
      let url = new URL(location)
      assert.ok(url.searchParams.get('code'))
      assert.equal(url.searchParams.get('state'), 'test-state')
    })

    test('handles denial', async () => {
      let mockOAuthHandlers = createMockOAuthHandlers({
        profile: defaultProfile,
        showUI: true,
      })
      let router = setupRouter(mockOAuthHandlers)

      let response = await router.fetch('https://mock-oauth.example.com/authorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          action: 'deny',
          redirect_uri: 'http://localhost/callback',
          state: 'test-state',
        }).toString(),
        redirect: 'manual',
      })
      assert.equal(response.status, 302)

      let location = response.headers.get('Location')
      assert.ok(location)
      let url = new URL(location)
      assert.equal(url.searchParams.get('error'), 'access_denied')
      assert.equal(url.searchParams.get('state'), 'test-state')
    })
  })

  describe('token endpoint', () => {
    test('exchanges code for access token', async () => {
      let mockOAuthHandlers = createMockOAuthHandlers({
        profile: defaultProfile,
        showUI: false,
      })
      let router = setupRouter(mockOAuthHandlers)

      // First get an authorization code
      let authResponse = await router.fetch(
        'https://mock-oauth.example.com/authorize?client_id=test&redirect_uri=http://localhost/callback&state=test-state',
        { redirect: 'manual' },
      )
      let location = authResponse.headers.get('Location')!
      let code = new URL(location).searchParams.get('code')!

      // Exchange code for token
      let tokenResponse = await router.fetch('https://mock-oauth.example.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          redirect_uri: 'http://localhost/callback',
        }).toString(),
      })

      assert.equal(tokenResponse.status, 200)

      let data = await tokenResponse.json()
      assert.ok(data.access_token)
      assert.ok(data.refresh_token)
      assert.equal(data.token_type, 'Bearer')
      assert.equal(data.expires_in, 3600)
    })
  })

  describe('user endpoint', () => {
    test('returns user profile for valid token', async () => {
      let mockOAuthHandlers = createMockOAuthHandlers({
        profile: defaultProfile,
        showUI: false,
      })
      let router = setupRouter(mockOAuthHandlers)

      // Get token
      let authResponse = await router.fetch(
        'https://mock-oauth.example.com/authorize?client_id=test&redirect_uri=http://localhost/callback&state=test-state',
        { redirect: 'manual' },
      )
      let location = authResponse.headers.get('Location')!
      let code = new URL(location).searchParams.get('code')!

      let tokenResponse = await router.fetch('https://mock-oauth.example.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          redirect_uri: 'http://localhost/callback',
        }).toString(),
      })
      let tokenData = await tokenResponse.json()

      // Get user profile
      let userResponse = await router.fetch('https://mock-oauth.example.com/user', {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
        },
      })

      assert.equal(userResponse.status, 200)

      let user = await userResponse.json()
      assert.equal(user.id, defaultProfile.id)
      assert.equal(user.email, defaultProfile.email)
      assert.equal(user.name, defaultProfile.name)
    })
  })

  describe('error simulation', () => {
    test('can simulate authorization denial', async () => {
      let mockOAuthHandlers = createMockOAuthHandlers({
        profile: defaultProfile,
        showUI: false,
        denyAuthorization: true,
      })
      let router = setupRouter(mockOAuthHandlers)

      let response = await router.fetch(
        'https://mock-oauth.example.com/authorize?client_id=test&redirect_uri=http://localhost/callback&state=test-state',
        { redirect: 'manual' },
      )
      assert.equal(response.status, 302)

      let location = response.headers.get('Location')
      assert.ok(location)
      let callbackUrl = new URL(location)
      assert.equal(callbackUrl.searchParams.get('error'), 'access_denied')
      assert.equal(callbackUrl.searchParams.get('state'), 'test-state')
    })

    test('can simulate custom authorization error', async () => {
      let mockOAuthHandlers = createMockOAuthHandlers({
        profile: defaultProfile,
        showUI: false,
        authorizationError: {
          error: 'server_error',
          error_description: 'Something went wrong',
        },
      })
      let router = setupRouter(mockOAuthHandlers)

      let response = await router.fetch(
        'https://mock-oauth.example.com/authorize?client_id=test&redirect_uri=http://localhost/callback&state=test-state',
        { redirect: 'manual' },
      )
      assert.equal(response.status, 302)

      let location = response.headers.get('Location')
      assert.ok(location)
      let callbackUrl = new URL(location)
      assert.equal(callbackUrl.searchParams.get('error'), 'server_error')
      assert.equal(callbackUrl.searchParams.get('error_description'), 'Something went wrong')
      assert.equal(callbackUrl.searchParams.get('state'), 'test-state')
    })

    test('can simulate token exchange error', async () => {
      let mockOAuthHandlers = createMockOAuthHandlers({
        profile: defaultProfile,
        showUI: false,
        tokenError: {
          error: 'invalid_client',
          error_description: 'Client authentication failed',
        },
      })
      let router = setupRouter(mockOAuthHandlers)

      // Get authorization code first
      let authResponse = await router.fetch(
        'https://mock-oauth.example.com/authorize?client_id=test&redirect_uri=http://localhost/callback&state=test-state',
        { redirect: 'manual' },
      )
      let location = authResponse.headers.get('Location')!
      let code = new URL(location).searchParams.get('code')!

      // Try to exchange code for token
      let tokenResponse = await router.fetch('https://mock-oauth.example.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          redirect_uri: 'http://localhost/callback',
        }).toString(),
      })

      assert.equal(tokenResponse.status, 400)

      let data = await tokenResponse.json()
      assert.equal(data.error, 'invalid_client')
      assert.equal(data.error_description, 'Client authentication failed')
    })
  })
})
