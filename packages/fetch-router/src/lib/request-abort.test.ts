import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { throwIfRequestAborted } from './request-abort.ts'

describe('throwIfRequestAborted', () => {
  it('does nothing when the request has not aborted', () => {
    let controller = new AbortController()
    throwIfRequestAborted(new Response('ok'), controller.signal)
  })

  it('throws the abort reason when the request has aborted', () => {
    let controller = new AbortController()
    let reason = new Error('Request cancelled')
    controller.abort(reason)

    assert.throws(() => throwIfRequestAborted(undefined, controller.signal), reason)
  })

  it('cancels the body of a response that arrives after the request aborted', async () => {
    let controller = new AbortController()
    let reason = new Error('Request cancelled')
    let cancelled = Promise.withResolvers<unknown>()
    let response = new Response(new ReadableStream({ cancel: cancelled.resolve }))
    controller.abort(reason)

    assert.throws(() => throwIfRequestAborted(response, controller.signal), reason)
    assert.equal(await cancelled.promise, reason)
  })
})
