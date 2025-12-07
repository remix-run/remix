import { describe, test } from 'node:test'
import * as assert from 'node:assert/strict'
import { createMockOAuthProvider } from './provider.ts'

describe('createMockOAuthProvider', () => {
  let baseUrl = 'http://localhost:44100/mock-oauth'

  test('creates provider pointing to local handlers', () => {
    let provider = createMockOAuthProvider(baseUrl)

    assert.equal(provider.name, 'mock')
    assert.equal(provider.displayName, 'Mock OAuth')
  })

  test('generates authorization URL', () => {
    let provider = createMockOAuthProvider(baseUrl)

    let url = provider.getAuthorizationUrl({
      clientId: 'test-client',
      redirectUri: 'http://localhost/callback',
      state: 'test-state',
      scopes: ['email', 'profile'],
    })

    let parsed = new URL(url)
    assert.equal(parsed.origin + parsed.pathname, `${baseUrl}/authorize`)
    assert.equal(parsed.searchParams.get('client_id'), 'test-client')
    assert.equal(parsed.searchParams.get('redirect_uri'), 'http://localhost/callback')
    assert.equal(parsed.searchParams.get('state'), 'test-state')
    assert.equal(parsed.searchParams.get('scope'), 'email profile')
  })
})
