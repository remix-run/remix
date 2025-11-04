import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { RequestContext } from './request-context.ts'

describe('new RequestContext()', () => {
  it('has a header object that is SuperHeaders', () => {
    let req = new Request('https://remix.run/test', {
      headers: {
        'Content-Type': 'application/json',
      },
    })
    let context = new RequestContext(req)

    assert.equal('contentType' in context.headers, true)
    assert.equal('contentType' in context.request.headers, false)
    assert.equal(context.headers.contentType.toString(), 'application/json')
    assert.equal(
      context.headers.contentType.toString(),
      context.request.headers.get('content-type'),
    )
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
