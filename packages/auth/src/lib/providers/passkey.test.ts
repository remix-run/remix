import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { createMemoryPasskeyChallengeStore } from '../memory-passkey-challenge-store.ts'
import { createPasskeyAuthProvider } from './passkey.ts'
import type { PasskeyAuthProviderOptions } from './passkey.ts'

function createOptions(
  overrides: Partial<PasskeyAuthProviderOptions> = {},
): PasskeyAuthProviderOptions {
  return {
    rpId: 'example.com',
    rpName: 'Example',
    origin: 'https://example.com',
    challengeStore: createMemoryPasskeyChallengeStore(),
    findCredential: () => null,
    ...overrides,
  }
}

describe('createPasskeyAuthProvider()', () => {
  it('normalizes defaults', () => {
    let provider = createPasskeyAuthProvider(createOptions())

    assert.equal(provider.name, 'passkey')
    assert.equal(provider.rpId, 'example.com')
    assert.deepEqual(provider.origins, ['https://example.com'])
    assert.equal(provider.userVerification, 'preferred')
    assert.equal(provider.timeout, 300_000)
  })

  it('accepts subdomain origins and local development origins', () => {
    let provider = createPasskeyAuthProvider(
      createOptions({ origin: ['https://example.com', 'https://app.example.com'] }),
    )
    let localProvider = createPasskeyAuthProvider(
      createOptions({ rpId: 'localhost', origin: 'http://localhost:44100' }),
    )

    assert.deepEqual(provider.origins, ['https://example.com', 'https://app.example.com'])
    assert.deepEqual(localProvider.origins, ['http://localhost:44100'])
  })

  it('rejects relying party IDs that are not bare lowercase domains', () => {
    assert.throws(
      () => createPasskeyAuthProvider(createOptions({ rpId: '' })),
      /Invalid passkey rpId/,
    )
    assert.throws(
      () => createPasskeyAuthProvider(createOptions({ rpId: 'https://example.com' })),
      /Invalid passkey rpId/,
    )
    assert.throws(
      () => createPasskeyAuthProvider(createOptions({ rpId: 'example.com:443' })),
      /Invalid passkey rpId/,
    )
    assert.throws(
      () => createPasskeyAuthProvider(createOptions({ rpId: 'Example.com' })),
      /Invalid passkey rpId/,
    )
  })

  it('rejects IP address relying party IDs', () => {
    assert.throws(
      () =>
        createPasskeyAuthProvider(
          createOptions({ rpId: '127.0.0.1', origin: 'http://127.0.0.1:44100' }),
        ),
      /use "localhost" during development/,
    )
    assert.throws(
      () =>
        createPasskeyAuthProvider(createOptions({ rpId: '[::1]', origin: 'http://[::1]:44100' })),
      /use "localhost" during development/,
    )
  })

  it('rejects origins that are not exact origins', () => {
    assert.throws(
      () => createPasskeyAuthProvider(createOptions({ origin: 'https://example.com/login' })),
      /Invalid passkey origin/,
    )
    assert.throws(
      () => createPasskeyAuthProvider(createOptions({ origin: 'https://example.com/' })),
      /Invalid passkey origin/,
    )
    assert.throws(
      () => createPasskeyAuthProvider(createOptions({ origin: [] })),
      /at least one origin/,
    )
  })

  it('rejects origins outside the relying party ID', () => {
    assert.throws(
      () => createPasskeyAuthProvider(createOptions({ origin: 'https://example.org' })),
      /not within rpId/,
    )
    assert.throws(
      () => createPasskeyAuthProvider(createOptions({ origin: 'https://notexample.com' })),
      /not within rpId/,
    )
  })

  it('rejects invalid policies, timeouts, and missing hooks', () => {
    assert.throws(
      () => createPasskeyAuthProvider(createOptions({ userVerification: 'always' as never })),
      /Invalid passkey userVerification/,
    )
    assert.throws(() => createPasskeyAuthProvider(createOptions({ timeout: 0 })), /timeout/)
    assert.throws(() => createPasskeyAuthProvider(createOptions({ rpName: ' ' })), /rpName/)
    assert.throws(
      () => createPasskeyAuthProvider(createOptions({ challengeStore: undefined as never })),
      /challengeStore/,
    )
    assert.throws(
      () => createPasskeyAuthProvider(createOptions({ findCredential: undefined as never })),
      /findCredential/,
    )
  })
})
