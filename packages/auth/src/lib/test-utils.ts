import * as http from 'node:http'
import type { AddressInfo } from 'node:net'

import { SetCookie } from '@remix-run/headers/set-cookie'

import { createCodeChallenge } from './utils.ts'

export function createRequest(
  url: string,
  fromResponse?: Response,
  init: RequestInit = {},
): Request {
  let headers = new Headers(init.headers)

  if (fromResponse != null) {
    let cookieValues = fromResponse.headers
      .getSetCookie()
      .map((value) => new SetCookie(value))
      .map((cookie) => `${cookie.name}=${cookie.value}`)

    if (cookieValues.length > 0) {
      headers.set('Cookie', cookieValues.join('; '))
    }
  }

  return new Request(url, {
    ...init,
    headers,
  })
}

export function mockFetch(
  handler: (input: RequestInfo | URL, init?: RequestInit) => Response | Promise<Response>,
): () => void {
  let originalFetch = globalThis.fetch

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) =>
    handler(input, init)) as typeof fetch

  return () => {
    globalThis.fetch = originalFetch
  }
}

export interface FakeOAuthProfile {
  sub: string
  email?: string
  name?: string
}

export type FakeOAuthServer = {
  origin: string
  close: () => Promise<void>
}

export async function startFakeOAuthServer(
  profile: FakeOAuthProfile = {
    sub: 'fake-user',
    email: 'fake@example.com',
    name: 'Fake User',
  },
): Promise<FakeOAuthServer> {
  return await new Promise((resolve, reject) => {
    let expectedChallenge: string | undefined
    let expectedState: string | undefined
    let accessToken = 'fake-access-token'

    let server = http.createServer(async (req, res) => {
      if (req.url == null) {
        res.statusCode = 400
        res.end('Missing URL')
        return
      }

      let url = new URL(req.url, 'http://127.0.0.1')

      if (req.method === 'GET' && url.pathname === '/.well-known/openid-configuration') {
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json')
        res.end(
          JSON.stringify({
            issuer: originFromAddress(server.address()),
            authorization_endpoint: `${originFromAddress(server.address())}/authorize`,
            token_endpoint: `${originFromAddress(server.address())}/token`,
            userinfo_endpoint: `${originFromAddress(server.address())}/userinfo`,
            code_challenge_methods_supported: ['S256'],
            scopes_supported: ['openid', 'email', 'profile'],
          }),
        )
        return
      }

      if (req.method === 'GET' && url.pathname === '/authorize') {
        expectedState = url.searchParams.get('state') ?? undefined
        expectedChallenge = url.searchParams.get('code_challenge') ?? undefined

        let redirectUri = url.searchParams.get('redirect_uri')
        if (redirectUri == null || expectedState == null || expectedChallenge == null) {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json')
          res.end(
            JSON.stringify({
              error: 'invalid_request',
              error_description: 'Missing redirect_uri, state, or code_challenge',
            }),
          )
          return
        }

        let redirectURL = new URL(redirectUri)
        redirectURL.searchParams.set('code', 'fake-authorization-code')
        redirectURL.searchParams.set('state', expectedState)

        res.statusCode = 302
        res.setHeader('Location', redirectURL.toString())
        res.end()
        return
      }

      if (req.method === 'POST' && url.pathname === '/token') {
        let body = await readRequestBody(req)
        let params = new URLSearchParams(body)
        let codeVerifier = params.get('code_verifier')

        if (
          params.get('code') !== 'fake-authorization-code' ||
          codeVerifier == null ||
          expectedChallenge == null ||
          (await createCodeChallenge(codeVerifier)) !== expectedChallenge
        ) {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json')
          res.end(
            JSON.stringify({
              error: 'invalid_grant',
              error_description: 'Code verifier validation failed',
            }),
          )
          return
        }

        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json')
        res.end(
          JSON.stringify({
            access_token: accessToken,
            token_type: 'Bearer',
            scope: 'openid email profile',
          }),
        )
        return
      }

      if (req.method === 'GET' && url.pathname === '/userinfo') {
        if (req.headers.authorization !== `Bearer ${accessToken}`) {
          res.statusCode = 401
          res.setHeader('Content-Type', 'application/json')
          res.end(
            JSON.stringify({
              error: 'invalid_token',
            }),
          )
          return
        }

        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(profile))
        return
      }

      res.statusCode = 404
      res.end('Not found')
    })

    server.once('error', reject)

    server.listen(0, '127.0.0.1', () => {
      let address = server.address()

      if (address == null || typeof address === 'string') {
        reject(new Error('Failed to resolve fake OAuth server address'))
        return
      }

      resolve({
        origin: originFromAddress(address),
        close: () =>
          new Promise((resolveClose, rejectClose) => {
            server.close((error) => {
              if (error) {
                rejectClose(error)
                return
              }

              resolveClose()
            })
          }),
      })
    })
  })
}

async function readRequestBody(request: http.IncomingMessage): Promise<string> {
  let chunks: Buffer[] = []

  for await (let chunk of request) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }

  return Buffer.concat(chunks).toString('utf8')
}

function originFromAddress(address: string | AddressInfo | null): string {
  if (address == null || typeof address === 'string') {
    throw new Error('Failed to resolve fake OAuth server address')
  }

  return `http://127.0.0.1:${address.port}`
}

type CBORInput =
  | number
  | string
  | boolean
  | null
  | Uint8Array
  | CBORInput[]
  | Map<CBORInput, CBORInput>

export function encodeCBOR(value: CBORInput): Uint8Array<ArrayBuffer> {
  let parts: number[] = []

  function writeHead(major: number, length: number) {
    if (length < 24) {
      parts.push((major << 5) | length)
    } else if (length < 0x100) {
      parts.push((major << 5) | 24, length)
    } else if (length < 0x10000) {
      parts.push((major << 5) | 25, length >> 8, length & 0xff)
    } else {
      parts.push(
        (major << 5) | 26,
        length >>> 24,
        (length >> 16) & 0xff,
        (length >> 8) & 0xff,
        length & 0xff,
      )
    }
  }

  function write(item: CBORInput) {
    if (typeof item === 'number') {
      if (item >= 0) writeHead(0, item)
      else writeHead(1, -1 - item)
    } else if (typeof item === 'string') {
      let bytes = new TextEncoder().encode(item)
      writeHead(3, bytes.length)
      parts.push(...bytes)
    } else if (typeof item === 'boolean') {
      parts.push(item ? 0xf5 : 0xf4)
    } else if (item === null) {
      parts.push(0xf6)
    } else if (item instanceof Uint8Array) {
      writeHead(2, item.length)
      parts.push(...item)
    } else if (Array.isArray(item)) {
      writeHead(4, item.length)
      item.forEach(write)
    } else {
      writeHead(5, item.size)
      for (let [key, entry] of item) {
        write(key)
        write(entry)
      }
    }
  }

  write(value)
  return new Uint8Array(parts)
}

export function base64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64url')
}

export interface SoftwareAuthenticatorOverrides {
  origin?: string
  type?: string
  challenge?: string
  rpId?: string
  flags?: number
  signCount?: number
  userHandle?: string | null
  crossOrigin?: boolean
}

export type SoftwareAuthenticator = Awaited<ReturnType<typeof createSoftwareAuthenticator>>

// A minimal in-memory authenticator that creates real key pairs and signatures, so tests exercise
// the same verification path as browsers.
export async function createSoftwareAuthenticator(
  options: { algorithm?: -7 | -8 | -257; origin?: string; rpId?: string } = {},
) {
  let algorithm = options.algorithm ?? -7
  let defaultOrigin = options.origin ?? 'https://app.example.com'
  let defaultRpId = options.rpId ?? 'example.com'
  let credentialId = crypto.getRandomValues(new Uint8Array(16))
  let signCount = 0

  let keyPair: CryptoKeyPair
  let coseKey: Map<CBORInput, CBORInput>
  if (algorithm === -7) {
    keyPair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
      'sign',
      'verify',
    ])) as CryptoKeyPair
    let jwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey)
    coseKey = new Map<CBORInput, CBORInput>([
      [1, 2],
      [3, -7],
      [-1, 1],
      [-2, Buffer.from(jwk.x!, 'base64url')],
      [-3, Buffer.from(jwk.y!, 'base64url')],
    ])
  } else if (algorithm === -8) {
    keyPair = (await crypto.subtle.generateKey({ name: 'Ed25519' }, true, [
      'sign',
      'verify',
    ])) as CryptoKeyPair
    let jwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey)
    coseKey = new Map<CBORInput, CBORInput>([
      [1, 1],
      [3, -8],
      [-1, 6],
      [-2, Buffer.from(jwk.x!, 'base64url')],
    ])
  } else {
    keyPair = (await crypto.subtle.generateKey(
      {
        name: 'RSASSA-PKCS1-v1_5',
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-256',
      },
      true,
      ['sign', 'verify'],
    )) as CryptoKeyPair
    let jwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey)
    coseKey = new Map<CBORInput, CBORInput>([
      [1, 3],
      [3, -257],
      [-1, Buffer.from(jwk.n!, 'base64url')],
      [-2, Buffer.from(jwk.e!, 'base64url')],
    ])
  }

  function clientDataJSON(
    type: string,
    challenge: string,
    overrides: SoftwareAuthenticatorOverrides,
  ) {
    return new TextEncoder().encode(
      JSON.stringify({
        type: overrides.type ?? type,
        challenge: overrides.challenge ?? challenge,
        origin: overrides.origin ?? defaultOrigin,
        crossOrigin: overrides.crossOrigin ?? false,
      }),
    )
  }

  async function authenticatorData(
    flags: number,
    count: number,
    overrides: SoftwareAuthenticatorOverrides,
    attested?: Uint8Array,
  ) {
    let rpIdHash = new Uint8Array(
      await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(overrides.rpId ?? defaultRpId),
      ),
    )
    let header = new Uint8Array(37)
    header.set(rpIdHash)
    header[32] = overrides.flags ?? flags
    new DataView(header.buffer).setUint32(33, overrides.signCount ?? count)
    return Buffer.concat([header, attested ?? new Uint8Array()])
  }

  async function sign(data: Uint8Array<ArrayBuffer>) {
    if (algorithm === -7) {
      let raw = new Uint8Array(
        await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, keyPair.privateKey, data),
      )
      let integer = (value: Uint8Array) => {
        let start = 0
        while (start < value.length - 1 && value[start] === 0) start++
        let trimmed = value.subarray(start)
        let bytes =
          trimmed[0]! & 0x80 ? Buffer.concat([Buffer.from([0]), trimmed]) : Buffer.from(trimmed)
        return Buffer.concat([Buffer.from([0x02, bytes.length]), bytes])
      }
      let body = Buffer.concat([integer(raw.subarray(0, 32)), integer(raw.subarray(32))])
      return Buffer.concat([Buffer.from([0x30, body.length]), body])
    }

    return Buffer.from(
      await crypto.subtle.sign(
        algorithm === -8 ? 'Ed25519' : 'RSASSA-PKCS1-v1_5',
        keyPair.privateKey,
        data,
      ),
    )
  }

  return {
    credentialId: base64Url(credentialId),

    async register(
      options: { challenge: string; user: { id: string } },
      overrides: SoftwareAuthenticatorOverrides = {},
    ) {
      let attested = Buffer.concat([
        new Uint8Array(16),
        Buffer.from([credentialId.length >> 8, credentialId.length & 0xff]),
        credentialId,
        encodeCBOR(coseKey),
      ])
      // Flags: user present (0x01), user verified (0x04), attested credential data (0x40).
      let authData = await authenticatorData(0x45, signCount, overrides, attested)
      let attestationObject = encodeCBOR(
        new Map<CBORInput, CBORInput>([
          ['fmt', 'none'],
          ['attStmt', new Map()],
          ['authData', authData],
        ]),
      )

      return {
        id: base64Url(credentialId),
        rawId: base64Url(credentialId),
        type: 'public-key',
        response: {
          clientDataJSON: base64Url(
            clientDataJSON('webauthn.create', options.challenge, overrides),
          ),
          attestationObject: base64Url(attestationObject),
          transports: ['internal'],
        },
        clientExtensionResults: {},
      }
    },

    async authenticate(
      options: { challenge: string },
      userId: string,
      overrides: SoftwareAuthenticatorOverrides = {},
    ) {
      signCount++
      let clientData = clientDataJSON('webauthn.get', options.challenge, overrides)
      let authData = await authenticatorData(0x05, signCount, overrides)
      let clientDataHash = new Uint8Array(await crypto.subtle.digest('SHA-256', clientData))
      let signature = await sign(new Uint8Array(Buffer.concat([authData, clientDataHash])))
      let userHandle =
        overrides.userHandle === undefined
          ? base64Url(new TextEncoder().encode(userId))
          : overrides.userHandle

      return {
        id: base64Url(credentialId),
        rawId: base64Url(credentialId),
        type: 'public-key',
        response: {
          clientDataJSON: base64Url(clientData),
          authenticatorData: base64Url(authData),
          signature: base64Url(signature),
          userHandle,
        },
        clientExtensionResults: {},
      }
    },
  }
}
