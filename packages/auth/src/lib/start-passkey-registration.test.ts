import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { createCookie } from '@remix-run/cookie'
import { createRouter } from '@remix-run/fetch-router'
import { createMemorySessionStorage } from '@remix-run/session/memory-storage'
import { session as sessionMiddleware } from '@remix-run/session-middleware'

import { createPasskeyTestApp, testUser } from './passkey/test-app.ts'
import { startPasskeyRegistration } from './start-passkey-registration.ts'

describe('startPasskeyRegistration()', () => {
  it('returns creation options for a discoverable passkey', async () => {
    let app = createPasskeyTestApp()
    let options = await app.startRegistration()

    assert.equal(typeof options.challenge, 'string')
    assert.equal(options.challenge.length, 43)
    assert.deepEqual(options.rp, { id: 'app.example.com', name: 'Example App' })
    assert.deepEqual(options.user, {
      id: 'dXNlci0x',
      name: 'user@example.com',
      displayName: 'Test User',
    })
    assert.deepEqual(options.pubKeyCredParams, [
      { type: 'public-key', alg: -8 },
      { type: 'public-key', alg: -7 },
      { type: 'public-key', alg: -257 },
    ])
    assert.equal(options.timeout, 300_000)
    assert.deepEqual(options.excludeCredentials, [])
    assert.deepEqual(options.authenticatorSelection, {
      residentKey: 'required',
      requireResidentKey: true,
      userVerification: 'preferred',
    })
    assert.equal(options.attestation, 'none')
  })

  it('stores the pending challenge in the session bound to the ceremony and account', async () => {
    let app = createPasskeyTestApp()
    let options = await app.startRegistration()
    let session = await app.readSession()
    let [pending] = session.__passkey as Array<{ expiresAt: number }>

    assert.deepEqual(session.__passkey, [
      {
        provider: 'passkey',
        ceremony: 'registration',
        challenge: options.challenge,
        expiresAt: pending.expiresAt,
        userId: 'user-1',
      },
    ])
  })

  it('issues a fresh challenge for every ceremony', async () => {
    let app = createPasskeyTestApp()
    let first = await app.startRegistration()
    let second = await app.startRegistration()

    assert.notEqual(first.challenge, second.challenge)
  })

  it('excludes credentials the account already has', async () => {
    let app = createPasskeyTestApp()
    let options = await app.startRegistration({
      excludeCredentials: [
        { id: 'credential-1', transports: ['internal', 'hybrid'] },
        { id: 'credential-2' },
      ],
    })

    assert.deepEqual(options.excludeCredentials, [
      { id: 'credential-1', type: 'public-key', transports: ['internal', 'hybrid'] },
      { id: 'credential-2', type: 'public-key' },
    ])
  })

  it('defaults the display name to the account name', async () => {
    let app = createPasskeyTestApp()
    let options = await app.startRegistration({
      user: { id: 'user-2', name: 'second@example.com' },
    })

    assert.equal(options.user.displayName, 'second@example.com')
  })

  it('uses the provider user verification policy and timeout', async () => {
    let app = createPasskeyTestApp({ userVerification: 'required', timeout: 60_000 })
    let options = await app.startRegistration()

    assert.equal(options.authenticatorSelection.userVerification, 'required')
    assert.equal(options.timeout, 60_000)
  })

  it('rejects user ids longer than 64 bytes', async () => {
    let provider = createPasskeyTestApp().provider
    let router = createRouter({
      middleware: [
        sessionMiddleware(
          createCookie('__session', { secrets: ['secret1'] }),
          createMemorySessionStorage(),
        ),
      ],
    })
    let error: unknown
    router.post('/', async (context) => {
      try {
        await startPasskeyRegistration(provider, context, {
          user: { ...testUser, id: 'x'.repeat(65) },
        })
      } catch (caught) {
        error = caught
      }
      return new Response('ok')
    })

    await router.fetch('https://app.example.com/', { method: 'POST' })

    assert.ok(error instanceof Error)
    assert.match(error.message, /at most 64 bytes/)
  })

  it('requires session middleware', async () => {
    let provider = createPasskeyTestApp().provider
    let router = createRouter()
    let error: unknown
    router.post('/', async (context) => {
      try {
        await startPasskeyRegistration(provider, context, { user: testUser })
      } catch (caught) {
        error = caught
      }
      return new Response('ok')
    })

    await router.fetch('https://app.example.com/', { method: 'POST' })

    assert.ok(error instanceof Error)
    assert.match(error.message, /session\(\) middleware runs before startPasskeyRegistration\(\)/)
  })
})
