import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { createCookieSessionStorage } from '@remix-run/session/cookie-storage'

import type { PasskeyAuthenticationResult } from './finish-passkey-authentication.ts'
import type { PasskeyErrorCode } from './passkey/errors.ts'
import { createTestAuthenticator } from './passkey/test-authenticator.ts'
import type { TestAuthenticator, TestAuthenticatorOptions } from './passkey/test-authenticator.ts'
import { createPasskeyTestApp } from './passkey/test-app.ts'
import type { PasskeyTestApp, PasskeyTestAppOptions } from './passkey/test-app.ts'
import type { PasskeyCredential } from './providers/passkey.ts'

interface RegisteredPasskey {
  app: PasskeyTestApp
  authenticator: TestAuthenticator
  credential: PasskeyCredential
}

async function setup(
  appOptions: PasskeyTestAppOptions = {},
  authenticatorOptions: TestAuthenticatorOptions = {},
): Promise<RegisteredPasskey> {
  let app = createPasskeyTestApp(appOptions)
  let authenticator = await createTestAuthenticator(authenticatorOptions)
  let result = await app.finishRegistration(
    await authenticator.register(await app.startRegistration()),
  )
  assert.ok(result.ok)
  app.credentials.set(result.credential.id, result.credential)

  return { app, authenticator, credential: result.credential }
}

function assertFailure(result: PasskeyAuthenticationResult, code: PasskeyErrorCode): void {
  assert.equal(result.ok, false)
  assert.equal(result.ok ? undefined : result.error.code, code)
}

describe('finishPasskeyAuthentication()', () => {
  it('verifies a sign-in and returns the credential with its latest state', async () => {
    let { app, authenticator, credential } = await setup()
    let response = await authenticator.authenticate(await app.startAuthentication())

    let result = await app.finishAuthentication(response)

    assert.ok(result.ok)
    assert.deepEqual(result.credential, credential)
    assert.equal(result.credential.userId, 'user-1')
  })

  it('verifies EdDSA signatures', async () => {
    let { app, authenticator } = await setup({}, { algorithm: 'EdDSA' })

    let result = await app.finishAuthentication(
      await authenticator.authenticate(await app.startAuthentication()),
    )

    assert.equal(result.ok, true)
  })

  it('verifies RS256 signatures', async () => {
    let { app, authenticator } = await setup({}, { algorithm: 'RS256' })

    let result = await app.finishAuthentication(
      await authenticator.authenticate(await app.startAuthentication()),
    )

    assert.equal(result.ok, true)
  })

  it('accepts the response as a JSON string', async () => {
    let { app, authenticator } = await setup()
    let response = await authenticator.authenticate(await app.startAuthentication())

    let result = await app.finishAuthentication(JSON.stringify(response))

    assert.equal(result.ok, true)
  })

  it('advances the signature counter for authenticators that count sign-ins', async () => {
    let { app, authenticator } = await setup({}, { incrementSignCount: true })

    let first = await app.finishAuthentication(
      await authenticator.authenticate(await app.startAuthentication()),
    )
    assert.ok(first.ok)
    app.credentials.set(first.credential.id, first.credential)
    let second = await app.finishAuthentication(
      await authenticator.authenticate(await app.startAuthentication()),
    )

    assert.equal(first.credential.counter, 1)
    assert.ok(second.ok)
    assert.equal(second.credential.counter, 2)
  })

  it('rejects signature counters that did not increase', async () => {
    let { app, authenticator, credential } = await setup()
    app.credentials.set(credential.id, { ...credential, counter: 5 })

    let result = await app.finishAuthentication(
      await authenticator.authenticate(await app.startAuthentication(), { signCount: 5 }),
    )

    assertFailure(result, 'counter_regression')
  })

  it('reports backup state changes', async () => {
    let { app, authenticator, credential } = await setup()
    app.credentials.set(credential.id, { ...credential, backedUp: false })

    let result = await app.finishAuthentication(
      await authenticator.authenticate(await app.startAuthentication()),
    )

    assert.ok(result.ok)
    assert.equal(result.credential.backedUp, true)
  })

  it('rejects invalid signatures', async () => {
    let { app, authenticator } = await setup()
    let response = await authenticator.authenticate(await app.startAuthentication(), {
      tamperSignature: true,
    })

    assertFailure(await app.finishAuthentication(response), 'invalid_signature')
  })

  it('rejects signatures from a different key for the same credential ID', async () => {
    let { app, credential } = await setup()
    let impostor = await createTestAuthenticator()
    await impostor.register(await createPasskeyTestApp().startRegistration())
    let response = await impostor.authenticate(await app.startAuthentication(), {
      credentialId: credential.id,
      userHandle: 'user-1',
    })

    assertFailure(await app.finishAuthentication(response), 'invalid_signature')
  })

  it('rejects revoked credentials', async () => {
    let { app, authenticator, credential } = await setup()
    app.credentials.delete(credential.id)

    let result = await app.finishAuthentication(
      await authenticator.authenticate(await app.startAuthentication()),
    )

    assertFailure(result, 'credential_not_found')
  })

  it('rejects passkeys owned by a different account than the identified user', async () => {
    let { app, authenticator } = await setup()

    let result = await app.finishAuthentication(
      await authenticator.authenticate(await app.startAuthentication({ userId: 'user-2' })),
    )

    assertFailure(result, 'user_mismatch')
  })

  it('accepts passkeys owned by the identified user', async () => {
    let { app, authenticator, credential } = await setup()

    let result = await app.finishAuthentication(
      await authenticator.authenticate(
        await app.startAuthentication({ userId: 'user-1', allowCredentials: [credential] }),
      ),
    )

    assert.equal(result.ok, true)
  })

  it('rejects passkeys that are not in the allowed credentials', async () => {
    let { app } = await setup()
    let other = await setup()
    app.credentials.set(other.credential.id, { ...other.credential, userId: 'user-1' })
    let response = await other.authenticator.authenticate(
      await app.startAuthentication({ allowCredentials: [{ id: 'AAAA' }] }),
    )

    assertFailure(await app.finishAuthentication(response), 'credential_not_allowed')
  })

  it('accepts passkeys that are in the allowed credentials', async () => {
    let { app, authenticator, credential } = await setup()

    let result = await app.finishAuthentication(
      await authenticator.authenticate(
        await app.startAuthentication({ allowCredentials: [{ id: 'AAAA' }, credential] }),
      ),
    )

    assert.equal(result.ok, true)
  })

  it('verifies sign-ins started in several tabs of the same session', async () => {
    let { app, authenticator } = await setup()
    let firstTabOptions = await app.startAuthentication()
    let secondTabOptions = await app.startAuthentication()

    let secondTab = await app.finishAuthentication(
      await authenticator.authenticate(secondTabOptions),
    )
    let firstTab = await app.finishAuthentication(await authenticator.authenticate(firstTabOptions))

    assert.equal(secondTab.ok, true)
    assert.equal(firstTab.ok, true)
  })

  it('rejects user handles that do not match the credential owner', async () => {
    let { app, authenticator } = await setup()
    let response = await authenticator.authenticate(await app.startAuthentication(), {
      userHandle: 'user-2',
    })

    assertFailure(await app.finishAuthentication(response), 'user_mismatch')
  })

  it('verifies the signature before reporting which account owns a passkey', async () => {
    let { app, authenticator } = await setup()
    let response = await authenticator.authenticate(await app.startAuthentication(), {
      userHandle: 'user-2',
      tamperSignature: true,
    })

    assertFailure(await app.finishAuthentication(response), 'invalid_signature')
  })

  it('accepts responses without a user handle', async () => {
    let { app, authenticator } = await setup()
    let response = await authenticator.authenticate(await app.startAuthentication(), {
      userHandle: null,
    })

    assert.equal((await app.finishAuthentication(response)).ok, true)
  })

  it('rejects responses when no sign-in was started', async () => {
    let { app, authenticator } = await setup()
    let response = await authenticator.authenticate(
      await createPasskeyTestApp().startAuthentication(),
    )

    assertFailure(await app.finishAuthentication(response), 'challenge_missing')
  })

  it('rejects challenges issued for registration', async () => {
    let { app, authenticator } = await setup()
    let { challenge } = await app.startRegistration()
    let response = await authenticator.authenticate({
      ...(await createPasskeyTestApp().startAuthentication()),
      challenge,
    })

    assertFailure(await app.finishAuthentication(response), 'challenge_missing')
  })

  it('rejects expired challenges', async (t) => {
    let now = Date.now()
    t.mock.method(Date, 'now', () => now)
    let { app, authenticator } = await setup({ timeout: 60_000 })
    let response = await authenticator.authenticate(await app.startAuthentication())

    now += 60_000

    assertFailure(await app.finishAuthentication(response), 'challenge_expired')
  })

  it('rejects responses signed for a challenge this session did not issue', async () => {
    let { app, authenticator } = await setup()
    let response = await authenticator.authenticate(await app.startAuthentication(), {
      challenge: 'b3RoZXItY2hhbGxlbmdl',
    })

    assertFailure(await app.finishAuthentication(response), 'challenge_missing')
  })

  it('rejects a challenge after it has been used', async () => {
    let { app, authenticator } = await setup()
    let response = await authenticator.authenticate(await app.startAuthentication())

    assert.equal((await app.finishAuthentication(response)).ok, true)
    assertFailure(await app.finishAuthentication(response), 'challenge_missing')
  })

  it('rejects replays that reuse an earlier cookie session', async () => {
    let { app, authenticator } = await setup({ sessionStorage: createCookieSessionStorage() })
    let response = await authenticator.authenticate(await app.startAuthentication())
    let cookieWithChallenge = app.sessionCookie

    assert.equal((await app.finishAuthentication(response)).ok, true)

    app.sessionCookie = cookieWithChallenge
    assertFailure(await app.finishAuthentication(response), 'challenge_consumed')
  })

  it('accepts only one of several concurrent redemptions', async () => {
    let { app, authenticator } = await setup({ sessionStorage: createCookieSessionStorage() })
    let response = await authenticator.authenticate(await app.startAuthentication())

    let results = await Promise.all([
      app.finishAuthentication(response),
      app.finishAuthentication(response),
      app.finishAuthentication(response),
    ])

    assert.deepEqual(results.map((result) => (result.ok ? 'ok' : result.error.code)).sort(), [
      'challenge_consumed',
      'challenge_consumed',
      'ok',
    ])
  })

  it('rejects responses from an unexpected origin', async () => {
    let { app, authenticator } = await setup()
    let response = await authenticator.authenticate(await app.startAuthentication(), {
      origin: 'https://evil.example',
    })

    assertFailure(await app.finishAuthentication(response), 'origin_mismatch')
  })

  it('rejects assertions scoped to another relying party', async () => {
    let { app, authenticator } = await setup()
    let response = await authenticator.authenticate(await app.startAuthentication(), {
      rpId: 'evil.example',
    })

    assertFailure(await app.finishAuthentication(response), 'rp_id_mismatch')
  })

  it('rejects responses without user presence', async () => {
    let { app, authenticator } = await setup()
    let response = await authenticator.authenticate(await app.startAuthentication(), {
      flags: { userPresent: false },
    })

    assertFailure(await app.finishAuthentication(response), 'user_not_present')
  })

  it('rejects unverified users when user verification is required', async () => {
    let { app, authenticator } = await setup({ userVerification: 'required' })
    let response = await authenticator.authenticate(await app.startAuthentication(), {
      flags: { userVerified: false },
    })

    assertFailure(await app.finishAuthentication(response), 'user_not_verified')
  })

  it('rejects registration client data', async () => {
    let { app, authenticator } = await setup()
    let response = await authenticator.authenticate(await app.startAuthentication(), {
      type: 'webauthn.create',
    })

    assertFailure(await app.finishAuthentication(response), 'invalid_response')
  })

  it('rejects changes to backup eligibility', async () => {
    let { app, authenticator } = await setup()
    let response = await authenticator.authenticate(await app.startAuthentication(), {
      flags: { backupEligible: false, backedUp: false },
    })

    assertFailure(await app.finishAuthentication(response), 'invalid_response')
  })

  it('rejects malformed responses', async () => {
    let { app } = await setup()

    await app.startAuthentication()
    assertFailure(
      await app.finishAuthentication({ type: 'public-key', id: 'abc' }),
      'invalid_response',
    )
  })
})
