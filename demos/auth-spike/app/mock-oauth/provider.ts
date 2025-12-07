import type { OAuthProvider } from '@remix-run/auth'

/**
 * Create a mock OAuth provider for local development and testing.
 *
 * This provider points to local mock OAuth handlers that serve an
 * interactive authorization UI in development mode.
 *
 * User profiles are configured via the mock OAuth handlers, not here.
 */
export function createMockOAuthProvider(baseUrl: string): OAuthProvider {
  return {
    name: 'mock',
    displayName: 'Mock OAuth',

    getAuthorizationUrl({ clientId, redirectUri, state, scopes = [] }) {
      let url = new URL(`${baseUrl}/authorize`)
      url.searchParams.set('client_id', clientId)
      url.searchParams.set('redirect_uri', redirectUri)
      url.searchParams.set('state', state)
      url.searchParams.set('scope', scopes.join(' '))
      return url.toString()
    },

    async exchangeCodeForToken({ code }) {
      let response = await fetch(`${baseUrl}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          redirect_uri: 'not-needed-for-mock',
        }).toString(),
      })

      if (!response.ok) {
        let error = await response.json()
        throw new Error(error.error_description || error.error)
      }

      let data = await response.json()
      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in,
      }
    },

    async getUserProfile(accessToken) {
      let response = await fetch(`${baseUrl}/user`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      if (!response.ok) {
        let error = await response.json()
        throw new Error(error.error_description || error.error)
      }

      return await response.json()
    },
  }
}

/**
 * Create a mock OAuth provider for unit tests that returns static profiles
 * without requiring HTTP calls.
 *
 * This is a test-only helper - use createMockOAuthProvider() for the actual
 * demo app which connects to real mock OAuth handlers.
 */
export function createTestMockOAuthProvider(profile: {
  id: string
  email: string
  name?: string
  avatarUrl?: string
}): OAuthProvider {
  return {
    name: 'mock',
    displayName: 'Mock OAuth',

    getAuthorizationUrl({ clientId, redirectUri, state, scopes = [] }) {
      let url = new URL('https://mock-oauth.example.com/authorize')
      url.searchParams.set('client_id', clientId)
      url.searchParams.set('redirect_uri', redirectUri)
      url.searchParams.set('state', state)
      url.searchParams.set('scope', scopes.join(' '))
      return url.toString()
    },

    async exchangeCodeForToken({ code }) {
      return {
        accessToken: `mock_access_token_${code}`,
        refreshToken: `mock_refresh_token_${code}`,
        expiresIn: 3600,
      }
    },

    async getUserProfile() {
      return profile
    },
  }
}
