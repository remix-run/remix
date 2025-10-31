import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { RequestContext } from './request-context.ts'
import { Session } from '@remix-run/session'

describe('new RequestContext()', () => {
  it('has a header object that is SuperHeaders', () => {
    let req = new Request('http://localhost:3000/test', {
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

  it('handles sessions with a default empty session if none exist', () => {
    let req = new Request('http://localhost:3000/', {})
    let context = new RequestContext(req)

    // Default/empty session
    assert.equal(context.session.id, '')

    let session = new Session({}, 'test')
    context._session = session
    assert.equal(context.session?.id, 'test')
  })
})
