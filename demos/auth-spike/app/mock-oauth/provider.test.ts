import { describe, test } from 'node:test'
import * as assert from 'node:assert/strict'
import { createMockOAuthProvider } from './provider.ts'

describe('createMockOAuthProvider', () => {
  let baseUrl = 'http://localhost:44100/mock-oauth'

  test('creates provider config with defaults', () => {
    let config = createMockOAuthProvider({ baseUrl })

    assert.equal(config.provider.name, 'mock')
    assert.equal(config.provider.displayName, 'Mock OAuth')
    assert.equal(config.clientId, 'mock-client-id')
    assert.equal(config.clientSecret, 'mock-client-secret')
    assert.deepEqual(config.scopes, [])
  })

  test('accepts custom clientId and clientSecret', () => {
    let config = createMockOAuthProvider({
      baseUrl,
      clientId: 'custom-id',
      clientSecret: 'custom-secret',
    })

    assert.equal(config.clientId, 'custom-id')
    assert.equal(config.clientSecret, 'custom-secret')
  })

  test('generates authorization URL', () => {
    let config = createMockOAuthProvider({ baseUrl })

    let url = config.provider.getAuthorizationUrl({
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
