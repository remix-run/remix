import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { RequestContext } from '@remix-run/fetch-router'

import { apiKey } from './api-key.ts'

function createContext(headers?: HeadersInit): RequestContext {
  return new RequestContext(
    new Request('https://remix.run/private?mode=test', {
      headers,
    }),
  )
}

describe('apiKey scheme', () => {
  it('authenticates valid API keys', async () => {
    let seenKey = ''

    let scheme = apiKey({
      verify(key) {
        seenKey = key
        return { id: 'service-1' }
      },
    })

    let result = await scheme.authenticate(createContext({ 'X-API-Key': 'k_live_123' }))

    assert.deepEqual(result, {
      status: 'success',
      identity: { id: 'service-1' },
    })
    assert.equal(seenKey, 'k_live_123')
  })

  it('skips when API key header is missing', async () => {
    let scheme = apiKey({
      verify() {
        return { id: 'service-1' }
      },
    })

    let result = await scheme.authenticate(createContext())

    assert.equal(result, undefined)
  })

  it('fails when API key header is empty', async () => {
    let scheme = apiKey({
      verify() {
        return { id: 'service-1' }
      },
    })

    let result = await scheme.authenticate(createContext({ 'X-API-Key': '   ' }))

    assert.deepEqual(result, {
      status: 'failure',
      code: 'missing_credentials',
      message: 'X-API-Key header is empty',
    })
  })

  it('fails when key verification fails', async () => {
    let scheme = apiKey({
      verify() {
        return null
      },
    })

    let result = await scheme.authenticate(createContext({ 'X-API-Key': 'bad-key' }))

    assert.deepEqual(result, {
      status: 'failure',
      code: 'invalid_credentials',
      message: 'Invalid credentials',
    })
  })

  it('supports custom header names', async () => {
    let scheme = apiKey({
      headerName: 'X-Service-Key',
      verify(key) {
        if (key === 'svc_123') {
          return { id: 'service-123' }
        }

        return null
      },
    })

    let result = await scheme.authenticate(createContext({ 'X-Service-Key': 'svc_123' }))

    assert.deepEqual(result, {
      status: 'success',
      identity: { id: 'service-123' },
    })
  })
})
