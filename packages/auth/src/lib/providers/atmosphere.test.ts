import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { createCookie } from '@remix-run/cookie'
import { createRouter } from '@remix-run/fetch-router'
import { Session } from '@remix-run/session'
import { createCookieSessionStorage } from '@remix-run/session/cookie-storage'
import { createMemorySessionStorage } from '@remix-run/session/memory-storage'
import { session as sessionMiddleware } from '@remix-run/session-middleware'

import { finishExternalAuth } from '../finish-external-auth.ts'
import { startExternalAuth } from '../start-external-auth.ts'
import { createRequest, mockFetch } from '../test-utils.ts'
import { createAtmosphereAuthProvider } from './atmosphere.ts'

describe('atmosphere provider', () => {
  it('resolves a handle through DNS-over-HTTPS, performs PAR with DPoP, and completes the callback', async () => {
    let cookie = createCookie('__session', { secrets: ['secret1'] })
    let sessionStorage = createCookieSessionStorage()
    let dnsRequests = 0
    let parRequests = 0
    let tokenRequests = 0
    let atmosphereProvider = createAtmosphereAuthProvider({
      clientId: 'https://app.example.com/oauth/client-metadata.json',
      redirectUri: 'https://app.example.com/auth/atmosphere/callback',
      sessionSecret: 'atmosphere-session-secret',
      scopes: ['atproto', 'transition:generic'],
    })
    let restoreFetch = mockFetch(async (input, init) => {
      let url = toRequestUrl(input)

      if (url.origin === 'https://1.1.1.1' && url.pathname === '/dns-query') {
        dnsRequests += 1
        assert.equal(url.searchParams.get('name'), '_atproto.alice.example.com')
        assert.equal(url.searchParams.get('type'), 'TXT')
        return Response.json({
          Answer: [
            {
              type: 16,
              data: '"did=did:plc:alice"',
            },
          ],
        })
      }

      if (url.toString() === 'https://alice.example.com/.well-known/atproto-did') {
        return new Response('<!DOCTYPE html><html><body>Not a DID</body></html>', {
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
          },
        })
      }

      if (url.toString() === 'https://plc.directory/did%3Aplc%3Aalice') {
        return Response.json({
          id: 'did:plc:alice',
          alsoKnownAs: ['at://alice.example.com'],
          service: [
            {
              id: '#atproto_pds',
              type: 'AtprotoPersonalDataServer',
              serviceEndpoint: 'https://pds.example.com',
            },
          ],
        })
      }

      if (url.toString() === 'https://pds.example.com/.well-known/oauth-protected-resource') {
        return Response.json({
          authorization_servers: ['https://auth.example.com'],
        })
      }

      if (url.toString() === 'https://auth.example.com/.well-known/oauth-authorization-server') {
        return Response.json(
          createAtmosphereAuthorizationServerMetadata('https://auth.example.com'),
        )
      }

      if (url.toString() === 'https://auth.example.com/oauth/par') {
        parRequests += 1

        let body = new URLSearchParams(init?.body as string)
        let dpop = decodeJwt(new Headers(init?.headers).get('DPoP')!)

        assert.equal(body.get('client_id'), 'https://app.example.com/oauth/client-metadata.json')
        assert.equal(body.get('redirect_uri'), 'https://app.example.com/auth/atmosphere/callback')
        assert.equal(body.get('response_type'), 'code')
        assert.equal(body.get('scope'), 'atproto transition:generic')
        assert.equal(body.get('login_hint'), 'alice.example.com')
        assert.equal(body.get('code_challenge_method'), 'S256')
        assert.equal(typeof body.get('code_challenge'), 'string')
        assert.equal(dpop.payload.htm, 'POST')
        assert.equal(dpop.payload.htu, 'https://auth.example.com/oauth/par')

        if (parRequests === 1) {
          assert.equal(dpop.payload.nonce, undefined)
          return Response.json(
            {
              error: 'use_dpop_nonce',
            },
            {
              status: 400,
              headers: {
                'DPoP-Nonce': 'par-nonce-1',
              },
            },
          )
        }

        assert.equal(dpop.payload.nonce, 'par-nonce-1')
        return Response.json(
          {
            request_uri: 'urn:ietf:params:oauth:request_uri:par-1',
          },
          {
            headers: {
              'DPoP-Nonce': 'token-nonce-1',
            },
          },
        )
      }

      if (url.toString() === 'https://auth.example.com/oauth/token') {
        tokenRequests += 1

        let body = new URLSearchParams(init?.body as string)
        let dpop = decodeJwt(new Headers(init?.headers).get('DPoP')!)

        assert.equal(body.get('client_id'), 'https://app.example.com/oauth/client-metadata.json')
        assert.equal(body.get('grant_type'), 'authorization_code')
        assert.equal(body.get('redirect_uri'), 'https://app.example.com/auth/atmosphere/callback')
        assert.equal(body.get('code'), 'good-code')
        assert.equal(typeof body.get('code_verifier'), 'string')
        assert.equal(dpop.payload.nonce, 'token-nonce-1')

        return Response.json({
          access_token: 'atmosphere-access-token',
          refresh_token: 'atmosphere-refresh-token',
          token_type: 'DPoP',
          scope: 'atproto transition:generic',
          sub: 'did:plc:alice',
        })
      }

      throw new Error(`Unexpected fetch: ${url}`)
    })

    try {
      assert.equal(dnsRequests, 0)
      let router = createRouter({
        middleware: [sessionMiddleware(cookie, sessionStorage)],
      })

      router.get('/login/atmosphere', async (context) => {
        let identifier = context.url.searchParams.get('account')
        if (identifier == null) {
          throw new Error('Missing atmosphere account identifier')
        }

        let provider = await atmosphereProvider.prepare(identifier)

        return startExternalAuth(provider, context)
      })
      router.get('/inspect', ({ get }) => Response.json(get(Session).get('__auth')))
      router.get('/auth/atmosphere/callback', async (context) => {
        let { result } = await finishExternalAuth(atmosphereProvider, context)
        return Response.json(result)
      })

      let loginResponse = await router.fetch(
        'https://app.example.com/login/atmosphere?account=alice.example.com',
      )
      let inspectResponse = await router.fetch(
        createRequest('https://app.example.com/inspect', loginResponse),
      )
      let transaction = await inspectResponse.json()
      let location = new URL(loginResponse.headers.get('Location')!)
      let cookieHeader = loginResponse.headers
        .getSetCookie()
        .map((value) => value.split(';', 1)[0])
        .join('; ')
      let serializedSession = await cookie.parse(cookieHeader)
      let storedSession = JSON.parse(serializedSession!) as {
        i: string
        d: [Record<string, unknown>, Record<string, unknown>]
      }
      let storedTransaction = storedSession.d[0].__auth as Record<string, unknown>

      assert.equal(loginResponse.status, 302)
      assert.equal(
        location.toString(),
        'https://auth.example.com/oauth/authorize?client_id=https%3A%2F%2Fapp.example.com%2Foauth%2Fclient-metadata.json&request_uri=urn%3Aietf%3Aparams%3Aoauth%3Arequest_uri%3Apar-1',
      )
      assert.equal(transaction.provider, 'atmosphere')
      assert.equal(typeof transaction.codeVerifier, 'string')
      assert.equal(typeof transaction.providerState, 'string')
      assert.equal(typeof storedTransaction.providerState, 'string')
      assert.equal(serializedSession!.includes('did:plc:alice'), false)
      assert.equal(serializedSession!.includes('alice.example.com'), false)
      assert.equal(serializedSession!.includes('https://pds.example.com'), false)
      assert.equal(serializedSession!.includes('https://auth.example.com'), false)
      assert.equal(serializedSession!.includes('oauth/token'), false)
      assert.equal(serializedSession!.includes('oauth/par'), false)
      assert.equal(serializedSession!.includes('authorizationServerNonce'), false)
      assert.equal(serializedSession!.includes('token-nonce-1'), false)
      assert.equal(serializedSession!.includes('publicJwk'), false)
      assert.equal(serializedSession!.includes('privateJwk'), false)
      assert.equal(dnsRequests, 1)
      assert.equal(parRequests, 2)

      let callbackResponse = await router.fetch(
        createRequest(
          `https://app.example.com/auth/atmosphere/callback?code=good-code&state=${transaction.state}&iss=${encodeURIComponent('https://auth.example.com')}`,
          loginResponse,
        ),
      )

      assert.equal(tokenRequests, 1)

      let callbackBody = await callbackResponse.json()

      assert.deepEqual(
        {
          provider: callbackBody.provider,
          account: callbackBody.account,
          profile: callbackBody.profile,
          tokens: {
            accessToken: callbackBody.tokens.accessToken,
            refreshToken: callbackBody.tokens.refreshToken,
            tokenType: callbackBody.tokens.tokenType,
            scope: callbackBody.tokens.scope,
            did: callbackBody.tokens.did,
            authorizationServer: callbackBody.tokens.authorizationServer,
          },
        },
        {
          provider: 'atmosphere',
          account: {
            provider: 'atmosphere',
            providerAccountId: 'did:plc:alice',
          },
          profile: {
            did: 'did:plc:alice',
            handle: 'alice.example.com',
            pdsUrl: 'https://pds.example.com',
            authorizationServer: 'https://auth.example.com',
          },
          tokens: {
            accessToken: 'atmosphere-access-token',
            refreshToken: 'atmosphere-refresh-token',
            tokenType: 'DPoP',
            scope: ['atproto', 'transition:generic'],
            did: 'did:plc:alice',
            authorizationServer: {
              issuer: 'https://auth.example.com',
              tokenEndpoint: 'https://auth.example.com/oauth/token',
            },
          },
        },
      )
      assert.deepEqual(callbackBody.tokens.dpop.publicJwk, {
        crv: 'P-256',
        kty: 'EC',
        x: callbackBody.tokens.dpop.publicJwk.x,
        y: callbackBody.tokens.dpop.publicJwk.y,
      })
      assert.equal(typeof callbackBody.tokens.dpop.privateJwk.d, 'string')
      assert.equal(callbackBody.tokens.dpop.privateJwk.crv, 'P-256')
      assert.equal(callbackBody.tokens.dpop.privateJwk.kty, 'EC')
      assert.equal(callbackBody.tokens.dpop.privateJwk.x, callbackBody.tokens.dpop.publicJwk.x)
      assert.equal(callbackBody.tokens.dpop.privateJwk.y, callbackBody.tokens.dpop.publicJwk.y)
      assert.equal(callbackBody.tokens.dpop.nonce, undefined)
    } finally {
      restoreFetch()
    }
  })

  it('supports loopback clients and falls back to HTTPS handle resolution when DNS does not return a DID', async () => {
    let cookie = createCookie('__session', { secrets: ['secret1'] })
    let sessionStorage = createMemorySessionStorage()
    let dnsRequests = 0
    let httpsHandleRequests = 0
    let parClientId: string | undefined
    let restoreFetch = mockFetch(async (input, init) => {
      let url = toRequestUrl(input)

      if (url.origin === 'https://1.1.1.1' && url.pathname === '/dns-query') {
        dnsRequests += 1
        return Response.json({ Answer: [] })
      }

      if (url.toString() === 'https://bob.example.com/.well-known/atproto-did') {
        httpsHandleRequests += 1
        return new Response('did:plc:bob', {
          headers: {
            'Content-Type': 'text/plain',
          },
        })
      }

      if (url.toString() === 'https://plc.directory/did%3Aplc%3Abob') {
        return Response.json({
          id: 'did:plc:bob',
          alsoKnownAs: ['at://bob.example.com'],
          service: [
            {
              id: '#atproto_pds',
              type: 'AtprotoPersonalDataServer',
              serviceEndpoint: 'https://pds.example.com',
            },
          ],
        })
      }

      if (url.toString() === 'https://pds.example.com/.well-known/oauth-protected-resource') {
        return Response.json({
          authorization_servers: ['https://auth.example.com'],
        })
      }

      if (url.toString() === 'https://auth.example.com/.well-known/oauth-authorization-server') {
        return Response.json(
          createAtmosphereAuthorizationServerMetadata('https://auth.example.com'),
        )
      }

      if (url.toString() === 'https://auth.example.com/oauth/par') {
        let body = new URLSearchParams(init?.body as string)
        parClientId = body.get('client_id') ?? undefined

        return Response.json(
          {
            request_uri: 'urn:ietf:params:oauth:request_uri:par-loopback',
          },
          {
            headers: {
              'DPoP-Nonce': 'loopback-token-nonce',
            },
          },
        )
      }

      throw new Error(`Unexpected fetch: ${url}`)
    })

    try {
      let atmosphereProvider = createAtmosphereAuthProvider({
        clientId: 'http://localhost',
        redirectUri: 'http://127.0.0.1:43123/callback',
        sessionSecret: 'atmosphere-session-secret',
        scopes: ['atproto', 'transition:generic'],
      })
      let router = createRouter({
        middleware: [sessionMiddleware(cookie, sessionStorage)],
      })

      router.get('/login/atmosphere', async (context) => {
        let identifier = context.url.searchParams.get('account')
        if (identifier == null) {
          throw new Error('Missing atmosphere account identifier')
        }

        let provider = await atmosphereProvider.prepare(identifier)

        return startExternalAuth(provider, context)
      })

      let response = await router.fetch(
        'https://app.example.com/login/atmosphere?account=bob.example.com',
      )
      let location = new URL(response.headers.get('Location')!)

      assert.equal(response.status, 302)
      assert.equal(dnsRequests, 1)
      assert.equal(httpsHandleRequests, 1)
      assert.equal(location.origin, 'https://auth.example.com')
      assert.equal(location.pathname, '/oauth/authorize')
      assert.equal(
        location.searchParams.get('request_uri'),
        'urn:ietf:params:oauth:request_uri:par-loopback',
      )

      let normalizedClientId = new URL(parClientId!)
      assert.equal(normalizedClientId.origin, 'http://localhost')
      assert.equal(normalizedClientId.searchParams.get('scope'), 'atproto transition:generic')
      assert.deepEqual(normalizedClientId.searchParams.getAll('redirect_uri'), [
        'http://127.0.0.1:43123/callback',
      ])
    } finally {
      restoreFetch()
    }
  })

  it('falls back to HTTPS handle resolution when DNS resolution fails', async () => {
    let cookie = createCookie('__session', { secrets: ['secret1'] })
    let sessionStorage = createMemorySessionStorage()
    let httpsHandleRequests = 0
    let restoreFetch = mockFetch(async (input) => {
      let url = toRequestUrl(input)

      if (url.origin === 'https://1.1.1.1' && url.pathname === '/dns-query') {
        throw new Error('DNS-over-HTTPS unavailable')
      }

      if (url.toString() === 'https://carol.example.com/.well-known/atproto-did') {
        httpsHandleRequests += 1
        return new Response('did:plc:carol')
      }

      if (url.toString() === 'https://plc.directory/did%3Aplc%3Acarol') {
        return Response.json({
          id: 'did:plc:carol',
          alsoKnownAs: ['at://carol.example.com'],
          service: [
            {
              id: '#atproto_pds',
              type: 'AtprotoPersonalDataServer',
              serviceEndpoint: 'https://pds.example.com',
            },
          ],
        })
      }

      if (url.toString() === 'https://pds.example.com/.well-known/oauth-protected-resource') {
        return Response.json({
          authorization_servers: ['https://auth.example.com'],
        })
      }

      if (url.toString() === 'https://auth.example.com/.well-known/oauth-authorization-server') {
        return Response.json(
          createAtmosphereAuthorizationServerMetadata('https://auth.example.com'),
        )
      }

      if (url.toString() === 'https://auth.example.com/oauth/par') {
        return Response.json({
          request_uri: 'urn:ietf:params:oauth:request_uri:par-https-fallback',
        })
      }

      throw new Error(`Unexpected fetch: ${url}`)
    })

    try {
      let atmosphereProvider = createAtmosphereAuthProvider({
        clientId: 'https://app.example.com/oauth/client-metadata.json',
        redirectUri: 'https://app.example.com/auth/atmosphere/callback',
        sessionSecret: 'atmosphere-session-secret',
      })
      let router = createRouter({
        middleware: [sessionMiddleware(cookie, sessionStorage)],
      })

      router.get('/login/atmosphere', async (context) => {
        let provider = await atmosphereProvider.prepare('carol.example.com')
        return startExternalAuth(provider, context)
      })

      let response = await router.fetch('https://app.example.com/login/atmosphere')
      let location = new URL(response.headers.get('Location')!)

      assert.equal(response.status, 302)
      assert.equal(httpsHandleRequests, 1)
      assert.equal(
        location.searchParams.get('request_uri'),
        'urn:ietf:params:oauth:request_uri:par-https-fallback',
      )
    } finally {
      restoreFetch()
    }
  })

  it('resolves path-based did:web documents', async () => {
    let cookie = createCookie('__session', { secrets: ['secret1'] })
    let sessionStorage = createMemorySessionStorage()
    let didWebDocumentRequests = 0
    let restoreFetch = mockFetch(async (input) => {
      let url = toRequestUrl(input)

      if (url.toString() === 'https://example.com/users/alice/did.json') {
        didWebDocumentRequests += 1
        return Response.json({
          id: 'did:web:example.com:users:alice',
          alsoKnownAs: ['at://alice.example.com'],
          service: [
            {
              id: '#atproto_pds',
              type: 'AtprotoPersonalDataServer',
              serviceEndpoint: 'https://pds.example.com',
            },
          ],
        })
      }

      if (url.toString() === 'https://pds.example.com/.well-known/oauth-protected-resource') {
        return Response.json({
          authorization_servers: ['https://auth.example.com'],
        })
      }

      if (url.toString() === 'https://auth.example.com/.well-known/oauth-authorization-server') {
        return Response.json(
          createAtmosphereAuthorizationServerMetadata('https://auth.example.com'),
        )
      }

      if (url.toString() === 'https://auth.example.com/oauth/par') {
        return Response.json({
          request_uri: 'urn:ietf:params:oauth:request_uri:par-did-web',
        })
      }

      throw new Error(`Unexpected fetch: ${url}`)
    })

    try {
      let atmosphereProvider = createAtmosphereAuthProvider({
        clientId: 'https://app.example.com/oauth/client-metadata.json',
        redirectUri: 'https://app.example.com/auth/atmosphere/callback',
        sessionSecret: 'atmosphere-session-secret',
      })
      let router = createRouter({
        middleware: [sessionMiddleware(cookie, sessionStorage)],
      })

      router.get('/login/atmosphere', async (context) => {
        let provider = await atmosphereProvider.prepare('did:web:example.com:users:alice')
        return startExternalAuth(provider, context)
      })

      let response = await router.fetch('https://app.example.com/login/atmosphere')
      let location = new URL(response.headers.get('Location')!)

      assert.equal(response.status, 302)
      assert.equal(didWebDocumentRequests, 1)
      assert.equal(
        location.searchParams.get('request_uri'),
        'urn:ietf:params:oauth:request_uri:par-did-web',
      )
    } finally {
      restoreFetch()
    }
  })

  it('requires prepare before starting auth', async () => {
    let cookie = createCookie('__session', { secrets: ['secret1'] })
    let sessionStorage = createMemorySessionStorage()
    let atmosphereProvider = createAtmosphereAuthProvider({
      clientId: 'http://localhost',
      redirectUri: 'http://127.0.0.1:43123/callback',
      sessionSecret: 'atmosphere-session-secret',
    })
    let router = createRouter({
      middleware: [sessionMiddleware(cookie, sessionStorage)],
    })

    router.get('/login/atmosphere', (context) => startExternalAuth(atmosphereProvider, context))

    await assert.rejects(
      () => router.fetch('https://app.example.com/login/atmosphere'),
      /provider\.prepare\(handleOrDid\)/,
    )
  })

  it('rejects localhost loopback redirect URIs', async () => {
    assert.throws(
      () =>
        createAtmosphereAuthProvider({
          clientId: 'http://localhost',
          redirectUri: 'http://localhost:3000/callback',
          sessionSecret: 'atmosphere-session-secret',
        }),
      /127\.0\.0\.1 or \[::1\], not localhost/,
    )
  })
})

function createAtmosphereAuthorizationServerMetadata(issuer: string) {
  return {
    issuer,
    authorization_endpoint: `${issuer}/oauth/authorize`,
    token_endpoint: `${issuer}/oauth/token`,
    pushed_authorization_request_endpoint: `${issuer}/oauth/par`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none', 'private_key_jwt'],
    token_endpoint_auth_signing_alg_values_supported: ['ES256'],
    scopes_supported: ['atproto', 'transition:generic'],
    authorization_response_iss_parameter_supported: true,
    require_pushed_authorization_requests: true,
    client_id_metadata_document_supported: true,
    dpop_signing_alg_values_supported: ['ES256'],
  }
}

function toRequestUrl(input: RequestInfo | URL): URL {
  if (typeof input === 'string') {
    return new URL(input)
  }

  if (input instanceof URL) {
    return input
  }

  return new URL(input.url)
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
