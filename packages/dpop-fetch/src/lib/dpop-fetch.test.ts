import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createFetch } from './dpop-fetch.ts'

describe('createFetch()', () => {
  it('adds DPoP authorization and proof headers', async () => {
    let dpop = await createDpopBinding()
    let capturedRequest: Request | undefined
    let fetch = createFetch({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresAt: new Date(Date.now() + 60_000),
      dpop,
      fetch(input, init) {
        capturedRequest = new Request(input, init)
        return Promise.resolve(new Response('ok'))
      },
    })

    await fetch('https://pds.example.com/xrpc/app.bsky.actor.getProfile?actor=alice.example.com', {
      headers: {
        Accept: 'application/json',
      },
    })

    assert.ok(capturedRequest)
    let request = capturedRequest!

    assert.equal(request.headers.get('Authorization'), 'DPoP access-token')
    assert.equal(request.headers.get('Accept'), 'application/json')

    let proof = decodeJwt(request.headers.get('DPoP')!)

    assert.equal(proof.header.alg, 'ES256')
    assert.equal(proof.header.typ, 'dpop+jwt')
    assert.deepEqual(proof.header.jwk, dpop.publicJwk)
    assert.equal(proof.payload.htm, 'GET')
    assert.equal(
      proof.payload.htu,
      'https://pds.example.com/xrpc/app.bsky.actor.getProfile?actor=alice.example.com',
    )
    assert.equal(typeof proof.payload.jti, 'string')
    assert.equal(proof.payload.nonce, undefined)
  })

  it('retries once for DPoP nonce challenges and persists the latest nonce', async () => {
    let dpop = await createDpopBinding()
    let proofs: Array<{ payload: Record<string, unknown>; body: string }> = []
    let requestCount = 0
    let fetch = createFetch({
      accessToken: 'access-token',
      dpop,
      fetch: async (input, init) => {
        requestCount += 1

        let request = new Request(input, init)
        proofs.push({
          payload: decodeJwt(request.headers.get('DPoP')!).payload,
          body: await request.text(),
        })

        if (requestCount === 1) {
          return Response.json(
            { error: 'use_dpop_nonce' },
            {
              status: 401,
              headers: {
                'Content-Type': 'application/json',
                'DPoP-Nonce': 'nonce-1',
                'WWW-Authenticate': 'DPoP error="use_dpop_nonce"',
              },
            },
          )
        }

        if (requestCount === 2) {
          return new Response('ok', {
            headers: {
              'DPoP-Nonce': 'nonce-2',
            },
          })
        }

        return new Response('ok')
      },
    })

    await fetch('https://pds.example.com/xrpc/com.atproto.repo.putRecord', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ hello: 'world' }),
    })
    await fetch('https://pds.example.com/xrpc/com.atproto.repo.getRecord')

    assert.equal(requestCount, 3)
    assert.equal(proofs[0].payload.nonce, undefined)
    assert.equal(proofs[1].payload.nonce, 'nonce-1')
    assert.equal(proofs[2].payload.nonce, 'nonce-2')
    assert.equal(proofs[0].body, '{"hello":"world"}')
    assert.equal(proofs[1].body, '{"hello":"world"}')
    assert.equal(proofs[2].body, '')
  })

  it('rejects expired access tokens before sending the request', async () => {
    let dpop = await createDpopBinding()
    let fetch = createFetch({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresAt: new Date(Date.now() - 1_000),
      dpop,
      fetch() {
        throw new Error('unexpected fetch call')
      },
    })

    await assert.rejects(
      () => fetch('https://pds.example.com/xrpc/app.bsky.actor.getProfile'),
      new Error('DPoP access token has expired. Refresh it and create a new fetch instance.'),
    )
  })
})

async function createDpopBinding(): Promise<{
  publicJwk: JsonWebKey
  privateJwk: JsonWebKey
}> {
  let keyPair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
    'sign',
    'verify',
  ])) as CryptoKeyPair
  let publicJwk = (await crypto.subtle.exportKey('jwk', keyPair.publicKey)) as JsonWebKey
  let privateJwk = (await crypto.subtle.exportKey('jwk', keyPair.privateKey)) as JsonWebKey

  return {
    publicJwk: {
      crv: publicJwk.crv,
      kty: publicJwk.kty,
      x: publicJwk.x,
      y: publicJwk.y,
    },
    privateJwk,
  }
}

function decodeJwt(token: string): {
  header: Record<string, unknown>
  payload: Record<string, unknown>
} {
  let [header, payload] = token.split('.')

  return {
    header: JSON.parse(decodeBase64Url(header)),
    payload: JSON.parse(decodeBase64Url(payload)),
  }
}

function decodeBase64Url(value: string): string {
  let padding = value.length % 4 === 0 ? '' : '='.repeat(4 - (value.length % 4))
  let base64 = value.replace(/-/g, '+').replace(/_/g, '/') + padding
  let bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))

  return new TextDecoder().decode(bytes)
}