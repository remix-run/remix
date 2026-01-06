import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
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
})
