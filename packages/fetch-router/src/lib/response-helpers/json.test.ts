import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { json } from './json.ts'

describe('json()', () => {
  it('creates a Response with JSON content-type header', async () => {
    let response = json({ message: 'Hello' })

    assert.equal(response.headers.get('Content-Type'), 'application/json; charset=UTF-8')
    assert.deepEqual(await response.json(), { message: 'Hello' })
  })

  it('handles arrays and primitive types', async () => {
    let arrayResponse = json([1, 2, 3])
    assert.deepEqual(await arrayResponse.json(), [1, 2, 3])

    let stringResponse = json('test')
    assert.equal(await stringResponse.json(), 'test')

    let numberResponse = json(42)
    assert.equal(await numberResponse.json(), 42)
  })

  it('preserves custom headers and status from init', async () => {
    let response = json(
      { success: true },
      {
        headers: { 'X-Custom': 'test' },
        status: 201,
      },
    )

    assert.equal(response.headers.get('Content-Type'), 'application/json; charset=UTF-8')
    assert.equal(response.headers.get('X-Custom'), 'test')
    assert.equal(response.status, 201)
    assert.deepEqual(await response.json(), { success: true })
  })

  it('allows overriding Content-Type header', async () => {
    let response = json(
      { data: 'test' },
      {
        headers: { 'Content-Type': 'application/vnd.api+json' },
      },
    )

    assert.equal(response.headers.get('Content-Type'), 'application/vnd.api+json')
  })
})
