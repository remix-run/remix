import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { createRouter } from '@remix-run/fetch-router'

import { createPasskeyTestApp } from './passkey/test-app.ts'
import { startPasskeyAuthentication } from './start-passkey-authentication.ts'

describe('startPasskeyAuthentication()', () => {
  it('returns request options for username-less sign-in', async () => {
    let app = createPasskeyTestApp()
    let options = await app.startAuthentication()

    assert.equal(options.challenge.length, 43)
    assert.equal(options.rpId, 'app.example.com')
    assert.equal(options.timeout, 300_000)
    assert.equal(options.userVerification, 'preferred')
    assert.deepEqual(options.allowCredentials, [])
  })

  it('stores a pending challenge that is not bound to an account', async () => {
    let app = createPasskeyTestApp()
    let options = await app.startAuthentication()
    let session = await app.readSession()
    let [pending] = session.__passkey as Array<{ expiresAt: number }>

    assert.deepEqual(session.__passkey, [
      {
        provider: 'passkey',
        ceremony: 'authentication',
        challenge: options.challenge,
        expiresAt: pending.expiresAt,
      },
    ])
  })

  it('binds the challenge to an identified account and its allowed passkeys', async () => {
    let app = createPasskeyTestApp()
    let options = await app.startAuthentication({
      userId: 'user-1',
      allowCredentials: [{ id: 'Y3JlZGVudGlhbC0x', transports: ['usb'] }],
    })
    let session = await app.readSession()
    let [pending] = session.__passkey as Array<{ userId?: string; allowCredentials?: string[] }>

    assert.deepEqual(options.allowCredentials, [
      { id: 'Y3JlZGVudGlhbC0x', type: 'public-key', transports: ['usb'] },
    ])
    assert.equal(pending.userId, 'user-1')
    assert.deepEqual(pending.allowCredentials, ['Y3JlZGVudGlhbC0x'])
  })

  it('keeps challenges for other pending ceremonies', async () => {
    let app = createPasskeyTestApp()
    let registrationOptions = await app.startRegistration()
    let authenticationOptions = await app.startAuthentication()
    let session = await app.readSession()

    assert.deepEqual(
      (session.__passkey as Array<{ challenge: string }>).map((pending) => pending.challenge),
      [registrationOptions.challenge, authenticationOptions.challenge],
    )
  })

  it('keeps only the five most recent challenges', async () => {
    let app = createPasskeyTestApp()
    let challenges: string[] = []
    for (let count = 0; count < 6; count++) {
      challenges.push((await app.startAuthentication()).challenge)
    }
    let session = await app.readSession()

    assert.deepEqual(
      (session.__passkey as Array<{ challenge: string }>).map((pending) => pending.challenge),
      challenges.slice(1),
    )
  })

  it('rejects credential IDs that are not base64url', async () => {
    let app = createPasskeyTestApp()

    await assert.rejects(
      app.fetch(
        new Request('https://app.example.com/authentication/options', {
          method: 'POST',
          body: JSON.stringify({ allowCredentials: [{ id: 'not base64url!' }] }),
        }),
      ),
      /Invalid passkey credential ID "not base64url!"/,
    )
  })

  it('requires session middleware', async () => {
    let provider = createPasskeyTestApp().provider
    let router = createRouter()
    let error: unknown
    router.post('/', async (context) => {
      try {
        await startPasskeyAuthentication(provider, context)
      } catch (caught) {
        error = caught
      }
      return new Response('ok')
    })

    await router.fetch('https://app.example.com/', { method: 'POST' })

    assert.ok(error instanceof Error)
    assert.match(error.message, /session\(\) middleware runs before startPasskeyAuthentication\(\)/)
  })
})
