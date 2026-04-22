import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { RequestContext } from '@remix-run/fetch-router'

import { createBearerTokenAuthScheme } from './bearer.ts'

function createContext(headers?: HeadersInit): RequestContext {
  return new RequestContext(
    new Request('https://remix.run/private?mode=test', {
      headers,
    }),
  )
}

describe('bearer scheme', () => {
  it('authenticates valid bearer tokens', async () => {
    let observedToken = ''

    let scheme = createBearerTokenAuthScheme({
      async verify(token) {
        observedToken = token
        return { id: 'u1' }
      },
    })

    let result = await scheme.authenticate(createContext({ Authorization: 'Bearer abc123' }))

    assert.deepEqual(result, {
      status: 'success',
      identity: { id: 'u1' },
    })
    assert.equal(observedToken, 'abc123')
  })

  it('skips when the auth header is missing', async () => {
    let scheme = createBearerTokenAuthScheme({
      verify() {
        return { id: 'u1' }
      },
    })

    let result = await scheme.authenticate(createContext())

    assert.equal(result, undefined)
  })

  it('skips when a different auth scheme is provided', async () => {
    let scheme = createBearerTokenAuthScheme({
      verify() {
        return { id: 'u1' }
      },
    })

    let result = await scheme.authenticate(createContext({ Authorization: 'Basic abc123' }))

    assert.equal(result, null)
  })

  it('fails when the auth header format is malformed', async () => {
    let scheme = createBearerTokenAuthScheme({
      verify() {
        return { id: 'u1' }
      },
    })

    let result = await scheme.authenticate(createContext({ Authorization: 'Bearer' }))

    assert.deepEqual(result, {
      status: 'failure',
      code: 'invalid_credentials',
      message: 'Authorization header is malformed',
      challenge: 'Bearer',
    })
  })

  it('fails when token verification fails', async () => {
    let scheme = createBearerTokenAuthScheme({
      verify() {
        return null
      },
    })

    let result = await scheme.authenticate(createContext({ Authorization: 'Bearer bad-token' }))

    assert.deepEqual(result, {
      status: 'failure',
      code: 'invalid_credentials',
      message: 'Invalid credentials',
      challenge: 'Bearer',
    })
  })

  it('supports custom header, scheme, and challenge settings', async () => {
    let scheme = createBearerTokenAuthScheme({
      headerName: 'X-Auth',
      scheme: 'Token',
      challenge: 'Token realm="internal"',
      verify(token) {
        if (token === 'good') {
          return { id: 'u2' }
        }

        return null
      },
    })

    let success = await scheme.authenticate(createContext({ 'X-Auth': 'Token good' }))
    let skip = await scheme.authenticate(createContext({ 'X-Auth': 'Bearer good' }))

    assert.deepEqual(success, {
      status: 'success',
      identity: { id: 'u2' },
    })
    assert.equal(skip, null)
  })
})
