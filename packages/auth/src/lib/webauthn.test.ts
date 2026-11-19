import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { createCookie } from '@remix-run/cookie'
import { createRouter } from '@remix-run/fetch-router'
import { Session } from '@remix-run/session'
import { createMemorySessionStorage } from '@remix-run/session/memory-storage'
import { session as sessionMiddleware } from '@remix-run/session-middleware'

import { completeAuth } from './complete-auth.ts'
import { createWebAuthnProvider } from './providers/webauthn.ts'
import type { WebAuthnCredential, WebAuthnProviderOptions } from './providers/webauthn.ts'
import { createSoftwareAuthenticator } from './test-utils.ts'
import type { SoftwareAuthenticator, SoftwareAuthenticatorOverrides } from './test-utils.ts'
import {
  finishWebAuthnAuthentication,
  startWebAuthnAuthentication,
} from './webauthn-authentication.ts'
import { finishWebAuthnRegistration, startWebAuthnRegistration } from './webauthn-registration.ts'

function createWebAuthnApp(options: Partial<WebAuthnProviderOptions> = {}) {
  let provider = createWebAuthnProvider({
    rpId: 'example.com',
    rpName: 'Example',
    origin: 'https://app.example.com',
    ...options,
  })
  let credentials = new Map<string, WebAuthnCredential>()
  let router = createRouter({
    middleware: [
      sessionMiddleware(
        createCookie('__session', { secrets: ['secret1'] }),
        createMemorySessionStorage(),
      ),
    ],
  })

  router.post('/register/start', async (context) => {
    let body = await context.request.json()
    return Response.json(startWebAuthnRegistration(provider, context, body))
  })
  router.post('/register/finish', async (context) => {
    try {
      let result = await finishWebAuthnRegistration(
        provider,
        context,
        await context.request.json(),
        { getCredential: (id) => credentials.get(id) ?? null },
      )
      credentials.set(result.credential.id, result.credential)
      return Response.json(result)
    } catch (error) {
      return Response.json({ error: (error as Error).message }, { status: 400 })
    }
  })
  router.post('/login/start', async (context) => {
    let body = await context.request.json()
    return Response.json(startWebAuthnAuthentication(provider, context, body))
  })
  router.post('/login/finish', async (context) => {
    try {
      let result = await finishWebAuthnAuthentication(
        provider,
        context,
        await context.request.json(),
        { getCredential: (id) => credentials.get(id) ?? null },
      )
      credentials.set(result.credential.id, result.credential)
      completeAuth(context).set('auth', { userId: result.userId })
      return Response.json(result)
    } catch (error) {
      return Response.json({ error: (error as Error).message }, { status: 400 })
    }
  })
  router.get('/whoami', ({ get }) => Response.json({ auth: get(Session).get('auth') ?? null }))

  let cookie = ''
  async function request(method: 'GET' | 'POST', path: string, body?: unknown) {
    let response = await router.fetch(
      new Request(`https://app.example.com${path}`, {
        method,
        headers: cookie === '' ? {} : { Cookie: cookie },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    )
    let setCookie = response.headers.getSetCookie()[0]
    if (setCookie != null) {
      cookie = setCookie.split(';')[0]!
    }
    return { status: response.status, body: await response.json() }
  }

  async function register(
    authenticator: SoftwareAuthenticator,
    overrides?: SoftwareAuthenticatorOverrides,
  ) {
    let start = await request('POST', '/register/start', {
      user: { id: 'user-1', name: 'ada@example.com', displayName: 'Ada' },
      returnTo: '/settings/passkeys',
    })
    return request('POST', '/register/finish', await authenticator.register(start.body, overrides))
  }

  async function login(
    authenticator: SoftwareAuthenticator,
    startBody: object = {},
    overrides?: SoftwareAuthenticatorOverrides,
  ) {
    let start = await request('POST', '/login/start', startBody)
    return request(
      'POST',
      '/login/finish',
      await authenticator.authenticate(start.body, 'user-1', overrides),
    )
  }

  return { credentials, request, register, login }
}

describe('startWebAuthnRegistration()', () => {
  it('returns creation options with a fresh challenge and encoded user handle', async () => {
    let app = createWebAuthnApp({ residentKey: 'required', userVerification: 'required' })
    let first = await app.request('POST', '/register/start', {
      user: { id: 'user-1', name: 'ada@example.com' },
      excludeCredentials: [{ id: 'AAEC', transports: ['usb'] }],
    })
    let second = await app.request('POST', '/register/start', {
      user: { id: 'user-1', name: 'ada@example.com' },
    })

    assert.equal(first.status, 200)
    assert.deepEqual(first.body.rp, { id: 'example.com', name: 'Example' })
    assert.deepEqual(first.body.user, {
      id: Buffer.from('user-1').toString('base64url'),
      name: 'ada@example.com',
      displayName: 'ada@example.com',
    })
    assert.deepEqual(first.body.pubKeyCredParams, [
      { type: 'public-key', alg: -8 },
      { type: 'public-key', alg: -7 },
      { type: 'public-key', alg: -257 },
    ])
    assert.deepEqual(first.body.excludeCredentials, [
      { type: 'public-key', id: 'AAEC', transports: ['usb'] },
    ])
    assert.deepEqual(first.body.authenticatorSelection, {
      residentKey: 'required',
      requireResidentKey: true,
      userVerification: 'required',
    })
    assert.equal(first.body.attestation, 'none')
    assert.equal(first.body.timeout, 300000)
    assert.equal(Buffer.from(first.body.challenge, 'base64url').length, 32)
    assert.notEqual(first.body.challenge, second.body.challenge)
  })
})

describe('finishWebAuthnRegistration()', () => {
  it('verifies an ES256 registration and returns a storable credential', async () => {
    let app = createWebAuthnApp()
    let authenticator = await createSoftwareAuthenticator({ algorithm: -7 })
    let { status, body } = await app.register(authenticator)

    assert.equal(status, 200)
    assert.equal(body.credential.id, authenticator.credentialId)
    assert.equal(body.credential.userId, 'user-1')
    assert.equal(body.credential.algorithm, -7)
    assert.equal(body.credential.signCount, 0)
    assert.deepEqual(body.credential.transports, ['internal'])
    assert.equal(body.credential.aaguid, '00000000-0000-0000-0000-000000000000')
    assert.equal(body.credential.backupEligible, false)
    assert.equal(body.userVerified, true)
    assert.equal(body.returnTo, '/settings/passkeys')
  })

  it('rejects a response signed for a different challenge', async () => {
    let app = createWebAuthnApp()
    let authenticator = await createSoftwareAuthenticator()
    let { status, body } = await app.register(authenticator, { challenge: 'not-the-challenge' })

    assert.equal(status, 400)
    assert.equal(body.error, 'Missing WebAuthn registration for "webauthn".')
  })

  it('rejects a credential id that is already registered', async () => {
    let app = createWebAuthnApp()
    let authenticator = await createSoftwareAuthenticator()
    let first = await app.register(authenticator)
    let originalPublicKey = app.credentials.get(authenticator.credentialId)?.publicKey

    let second = await app.register(authenticator)

    assert.equal(first.status, 200)
    assert.equal(second.status, 400)
    assert.equal(second.body.error, 'WebAuthn credential is already registered.')
    assert.equal(app.credentials.get(authenticator.credentialId)?.publicKey, originalPublicKey)
  })

  it('rejects a response from an origin the provider does not allow', async () => {
    let app = createWebAuthnApp()
    let authenticator = await createSoftwareAuthenticator()
    let { status, body } = await app.register(authenticator, { origin: 'https://evil.example' })

    assert.equal(status, 400)
    assert.equal(body.error, 'Invalid WebAuthn origin "https://evil.example".')
  })

  it('rejects a response scoped to a different rpId', async () => {
    let app = createWebAuthnApp()
    let authenticator = await createSoftwareAuthenticator()
    let { status, body } = await app.register(authenticator, { rpId: 'evil.example' })

    assert.equal(status, 400)
    assert.equal(body.error, 'Invalid WebAuthn rpId hash.')
  })

  it('rejects an authentication response sent to the registration endpoint', async () => {
    let app = createWebAuthnApp()
    let authenticator = await createSoftwareAuthenticator()
    let { status, body } = await app.register(authenticator, { type: 'webauthn.get' })

    assert.equal(status, 400)
    assert.equal(body.error, 'Invalid WebAuthn client data type. Expected "webauthn.create".')
  })

  it('rejects cross-origin ceremonies', async () => {
    let app = createWebAuthnApp()
    let authenticator = await createSoftwareAuthenticator()
    let { status, body } = await app.register(authenticator, { crossOrigin: true })

    assert.equal(status, 400)
    assert.equal(body.error, 'Cross-origin WebAuthn ceremonies are not allowed.')
  })

  it('requires user verification when the provider requires it', async () => {
    let app = createWebAuthnApp({ userVerification: 'required' })
    let authenticator = await createSoftwareAuthenticator()
    // User present and attested credential data, but not user verified.
    let { status, body } = await app.register(authenticator, { flags: 0x41 })

    assert.equal(status, 400)
    assert.equal(body.error, 'WebAuthn user verification is required.')
  })

  it('rejects a credential algorithm the provider did not request', async () => {
    let app = createWebAuthnApp({ algorithms: [-8] })
    let authenticator = await createSoftwareAuthenticator({ algorithm: -7 })
    let { status, body } = await app.register(authenticator)

    assert.equal(status, 400)
    assert.equal(body.error, 'WebAuthn credential algorithm "-7" was not requested.')
  })

  it('clears the ceremony so a response cannot be replayed', async () => {
    let app = createWebAuthnApp()
    let authenticator = await createSoftwareAuthenticator()
    let start = await app.request('POST', '/register/start', {
      user: { id: 'user-1', name: 'ada@example.com' },
    })
    let response = await authenticator.register(start.body)

    let first = await app.request('POST', '/register/finish', response)
    let replay = await app.request('POST', '/register/finish', response)

    assert.equal(first.status, 200)
    assert.equal(replay.status, 400)
    assert.equal(replay.body.error, 'Missing WebAuthn registration for "webauthn".')
  })

  it('rejects a ceremony after the provider timeout', async (t) => {
    let timers = t.useFakeTimers({ now: new Date('2030-01-01T00:00:00Z') })
    let app = createWebAuthnApp({ timeout: 1000 })
    let authenticator = await createSoftwareAuthenticator()
    let start = await app.request('POST', '/register/start', {
      user: { id: 'user-1', name: 'ada@example.com' },
    })

    timers.advance(1001)
    let { status, body } = await app.request(
      'POST',
      '/register/finish',
      await authenticator.register(start.body),
    )

    assert.equal(status, 400)
    assert.equal(body.error, 'WebAuthn registration expired.')
  })

  it('rejects malformed responses', async () => {
    let app = createWebAuthnApp()
    await app.request('POST', '/register/start', {
      user: { id: 'user-1', name: 'ada@example.com' },
    })
    let { status, body } = await app.request('POST', '/register/finish', {
      id: 'AAEC',
      rawId: 'AAED',
      type: 'public-key',
      response: {},
    })

    assert.equal(status, 400)
    assert.equal(body.error, 'Invalid WebAuthn response: "id" does not match "rawId".')
  })
})

describe('startWebAuthnAuthentication()', () => {
  it('returns request options for discoverable credential login', async () => {
    let app = createWebAuthnApp()
    let { body } = await app.request('POST', '/login/start', {})

    assert.deepEqual(body.allowCredentials, [])
    assert.equal(body.rpId, 'example.com')
    assert.equal(body.userVerification, 'preferred')
    assert.equal(Buffer.from(body.challenge, 'base64url').length, 32)
  })
})

describe('finishWebAuthnAuthentication()', () => {
  it('verifies an ES256 assertion and lets the route complete auth', async () => {
    let app = createWebAuthnApp()
    let authenticator = await createSoftwareAuthenticator({ algorithm: -7 })
    await app.register(authenticator)

    let { status, body } = await app.login(authenticator, { returnTo: '/dashboard' })
    let whoami = await app.request('GET', '/whoami')

    assert.equal(status, 200)
    assert.equal(body.userId, 'user-1')
    assert.equal(body.userVerified, true)
    assert.equal(body.credential.signCount, 1)
    assert.equal(body.returnTo, '/dashboard')
    assert.deepEqual(whoami.body.auth, { userId: 'user-1' })
  })

  it('verifies an Ed25519 assertion', async () => {
    let app = createWebAuthnApp()
    let authenticator = await createSoftwareAuthenticator({ algorithm: -8 })
    await app.register(authenticator)

    let { status, body } = await app.login(authenticator)

    assert.equal(status, 200)
    assert.equal(body.credential.algorithm, -8)
  })

  it('verifies an RS256 assertion', async () => {
    let app = createWebAuthnApp()
    let authenticator = await createSoftwareAuthenticator({ algorithm: -257 })
    await app.register(authenticator)

    let { status, body } = await app.login(authenticator)

    assert.equal(status, 200)
    assert.equal(body.credential.algorithm, -257)
  })

  it('rejects an assertion signed by a different key', async () => {
    let app = createWebAuthnApp()
    let authenticator = await createSoftwareAuthenticator()
    await app.register(authenticator)
    let impostor = await createSoftwareAuthenticator()

    let start = await app.request('POST', '/login/start', {})
    let forged = await impostor.authenticate(start.body, 'user-1')
    forged.id = authenticator.credentialId
    forged.rawId = authenticator.credentialId
    let { status, body } = await app.request('POST', '/login/finish', forged)

    assert.equal(status, 400)
    assert.equal(body.error, 'Invalid WebAuthn signature.')
  })

  it('rejects an unknown credential', async () => {
    let app = createWebAuthnApp()
    let authenticator = await createSoftwareAuthenticator()

    let { status, body } = await app.login(authenticator)

    assert.equal(status, 400)
    assert.equal(body.error, 'Unknown WebAuthn credential.')
  })

  it('rejects a credential outside allowCredentials', async () => {
    let app = createWebAuthnApp()
    let authenticator = await createSoftwareAuthenticator()
    await app.register(authenticator)

    let { status, body } = await app.login(authenticator, { allowCredentials: [{ id: 'AAEC' }] })

    assert.equal(status, 400)
    assert.equal(body.error, 'WebAuthn credential was not allowed for this login.')
  })

  it('rejects a user handle that does not match the credential owner', async () => {
    let app = createWebAuthnApp()
    let authenticator = await createSoftwareAuthenticator()
    await app.register(authenticator)

    let { status, body } = await app.login(
      authenticator,
      {},
      { userHandle: Buffer.from('user-2').toString('base64url') },
    )

    assert.equal(status, 400)
    assert.equal(body.error, 'WebAuthn user handle does not match the credential owner.')
  })

  it('rejects a signature counter that did not increase', async () => {
    let app = createWebAuthnApp()
    let authenticator = await createSoftwareAuthenticator()
    await app.register(authenticator)
    await app.login(authenticator, {}, { signCount: 5 })

    let { status, body } = await app.login(authenticator, {}, { signCount: 5 })

    assert.equal(status, 400)
    assert.equal(body.error, 'WebAuthn signature counter did not increase.')
  })

  it('accepts responses to concurrent ceremonies in the same session', async () => {
    let app = createWebAuthnApp()
    let authenticator = await createSoftwareAuthenticator()
    await app.register(authenticator)

    let autofill = await app.request('POST', '/login/start', {})
    let modal = await app.request('POST', '/login/start', {})
    let modalResult = await app.request(
      'POST',
      '/login/finish',
      await authenticator.authenticate(modal.body, 'user-1'),
    )
    let autofillResult = await app.request(
      'POST',
      '/login/finish',
      await authenticator.authenticate(autofill.body, 'user-1'),
    )

    assert.equal(modalResult.status, 200)
    assert.equal(autofillResult.status, 200)
  })

  it('rejects an assertion whose backup eligibility changed since registration', async () => {
    let app = createWebAuthnApp()
    let authenticator = await createSoftwareAuthenticator()
    await app.register(authenticator)

    // User present, user verified, and backup eligible; registration reported not eligible.
    let { status, body } = await app.login(authenticator, {}, { flags: 0x0d })

    assert.equal(status, 400)
    assert.equal(body.error, 'WebAuthn backup eligibility changed for this credential.')
  })

  it('accepts authenticators that always report a zero counter', async () => {
    let app = createWebAuthnApp()
    let authenticator = await createSoftwareAuthenticator()
    await app.register(authenticator)

    let first = await app.login(authenticator, {}, { signCount: 0 })
    let second = await app.login(authenticator, {}, { signCount: 0 })

    assert.equal(first.status, 200)
    assert.equal(second.status, 200)
  })

  it('rejects a registration ceremony answered at the login endpoint', async () => {
    let app = createWebAuthnApp()
    let authenticator = await createSoftwareAuthenticator()
    await app.register(authenticator)
    let start = await app.request('POST', '/register/start', {
      user: { id: 'user-1', name: 'ada@example.com' },
    })

    let { status, body } = await app.request(
      'POST',
      '/login/finish',
      await authenticator.authenticate(start.body, 'user-1'),
    )

    assert.equal(status, 400)
    assert.equal(body.error, 'Missing WebAuthn authentication for "webauthn".')
  })
})
