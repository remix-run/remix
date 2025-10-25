import { describe, it } from 'node:test'
import  assert  from 'node:assert/strict'
import {RequestContext} from "./request-context.ts";

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
    assert.equal(context.headers.contentType.toString(), context.request.headers.get('content-type'))
  })
});