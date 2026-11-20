import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { createWebAuthnProvider } from './webauthn.ts'

describe('createWebAuthnProvider()', () => {
  it('normalizes origins and applies defaults', () => {
    let provider = createWebAuthnProvider({
      rpId: 'Example.com',
      rpName: 'Example',
      origin: ['https://example.com/login', new URL('https://app.example.com')],
    })

    assert.deepEqual(provider, {
      name: 'webauthn',
      rpId: 'example.com',
      rpName: 'Example',
      origins: ['https://example.com', 'https://app.example.com'],
      userVerification: 'preferred',
      residentKey: 'preferred',
      timeout: 300000,
      algorithms: [-8, -7, -257],
    })
  })

  it('allows http on localhost', () => {
    let provider = createWebAuthnProvider({
      rpId: 'localhost',
      rpName: 'Dev',
      origin: 'http://localhost:3000',
    })

    assert.deepEqual(provider.origins, ['http://localhost:3000'])
  })

  it('rejects origins outside the rpId', () => {
    assert.throws(
      () =>
        createWebAuthnProvider({
          rpId: 'example.com',
          rpName: 'Example',
          origin: 'https://notexample.com',
        }),
      { message: 'WebAuthn origin "https://notexample.com" is not within rpId "example.com".' },
    )
  })

  it('rejects insecure origins', () => {
    assert.throws(
      () =>
        createWebAuthnProvider({
          rpId: 'example.com',
          rpName: 'Example',
          origin: 'http://example.com',
        }),
      { message: 'WebAuthn origin "http://example.com" must use https (or http on localhost).' },
    )
  })

  it('rejects an rpId that is a URL', () => {
    assert.throws(
      () =>
        createWebAuthnProvider({
          rpId: 'https://example.com',
          rpName: 'Example',
          origin: 'https://example.com',
        }),
      {
        message: 'Invalid WebAuthn rpId "https://example.com". Use a bare host like "example.com".',
      },
    )
  })
})
