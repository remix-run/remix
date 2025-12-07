import * as assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { signJWT, verifyJWT } from './jwt.ts'

describe('JWT signing and verification', () => {
  let secret = 'test-secret-key'

  test('signs and verifies a valid JWT', async () => {
    let payload = { userId: '123', email: 'test@example.com' }
    let token = await signJWT(payload, secret, 3600)

    assert.ok(token)
    assert.equal(token.split('.').length, 3, 'JWT should have 3 parts')

    let decoded = await verifyJWT(token, secret)
    assert.ok(decoded)
    assert.equal(decoded.userId, '123')
    assert.equal(decoded.email, 'test@example.com')
    assert.ok(decoded.iat, 'Should have issued at timestamp')
    assert.ok(decoded.exp, 'Should have expiration timestamp')
  })

  test('adds iat and exp claims automatically', async () => {
    let before = Math.floor(Date.now() / 1000)
    let token = await signJWT({ test: 'data' }, secret, 1800)
    let after = Math.floor(Date.now() / 1000)

    let decoded = await verifyJWT(token, secret)
    assert.ok(decoded)
    assert.ok(decoded.iat >= before && decoded.iat <= after)
    assert.ok(decoded.exp === decoded.iat + 1800)
  })

  test('rejects JWT with invalid signature', async () => {
    let token = await signJWT({ test: 'data' }, secret)

    // Tamper with the signature
    let parts = token.split('.')
    parts[2] = parts[2].slice(0, -1) + 'X'
    let tamperedToken = parts.join('.')

    let decoded = await verifyJWT(tamperedToken, secret)
    assert.equal(decoded, null)
  })

  test('rejects JWT with wrong secret', async () => {
    let token = await signJWT({ test: 'data' }, secret)
    let decoded = await verifyJWT(token, 'wrong-secret')
    assert.equal(decoded, null)
  })

  test('rejects expired JWT', async () => {
    let token = await signJWT({ test: 'data' }, secret, -1) // Already expired
    let decoded = await verifyJWT(token, secret)
    assert.equal(decoded, null)
  })

  test('rejects JWT with tampered payload', async () => {
    let token = await signJWT({ amount: 100 }, secret)

    // Try to change payload
    let parts = token.split('.')
    let payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
    payload.amount = 999999
    parts[1] = btoa(JSON.stringify(payload))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '')
    let tamperedToken = parts.join('.')

    let decoded = await verifyJWT(tamperedToken, secret)
    assert.equal(decoded, null, 'Should reject tampered payload')
  })

  test('rejects malformed JWT', async () => {
    assert.equal(await verifyJWT('not.a.jwt', secret), null)
    assert.equal(await verifyJWT('missing-parts', secret), null)
    assert.equal(await verifyJWT('', secret), null)
    assert.equal(await verifyJWT('a.b', secret), null) // Only 2 parts
    assert.equal(await verifyJWT('a.b.c.d', secret), null) // Too many parts
  })

  test('handles special characters in payload', async () => {
    let payload = {
      name: 'Test User™',
      emoji: '🎉',
      special: '<script>alert("xss")</script>',
    }
    let token = await signJWT(payload, secret)
    let decoded = await verifyJWT(token, secret)

    assert.ok(decoded)
    assert.equal(decoded.name, payload.name)
    assert.equal(decoded.emoji, payload.emoji)
    assert.equal(decoded.special, payload.special)
  })

  test('uses URL-safe base64 encoding', async () => {
    let payload = { data: 'test'.repeat(100) } // Long data to trigger +/= chars in base64
    let token = await signJWT(payload, secret)

    // JWT should not contain +, /, or =
    assert.ok(!token.includes('+'), 'Should not contain +')
    assert.ok(!token.includes('/'), 'Should not contain /')
    assert.ok(!token.includes('='), 'Should not contain =')

    // Should still verify correctly
    let decoded = await verifyJWT(token, secret)
    assert.ok(decoded)
    assert.equal(decoded.data, payload.data)
  })

  test('preserves nested objects', async () => {
    let payload = {
      user: {
        id: '123',
        profile: {
          name: 'Test',
          roles: ['admin', 'user'],
        },
      },
    }
    let token = await signJWT(payload, secret)
    let decoded = await verifyJWT(token, secret)

    assert.ok(decoded)
    assert.deepEqual(decoded.user, payload.user)
  })

  test('works with different expiration times', async () => {
    let shortToken = await signJWT({ test: 'short' }, secret, 1)
    let longToken = await signJWT({ test: 'long' }, secret, 86400)

    let shortDecoded = await verifyJWT<any>(shortToken, secret)
    let longDecoded = await verifyJWT<any>(longToken, secret)

    assert.ok(shortDecoded)
    assert.ok(longDecoded)
    assert.ok(longDecoded.exp - shortDecoded.exp > 86000)
  })

  test('type-safe payload decoding', async () => {
    interface UserPayload {
      userId: string
      email: string
      roles: string[]
    }

    let payload: UserPayload = {
      userId: '123',
      email: 'test@example.com',
      roles: ['user', 'admin'],
    }

    let token = await signJWT(payload, secret)
    let decoded = await verifyJWT<UserPayload>(token, secret)

    assert.ok(decoded)
    // TypeScript should infer correct types
    assert.equal(decoded.userId, '123')
    assert.ok(Array.isArray(decoded.roles))
    assert.equal(decoded.roles.length, 2)
  })

  test('handles null and undefined values', async () => {
    let payload = {
      nullValue: null,
      undefinedValue: undefined,
      emptyString: '',
      zero: 0,
      false: false,
    }

    let token = await signJWT(payload, secret)
    let decoded = await verifyJWT(token, secret)

    assert.ok(decoded)
    assert.equal(decoded.nullValue, null)
    // undefined gets removed during JSON serialization
    assert.equal(decoded.undefinedValue, undefined)
    assert.equal(decoded.emptyString, '')
    assert.equal(decoded.zero, 0)
    assert.equal(decoded.false, false)
  })
})

