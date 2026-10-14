import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import type { TestContext } from '@remix-run/test'

import { decodeBase64Url } from '../base64url.ts'
import {
  createPasskey,
  getPasskey,
  isPasskeyAutofillSupported,
  isPasskeySupported,
} from './browser.ts'
import type {
  PasskeyAuthenticationResponseJSON,
  PasskeyCreationOptionsJSON,
  PasskeyRegistrationResponseJSON,
  PasskeyRequestOptionsJSON,
} from './json.ts'
import { createPasskeyTestApp } from './test-app.ts'
import { createTestAuthenticator } from './test-authenticator.ts'

interface FakeWebAuthn {
  create?(options: CredentialCreationOptions): Promise<Credential | null>
  get?(options: CredentialRequestOptions): Promise<Credential | null>
  isConditionalMediationAvailable?(): Promise<boolean>
}

function installWebAuthn(t: TestContext, webAuthn: FakeWebAuthn): void {
  let FakePublicKeyCredential = class {}
  if (webAuthn.isConditionalMediationAvailable) {
    Object.assign(FakePublicKeyCredential, {
      isConditionalMediationAvailable: webAuthn.isConditionalMediationAvailable,
    })
  }

  defineGlobal(t, globalThis, 'PublicKeyCredential', FakePublicKeyCredential)
  defineGlobal(t, navigator, 'credentials', {
    create: webAuthn.create ?? (() => Promise.reject(new Error('Unexpected create()'))),
    get: webAuthn.get ?? (() => Promise.reject(new Error('Unexpected get()'))),
  })
}

function defineGlobal(t: TestContext, target: object, name: string, value: unknown): void {
  let descriptor = Object.getOwnPropertyDescriptor(target, name)
  Object.defineProperty(target, name, { value, configurable: true, writable: true })
  t.after(() => {
    if (descriptor) {
      Object.defineProperty(target, name, descriptor)
    } else {
      Reflect.deleteProperty(target, name)
    }
  })
}

function toBuffer(value: string): ArrayBuffer {
  return decodeBase64Url(value)!.buffer
}

function toRegistrationCredential(response: PasskeyRegistrationResponseJSON): Credential {
  return {
    id: response.id,
    type: 'public-key',
    rawId: toBuffer(response.rawId),
    authenticatorAttachment: 'platform',
    response: {
      clientDataJSON: toBuffer(response.response.clientDataJSON),
      attestationObject: toBuffer(response.response.attestationObject),
      getTransports: () => response.response.transports ?? [],
    },
  } as unknown as Credential
}

function toAuthenticationCredential(response: PasskeyAuthenticationResponseJSON): Credential {
  return {
    id: response.id,
    type: 'public-key',
    rawId: toBuffer(response.rawId),
    authenticatorAttachment: null,
    response: {
      clientDataJSON: toBuffer(response.response.clientDataJSON),
      authenticatorData: toBuffer(response.response.authenticatorData),
      signature: toBuffer(response.response.signature),
      userHandle: response.response.userHandle ? toBuffer(response.response.userHandle) : null,
    },
  } as unknown as Credential
}

const creationOptions: PasskeyCreationOptionsJSON = {
  challenge: 'Y2hhbGxlbmdl',
  rp: { id: 'app.example.com', name: 'Example App' },
  user: { id: 'dXNlci0x', name: 'user@example.com', displayName: 'Test User' },
  pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
  timeout: 300_000,
  excludeCredentials: [{ id: 'AQID', type: 'public-key', transports: ['usb'] }],
  authenticatorSelection: {
    residentKey: 'required',
    requireResidentKey: true,
    userVerification: 'preferred',
  },
  attestation: 'none',
}

const requestOptions: PasskeyRequestOptionsJSON = {
  challenge: 'Y2hhbGxlbmdl',
  rpId: 'app.example.com',
  timeout: 300_000,
  userVerification: 'preferred',
  allowCredentials: [],
}

describe('isPasskeySupported()', () => {
  it('returns false when the browser does not expose WebAuthn', () => {
    assert.equal(isPasskeySupported(), false)
  })

  it('returns true when the browser exposes WebAuthn', (t) => {
    installWebAuthn(t, {})

    assert.equal(isPasskeySupported(), true)
  })
})

describe('isPasskeyAutofillSupported()', () => {
  it('returns false when conditional mediation is unavailable', async (t) => {
    installWebAuthn(t, {})

    assert.equal(await isPasskeyAutofillSupported(), false)
  })

  it('returns the browser conditional mediation support', async (t) => {
    installWebAuthn(t, { isConditionalMediationAvailable: async () => true })

    assert.equal(await isPasskeyAutofillSupported(), true)
  })

  it('returns false when the support check throws', async (t) => {
    installWebAuthn(t, {
      async isConditionalMediationAvailable() {
        throw new Error('boom')
      },
    })

    assert.equal(await isPasskeyAutofillSupported(), false)
  })
})

describe('createPasskey()', () => {
  it('reports unsupported browsers', async () => {
    let result = await createPasskey(creationOptions)

    assert.deepEqual(result, {
      ok: false,
      error: { code: 'unsupported', message: 'This browser does not support passkeys.' },
    })
  })

  it('decodes options before calling the browser', async (t) => {
    let calls: CredentialCreationOptions[] = []
    let controller = new AbortController()
    installWebAuthn(t, {
      async create(options) {
        calls.push(options)
        throw new DOMException('Cancelled', 'NotAllowedError')
      },
    })

    await createPasskey(creationOptions, { signal: controller.signal })

    let publicKey = calls[0].publicKey!
    assert.equal(calls[0].signal, controller.signal)
    assert.deepEqual(
      new Uint8Array(publicKey.challenge as ArrayBuffer),
      decodeBase64Url('Y2hhbGxlbmdl'),
    )
    assert.deepEqual(new Uint8Array(publicKey.user.id as ArrayBuffer), decodeBase64Url('dXNlci0x'))
    assert.deepEqual(publicKey.excludeCredentials?.[0].transports, ['usb'])
    assert.deepEqual(
      new Uint8Array(publicKey.excludeCredentials?.[0].id as ArrayBuffer),
      new Uint8Array([1, 2, 3]),
    )
  })

  it('returns a registration response the server accepts', async (t) => {
    let app = createPasskeyTestApp()
    let authenticator = await createTestAuthenticator()
    let options = await app.startRegistration()
    let response = await authenticator.register(options)
    installWebAuthn(t, { create: async () => toRegistrationCredential(response) })

    let result = await createPasskey(options)

    assert.ok(result.ok)
    assert.deepEqual(result.response, { ...response, authenticatorAttachment: 'platform' })
    assert.equal((await app.finishRegistration(JSON.stringify(result.response))).ok, true)
  })

  it('reports cancelled prompts', async (t) => {
    let error = new DOMException('Cancelled', 'NotAllowedError')
    installWebAuthn(t, { create: () => Promise.reject(error) })

    let result = await createPasskey(creationOptions)

    assert.deepEqual(result, {
      ok: false,
      error: {
        code: 'cancelled',
        message: 'The passkey request was cancelled or timed out.',
        cause: error,
      },
    })
  })

  it('reports authenticators that already hold a passkey for the account', async (t) => {
    installWebAuthn(t, {
      create: () => Promise.reject(new DOMException('Excluded', 'InvalidStateError')),
    })

    let result = await createPasskey(creationOptions)

    assert.equal(result.ok ? undefined : result.error.code, 'excluded_credential')
  })

  it('reports aborted, blocked, and unknown failures', async (t) => {
    let errors = [
      new DOMException('Aborted', 'AbortError'),
      new DOMException('Blocked', 'SecurityError'),
      new DOMException('Unsupported', 'NotSupportedError'),
      new Error('boom'),
    ]
    installWebAuthn(t, { create: () => Promise.reject(errors.shift()) })

    let codes = []
    for (let index = 0; index < 4; index++) {
      let result = await createPasskey(creationOptions)
      codes.push(result.ok ? 'ok' : result.error.code)
    }

    assert.deepEqual(codes, ['aborted', 'security_error', 'unsupported', 'unknown_error'])
  })

  it('reports invalid options without calling the browser', async (t) => {
    installWebAuthn(t, {})

    let result = await createPasskey({ ...creationOptions, challenge: 'not base64url!' })

    assert.equal(result.ok ? undefined : result.error.code, 'invalid_options')
  })
})

describe('getPasskey()', () => {
  it('returns an authentication response the server accepts', async (t) => {
    let app = createPasskeyTestApp()
    let authenticator = await createTestAuthenticator()
    let registration = await app.finishRegistration(
      await authenticator.register(await app.startRegistration()),
    )
    assert.ok(registration.ok)
    app.credentials.set(registration.credential.id, registration.credential)
    let options = await app.startAuthentication()
    let response = await authenticator.authenticate(options)
    installWebAuthn(t, { get: async () => toAuthenticationCredential(response) })

    let result = await getPasskey(options)

    assert.ok(result.ok)
    assert.deepEqual(result.response, { ...response, authenticatorAttachment: null })
    assert.equal((await app.finishAuthentication(result.response)).ok, true)
  })

  it('requests conditional mediation for autofill', async (t) => {
    let calls: CredentialRequestOptions[] = []
    installWebAuthn(t, {
      isConditionalMediationAvailable: async () => true,
      async get(options) {
        calls.push(options)
        throw new DOMException('Aborted', 'AbortError')
      },
    })

    let result = await getPasskey(requestOptions, { autofill: true })

    assert.equal(calls[0].mediation, 'conditional')
    assert.equal(result.ok ? undefined : result.error.code, 'aborted')
  })

  it('reports aborted requests even when the signal has a custom reason', async (t) => {
    let controller = new AbortController()
    installWebAuthn(t, {
      async get() {
        controller.abort('navigated away')
        throw controller.signal.reason
      },
    })

    let result = await getPasskey(requestOptions, { signal: controller.signal })

    assert.equal(result.ok ? undefined : result.error.code, 'aborted')
  })

  it('uses a modal prompt by default', async (t) => {
    let calls: CredentialRequestOptions[] = []
    installWebAuthn(t, {
      async get(options) {
        calls.push(options)
        throw new DOMException('Cancelled', 'NotAllowedError')
      },
    })

    let result = await getPasskey(requestOptions)

    assert.equal(calls[0].mediation, undefined)
    assert.equal(result.ok ? undefined : result.error.code, 'cancelled')
  })

  it('reports browsers without passkey autofill', async (t) => {
    installWebAuthn(t, {})

    let result = await getPasskey(requestOptions, { autofill: true })

    assert.deepEqual(result, {
      ok: false,
      error: { code: 'unsupported', message: 'This browser does not support passkey autofill.' },
    })
  })
})
