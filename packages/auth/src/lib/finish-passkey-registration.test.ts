import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { createCookieSessionStorage } from '@remix-run/session/cookie-storage'

import type { PasskeyRegistrationResult } from './finish-passkey-registration.ts'
import type { PasskeyErrorCode } from './passkey/errors.ts'
import { createTestAuthenticator } from './passkey/test-authenticator.ts'
import type { CborEncodable } from './passkey/test-authenticator.ts'
import { createPasskeyTestApp } from './passkey/test-app.ts'

function assertFailure(result: PasskeyRegistrationResult, code: PasskeyErrorCode): void {
  assert.equal(result.ok, false)
  assert.equal(result.ok ? undefined : result.error.code, code)
}

describe('finishPasskeyRegistration()', () => {
  it('verifies a registration and returns the credential to persist', async () => {
    let app = createPasskeyTestApp()
    let authenticator = await createTestAuthenticator()
    let response = await authenticator.register(await app.startRegistration())

    let result = await app.finishRegistration(response)

    assert.ok(result.ok)
    assert.deepEqual(result.credential, {
      id: authenticator.credentialId,
      userId: 'user-1',
      publicKey: result.credential.publicKey,
      counter: 0,
      transports: ['internal', 'hybrid'],
      backupEligible: true,
      backedUp: true,
      aaguid: '00000000-0000-0000-0000-000000000000',
    })
    assert.equal(typeof result.credential.publicKey, 'string')
  })

  it('verifies EdDSA credentials', async () => {
    let app = createPasskeyTestApp()
    let authenticator = await createTestAuthenticator({ algorithm: 'EdDSA' })

    let result = await app.finishRegistration(
      await authenticator.register(await app.startRegistration()),
    )

    assert.equal(result.ok, true)
  })

  it('verifies RS256 credentials', async () => {
    let app = createPasskeyTestApp()
    let authenticator = await createTestAuthenticator({ algorithm: 'RS256' })

    let result = await app.finishRegistration(
      await authenticator.register(await app.startRegistration()),
    )

    assert.equal(result.ok, true)
  })

  it('reports device-bound credentials', async () => {
    let app = createPasskeyTestApp()
    let authenticator = await createTestAuthenticator({
      flags: { backupEligible: false, backedUp: false },
    })

    let result = await app.finishRegistration(
      await authenticator.register(await app.startRegistration()),
    )

    assert.ok(result.ok)
    assert.equal(result.credential.backupEligible, false)
    assert.equal(result.credential.backedUp, false)
  })

  it('keeps only transports defined by WebAuthn', async () => {
    let app = createPasskeyTestApp()
    let authenticator = await createTestAuthenticator()
    let response = await authenticator.register(await app.startRegistration())

    let result = await app.finishRegistration({
      ...response,
      response: { ...response.response, transports: ['usb', 'carrier-pigeon', 'usb', 42] },
    })

    assert.ok(result.ok)
    assert.deepEqual(result.credential.transports, ['usb'])
  })

  it('accepts the response as a JSON string', async () => {
    let app = createPasskeyTestApp()
    let authenticator = await createTestAuthenticator()
    let response = await authenticator.register(await app.startRegistration())

    let result = await app.finishRegistration(JSON.stringify(response))

    assert.equal(result.ok, true)
  })

  it('accepts attestation formats without verifying attestation statements', async () => {
    let app = createPasskeyTestApp()
    let authenticator = await createTestAuthenticator()
    let response = await authenticator.register(await app.startRegistration(), {
      attestationFormat: 'packed',
    })

    let result = await app.finishRegistration(response)

    assert.equal(result.ok, true)
  })

  it('clears the pending challenge from the session', async () => {
    let app = createPasskeyTestApp()
    let authenticator = await createTestAuthenticator()
    await app.finishRegistration(await authenticator.register(await app.startRegistration()))

    let session = await app.readSession()

    assert.equal(session.__passkey, undefined)
  })

  it('verifies a registration while a sign-in is also pending', async () => {
    let app = createPasskeyTestApp()
    let authenticator = await createTestAuthenticator()
    let registrationOptions = await app.startRegistration()
    await app.startAuthentication()

    let result = await app.finishRegistration(await authenticator.register(registrationOptions))

    assert.equal(result.ok, true)
  })

  it('rejects responses when no registration was started', async () => {
    let app = createPasskeyTestApp()
    let authenticator = await createTestAuthenticator()
    let response = await authenticator.register(await createPasskeyTestApp().startRegistration())

    assertFailure(await app.finishRegistration(response), 'challenge_missing')
  })

  it('rejects challenges issued for sign-in', async () => {
    let app = createPasskeyTestApp()
    let authenticator = await createTestAuthenticator()
    let registrationOptions = await createPasskeyTestApp().startRegistration()
    let { challenge } = await app.startAuthentication()

    let result = await app.finishRegistration(
      await authenticator.register({ ...registrationOptions, challenge }),
    )

    assertFailure(result, 'challenge_missing')
  })

  it('rejects expired challenges', async (t) => {
    let now = Date.now()
    t.mock.method(Date, 'now', () => now)
    let app = createPasskeyTestApp({ timeout: 60_000 })
    let authenticator = await createTestAuthenticator()
    let response = await authenticator.register(await app.startRegistration())

    now += 60_000

    assertFailure(await app.finishRegistration(response), 'challenge_expired')
  })

  it('rejects responses signed for a challenge this session did not issue', async () => {
    let app = createPasskeyTestApp()
    let authenticator = await createTestAuthenticator()
    let response = await authenticator.register(await app.startRegistration(), {
      challenge: 'b3RoZXItY2hhbGxlbmdl',
    })

    assertFailure(await app.finishRegistration(response), 'challenge_missing')
  })

  it('rejects a challenge after it has been used', async () => {
    let app = createPasskeyTestApp()
    let authenticator = await createTestAuthenticator()
    let response = await authenticator.register(await app.startRegistration())

    assert.equal((await app.finishRegistration(response)).ok, true)
    assertFailure(await app.finishRegistration(response), 'challenge_missing')
  })

  it('rejects replays that reuse an earlier cookie session', async () => {
    let app = createPasskeyTestApp({ sessionStorage: createCookieSessionStorage() })
    let authenticator = await createTestAuthenticator()
    let response = await authenticator.register(await app.startRegistration())
    let cookieWithChallenge = app.sessionCookie

    assert.equal((await app.finishRegistration(response)).ok, true)

    app.sessionCookie = cookieWithChallenge
    assertFailure(await app.finishRegistration(response), 'challenge_consumed')
  })

  it('accepts only one of several concurrent redemptions', async () => {
    let app = createPasskeyTestApp({ sessionStorage: createCookieSessionStorage() })
    let authenticator = await createTestAuthenticator()
    let response = await authenticator.register(await app.startRegistration())

    let results = await Promise.all([
      app.finishRegistration(response),
      app.finishRegistration(response),
      app.finishRegistration(response),
    ])

    assert.deepEqual(results.map((result) => (result.ok ? 'ok' : result.error.code)).sort(), [
      'challenge_consumed',
      'challenge_consumed',
      'ok',
    ])
  })

  it('rejects responses from an unexpected origin', async () => {
    let app = createPasskeyTestApp()
    let authenticator = await createTestAuthenticator({ origin: 'https://evil.example' })
    let response = await authenticator.register(await app.startRegistration())

    assertFailure(await app.finishRegistration(response), 'origin_mismatch')
  })

  it('rejects responses created in cross-origin frames', async () => {
    let app = createPasskeyTestApp()
    let authenticator = await createTestAuthenticator()
    let response = await authenticator.register(await app.startRegistration(), {
      crossOrigin: true,
    })

    assertFailure(await app.finishRegistration(response), 'origin_mismatch')
  })

  it('rejects credentials scoped to another relying party', async () => {
    let app = createPasskeyTestApp()
    let authenticator = await createTestAuthenticator()
    let response = await authenticator.register(await app.startRegistration(), {
      rpId: 'evil.example',
    })

    assertFailure(await app.finishRegistration(response), 'rp_id_mismatch')
  })

  it('rejects responses without user presence', async () => {
    let app = createPasskeyTestApp()
    let authenticator = await createTestAuthenticator()
    let response = await authenticator.register(await app.startRegistration(), {
      flags: { userPresent: false },
    })

    assertFailure(await app.finishRegistration(response), 'user_not_present')
  })

  it('rejects unverified users when user verification is required', async () => {
    let app = createPasskeyTestApp({ userVerification: 'required' })
    let authenticator = await createTestAuthenticator({ flags: { userVerified: false } })
    let response = await authenticator.register(await app.startRegistration())

    assertFailure(await app.finishRegistration(response), 'user_not_verified')
  })

  it('allows unverified users when user verification is preferred', async () => {
    let app = createPasskeyTestApp()
    let authenticator = await createTestAuthenticator({ flags: { userVerified: false } })
    let response = await authenticator.register(await app.startRegistration())

    assert.equal((await app.finishRegistration(response)).ok, true)
  })

  it('rejects sign-in client data', async () => {
    let app = createPasskeyTestApp()
    let authenticator = await createTestAuthenticator()
    let response = await authenticator.register(await app.startRegistration(), {
      type: 'webauthn.get',
    })

    assertFailure(await app.finishRegistration(response), 'invalid_response')
  })

  it('rejects malformed responses', async () => {
    let app = createPasskeyTestApp()

    await app.startRegistration()
    assertFailure(await app.finishRegistration('{not json'), 'invalid_response')
    await app.startRegistration()
    assertFailure(await app.finishRegistration({ type: 'public-key' }), 'invalid_response')
    await app.startRegistration()
    assertFailure(await app.finishRegistration(null), 'invalid_response')
  })

  it('rejects responses whose id and rawId differ', async () => {
    let app = createPasskeyTestApp()
    let authenticator = await createTestAuthenticator()
    let response = await authenticator.register(await app.startRegistration())

    let result = await app.finishRegistration({ ...response, rawId: 'b3RoZXI' })

    assertFailure(result, 'invalid_response')
  })

  it('rejects responses whose credential ID differs from the authenticator data', async () => {
    let app = createPasskeyTestApp()
    let authenticator = await createTestAuthenticator()
    let response = await authenticator.register(await app.startRegistration(), {
      authenticatorDataCredentialId: new Uint8Array(32).fill(7),
    })

    assertFailure(await app.finishRegistration(response), 'invalid_response')
  })

  it('rejects backup state without backup eligibility', async () => {
    let app = createPasskeyTestApp()
    let authenticator = await createTestAuthenticator()
    let response = await authenticator.register(await app.startRegistration(), {
      flags: { backupEligible: false, backedUp: true },
    })

    assertFailure(await app.finishRegistration(response), 'invalid_response')
  })

  it('rejects credential algorithms the server did not offer', async () => {
    let app = createPasskeyTestApp()
    let authenticator = await createTestAuthenticator()
    let response = await authenticator.register(await app.startRegistration(), {
      coseKey: new Map<number, CborEncodable>([
        [1, 2],
        [3, -35],
        [-1, 2],
        [-2, new Uint8Array(48)],
        [-3, new Uint8Array(48)],
      ]),
    })

    assertFailure(await app.finishRegistration(response), 'unsupported_algorithm')
  })

  it('rejects public keys that are not valid curve points', async () => {
    let app = createPasskeyTestApp()
    let authenticator = await createTestAuthenticator()
    let response = await authenticator.register(await app.startRegistration(), {
      coseKey: new Map<number, CborEncodable>([
        [1, 2],
        [3, -7],
        [-1, 1],
        [-2, new Uint8Array(32).fill(1)],
        [-3, new Uint8Array(32).fill(2)],
      ]),
    })

    assertFailure(await app.finishRegistration(response), 'invalid_response')
  })

  it('rejects credentials that are already registered', async () => {
    let app = createPasskeyTestApp()
    let authenticator = await createTestAuthenticator()
    let first = await app.finishRegistration(
      await authenticator.register(await app.startRegistration()),
    )
    assert.ok(first.ok)
    app.credentials.set(first.credential.id, first.credential)

    let result = await app.finishRegistration(
      await authenticator.register(await app.startRegistration()),
    )

    assertFailure(result, 'credential_exists')
  })

  it('rejects challenges started for a different account', async () => {
    let app = createPasskeyTestApp()
    let authenticator = await createTestAuthenticator()
    let response = await authenticator.register(await app.startRegistration())

    let result = await app.finishRegistration(response, { userId: 'user-2' })

    assertFailure(result, 'user_mismatch')
  })

  it('accepts challenges started for the expected account', async () => {
    let app = createPasskeyTestApp()
    let authenticator = await createTestAuthenticator()
    let response = await authenticator.register(await app.startRegistration())

    let result = await app.finishRegistration(response, { userId: 'user-1' })

    assert.equal(result.ok, true)
  })
})
