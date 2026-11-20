import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { createPasskey, getPasskey } from './webauthn-client.ts'

// Replaces `navigator` with a plain data property so the stub works whether the runtime defines it
// as an accessor (Node) or a data property.
function stubNavigator(navigator: object): () => void {
  let original = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
  Object.defineProperty(globalThis, 'navigator', { value: navigator, configurable: true })
  return () => {
    if (original == null) {
      Reflect.deleteProperty(globalThis, 'navigator')
    } else {
      Object.defineProperty(globalThis, 'navigator', original)
    }
  }
}

function bytes(...values: number[]) {
  return new Uint8Array(values).buffer
}

describe('createPasskey()', () => {
  it('decodes options for the browser and encodes the credential as JSON', async (t) => {
    let calls: CredentialCreationOptions[] = []
    t.after(
      stubNavigator({
        credentials: {
          async create(options: CredentialCreationOptions) {
            calls.push(options)
            return {
              id: 'AQI',
              rawId: bytes(1, 2),
              authenticatorAttachment: 'platform',
              response: {
                clientDataJSON: bytes(3),
                attestationObject: bytes(4, 5),
                getTransports: () => ['internal', 'hybrid'],
              },
              getClientExtensionResults: () => ({ credProps: { rk: true } }),
            }
          },
        },
      }),
    )

    let result = await createPasskey({
      rp: { id: 'example.com', name: 'Example' },
      user: { id: 'dXNlci0x', name: 'ada@example.com', displayName: 'Ada' },
      challenge: 'AAEC',
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
      timeout: 1000,
      excludeCredentials: [{ type: 'public-key', id: 'AQI', transports: ['usb'] }],
      authenticatorSelection: {
        residentKey: 'preferred',
        requireResidentKey: false,
        userVerification: 'preferred',
      },
      attestation: 'none',
    })

    let publicKey = calls[0]!.publicKey!
    assert.deepEqual(new Uint8Array(publicKey.challenge as ArrayBuffer), new Uint8Array([0, 1, 2]))
    assert.equal(new TextDecoder().decode(publicKey.user.id as Uint8Array), 'user-1')
    assert.deepEqual(
      new Uint8Array(publicKey.excludeCredentials![0]!.id as ArrayBuffer),
      new Uint8Array([1, 2]),
    )
    assert.deepEqual(result, {
      id: 'AQI',
      rawId: 'AQI',
      type: 'public-key',
      response: {
        clientDataJSON: 'Aw',
        attestationObject: 'BAU',
        transports: ['internal', 'hybrid'],
      },
      authenticatorAttachment: 'platform',
      clientExtensionResults: { credProps: { rk: true } },
    })
  })
})

describe('getPasskey()', () => {
  it('passes mediation through and encodes the assertion as JSON', async (t) => {
    let calls: CredentialRequestOptions[] = []
    t.after(
      stubNavigator({
        credentials: {
          async get(options: CredentialRequestOptions) {
            calls.push(options)
            return {
              id: 'AQI',
              rawId: bytes(1, 2),
              authenticatorAttachment: null,
              response: {
                clientDataJSON: bytes(3),
                authenticatorData: bytes(4),
                signature: bytes(5),
                userHandle: null,
              },
              getClientExtensionResults: () => ({}),
            }
          },
        },
      }),
    )

    let result = await getPasskey(
      {
        challenge: 'AAEC',
        timeout: 1000,
        rpId: 'example.com',
        allowCredentials: [],
        userVerification: 'preferred',
      },
      { mediation: 'conditional' },
    )

    assert.equal(calls[0]!.mediation, 'conditional')
    assert.deepEqual(calls[0]!.publicKey!.allowCredentials, [])
    assert.deepEqual(result.response, {
      clientDataJSON: 'Aw',
      authenticatorData: 'BA',
      signature: 'BQ',
      userHandle: null,
    })
  })

  it('throws when the browser returns no credential', async (t) => {
    t.after(
      stubNavigator({
        credentials: { get: async () => null },
      }),
    )

    await assert.rejects(
      getPasskey({
        challenge: 'AAEC',
        timeout: 1000,
        rpId: 'example.com',
        allowCredentials: [],
        userVerification: 'preferred',
      }),
      { message: 'Passkey sign-in was cancelled.' },
    )
  })
})
