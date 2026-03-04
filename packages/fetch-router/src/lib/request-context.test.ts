import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createStorageKey } from './app-storage.ts'
import { RequestContext } from './request-context.ts'

describe('new RequestContext()', () => {
  it('provides access to request headers', () => {
    let req = new Request('https://remix.run/test', {
      headers: {
        'Content-Type': 'application/json',
      },
    })
    let context = new RequestContext(req)

    assert.equal(context.headers.get('content-type'), 'application/json')
  })

  it('provides a copy of request headers that can be mutated independently', () => {
    let req = new Request('https://remix.run/test', {
      headers: { 'X-Original': 'value' },
    })
    let context = new RequestContext(req)

    context.headers.set('X-New', 'new-value')
    context.headers.delete('X-Original')

    // context.headers was mutated
    assert.equal(context.headers.get('X-New'), 'new-value')
    assert.equal(context.headers.get('X-Original'), null)

    // original request.headers unchanged
    assert.equal(req.headers.get('X-Original'), 'value')
    assert.equal(req.headers.get('X-New'), null)
  })

  it('does not provide formData on GET requests', () => {
    let req = new Request('https://remix.run/test', {
      method: 'GET',
    })
    let context = new RequestContext(req)
    assert.equal(context.formData, undefined)
  })

  it('provides formData on POST requests', () => {
    let req = new Request('https://remix.run/test', {
      method: 'POST',
    })
    let context = new RequestContext(req)
    assert.ok(context.formData)
  })

  it('sets and gets values in request-scoped storage', () => {
    let key = createStorageKey('hello')
    let context = new RequestContext(new Request('https://remix.run/test'))

    context.set(key, 'world')

    assert.equal(context.get(key), 'world')
  })

  it('gets a default value from request-scoped storage when one is available', () => {
    let key = createStorageKey('hello')
    let context = new RequestContext(new Request('https://remix.run/test'))

    assert.equal(context.get(key), 'hello')
  })

  it('allows `null` as a valid default value in request-scoped storage', () => {
    let key = createStorageKey(null)
    let context = new RequestContext(new Request('https://remix.run/test'))

    assert.equal(context.get(key), null)
  })

  it('throws if a request-scoped value is not set and no default value exists', () => {
    let key = createStorageKey()
    let context = new RequestContext(new Request('https://remix.run/test'))

    assert.throws(() => context.get(key), Error)
  })

  it('checks if a key has a request-scoped value', () => {
    let key = createStorageKey('default')
    let context = new RequestContext(new Request('https://remix.run/test'))

    assert.equal(context.has(key), false)
    context.set(key, 'value')
    assert.equal(context.has(key), true)
  })
})
