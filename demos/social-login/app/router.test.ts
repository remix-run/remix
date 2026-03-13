import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createRequest, createTestRouter, getSessionId, mockFetch } from '../router-helpers.ts'

describe('social login demo router', () => {
  it('renders the logged-out home page with password and social login options', async () => {
    let { router } = createTestRouter()

    let response = await router.fetch('https://demo.example.com/')
    let html = await response.text()

    assert.equal(response.status, 200)
    assert.match(html, /Remix Auth Demo/)
    assert.match(html, /Login to your account/)
    assert.match(html, />Login<\/button>/)
    assert.match(html, /Login with Google/)
    assert.match(html, /Login with GitHub/)
    assert.match(html, /Login with X/)
    assert.match(html, /demo@example.com/)
    assert.match(html, /\.env\.example/)
    assert.match(html, /GOOGLE_CLIENT_ID/)
    assert.match(html, /Create a GitHub OAuth app/)
    assert.match(html, /\/auth\/x\/callback/)
    assert.doesNotMatch(html, /Log out/)
  })

  it('signs in with the seeded email and password account', async () => {
    let { router } = createTestRouter()

    let loginResponse = await router.fetch(
      createRequest('https://demo.example.com/login', undefined, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          email: 'demo@example.com',
          password: 'password123',
        }).toString(),
      }),
    )
    let homeResponse = await router.fetch(createRequest('https://demo.example.com/', loginResponse))
    let html = await homeResponse.text()

    assert.equal(loginResponse.status, 302)
    assert.equal(loginResponse.headers.get('Location'), '/')
    assert.match(html, /Demo User/)
    assert.match(html, /Signed in with Email and password/)
    assert.match(html, /resolved auth profile/)
    assert.match(html, /demo@example.com/)
  })

  it('redirects to Google when the Google login button is used', async () => {
    let { router } = createTestRouter()

    let response = await router.fetch('https://demo.example.com/auth/google/login')
    let location = new URL(response.headers.get('Location')!)

    assert.equal(response.status, 302)
    assert.equal(location.origin, 'https://accounts.google.com')
    assert.equal(location.pathname, '/o/oauth2/v2/auth')
    assert.equal(location.searchParams.get('client_id'), 'google-client-id')
  })

  it('completes the Google login flow and shows the resolved user', async () => {
    let restoreFetch = mockFetch(async input => {
      let url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url

      if (url === 'https://oauth2.googleapis.com/token') {
        return Response.json({
          access_token: 'google-token',
          token_type: 'Bearer',
          scope: 'openid email profile',
        })
      }

      if (url === 'https://openidconnect.googleapis.com/v1/userinfo') {
        return Response.json({
          sub: 'google-user-1',
          name: 'Google Person',
          email: 'google@example.com',
          picture: 'https://example.com/google-avatar.png',
        })
      }

      throw new Error(`Unexpected fetch: ${url}`)
    })

    try {
      let { router } = createTestRouter()
      let loginResponse = await router.fetch('https://demo.example.com/auth/google/login')
      let state = new URL(loginResponse.headers.get('Location')!).searchParams.get('state')
      let callbackResponse = await router.fetch(
        createRequest(
          `https://demo.example.com/auth/google/callback?code=google-code&state=${state}`,
          loginResponse,
        ),
      )
      let homeResponse = await router.fetch(createRequest('https://demo.example.com/', callbackResponse))
      let html = await homeResponse.text()

      assert.equal(callbackResponse.status, 302)
      assert.equal(callbackResponse.headers.get('Location'), '/')
      assert.match(html, /Google Person/)
      assert.match(html, /Signed in with Google/)
      assert.match(html, /resolved auth profile/)
      assert.match(html, /google@example\.com/)
      assert.match(html, /https:\/\/example\.com\/google-avatar\.png/)
    } finally {
      restoreFetch()
    }
  })

  it('completes the GitHub login flow and shows the resolved user', async () => {
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
          id: 42,
          login: 'octocat',
          name: 'GitHub Person',
          email: 'github@example.com',
          avatar_url: 'https://example.com/github-avatar.png',
        })
      }

      throw new Error(`Unexpected fetch: ${url}`)
    })

    try {
      let { router } = createTestRouter()
      let loginResponse = await router.fetch('https://demo.example.com/auth/github/login')
      let state = new URL(loginResponse.headers.get('Location')!).searchParams.get('state')
      let callbackResponse = await router.fetch(
        createRequest(
          `https://demo.example.com/auth/github/callback?code=github-code&state=${state}`,
          loginResponse,
        ),
      )
      let homeResponse = await router.fetch(createRequest('https://demo.example.com/', callbackResponse))
      let html = await homeResponse.text()

      assert.equal(callbackResponse.status, 302)
      assert.equal(callbackResponse.headers.get('Location'), '/')
      assert.match(html, /GitHub Person/)
      assert.match(html, /Signed in with GitHub/)
      assert.match(html, /resolved auth profile/)
      assert.match(html, /github@example\.com/)
      assert.match(html, /https:\/\/example\.com\/github-avatar\.png/)
    } finally {
      restoreFetch()
    }
  })

  it('completes the X login flow and shows the resolved user', async () => {
    let restoreFetch = mockFetch(async input => {
      let url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url

      if (url === 'https://api.x.com/2/oauth2/token') {
        return Response.json({
          access_token: 'x-token',
          token_type: 'bearer',
          scope: 'tweet.read users.read',
        })
      }

      if (
        url ===
        'https://api.x.com/2/users/me?user.fields=profile_image_url,verified,description,url'
      ) {
        return Response.json({
          data: {
            id: 'x_7',
            name: 'X Person',
            username: 'xperson',
            profile_image_url: 'https://example.com/x-avatar.png',
          },
        })
      }

      throw new Error(`Unexpected fetch: ${url}`)
    })

    try {
      let { router } = createTestRouter()
      let loginResponse = await router.fetch('https://demo.example.com/auth/x/login')
      let state = new URL(loginResponse.headers.get('Location')!).searchParams.get('state')
      let callbackResponse = await router.fetch(
        createRequest(
          `https://demo.example.com/auth/x/callback?code=x-code&state=${state}`,
          loginResponse,
        ),
      )
      let homeResponse = await router.fetch(createRequest('https://demo.example.com/', callbackResponse))
      let html = await homeResponse.text()

      assert.equal(callbackResponse.status, 302)
      assert.equal(callbackResponse.headers.get('Location'), '/')
      assert.match(html, /X Person/)
      assert.match(html, /Signed in with X/)
      assert.match(html, /resolved auth profile/)
      assert.match(html, /"loginMethod": "x"/)
      assert.match(html, /https:\/\/example\.com\/x-avatar\.png/)
    } finally {
      restoreFetch()
    }
  })

  it('logs out and rotates the session id', async () => {
    let restoreFetch = mockFetch(async input => {
      let url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url

      if (url === 'https://oauth2.googleapis.com/token') {
        return Response.json({
          access_token: 'google-token',
          token_type: 'Bearer',
          scope: 'openid email profile',
        })
      }

      if (url === 'https://openidconnect.googleapis.com/v1/userinfo') {
        return Response.json({
          sub: 'google-user-logout',
          name: 'Logout Person',
          email: 'logout@example.com',
        })
      }

      throw new Error(`Unexpected fetch: ${url}`)
    })

    try {
      let { router } = createTestRouter()
      let loginResponse = await router.fetch('https://demo.example.com/auth/google/login')
      let state = new URL(loginResponse.headers.get('Location')!).searchParams.get('state')
      let callbackResponse = await router.fetch(
        createRequest(
          `https://demo.example.com/auth/google/callback?code=google-code&state=${state}`,
          loginResponse,
        ),
      )
      let authenticatedSessionId = getSessionId(callbackResponse)
      let logoutResponse = await router.fetch(
        createRequest('https://demo.example.com/logout', callbackResponse, { method: 'POST' }),
      )
      let loggedOutSessionId = getSessionId(logoutResponse)
      let homeResponse = await router.fetch(createRequest('https://demo.example.com/', logoutResponse))
      let html = await homeResponse.text()

      assert.equal(logoutResponse.status, 302)
      assert.equal(logoutResponse.headers.get('Location'), '/')
      assert.notEqual(authenticatedSessionId, null)
      assert.notEqual(loggedOutSessionId, null)
      assert.notEqual(loggedOutSessionId, authenticatedSessionId)
      assert.doesNotMatch(html, /Logout Person/)
      assert.match(html, /Login to your account/)
    } finally {
      restoreFetch()
    }
  })
})
