import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { formatEventStreamMessage } from './message.ts'

describe('formatEventStreamMessage', () => {
  it('formats data messages', () => {
    let message = formatEventStreamMessage({ data: 'hello' })

    assert.equal(message, 'data: hello\n\n')
  })

  it('formats event id retry and data fields in SSE order', () => {
    let message = formatEventStreamMessage({
      id: '42',
      event: 'update',
      retry: 1000,
      data: 'hello',
    })

    assert.equal(message, 'id: 42\nevent: update\nretry: 1000\ndata: hello\n\n')
  })

  it('formats multiline data as one data field per line', () => {
    let message = formatEventStreamMessage({
      data: 'hello\nworld\r\nagain\r',
    })

    assert.equal(message, 'data: hello\ndata: world\ndata: again\ndata: \n\n')
  })

  it('allows empty data messages', () => {
    let message = formatEventStreamMessage({ data: '' })

    assert.equal(message, 'data: \n\n')
  })

  it('rejects invalid retry values', () => {
    assert.throws(() => formatEventStreamMessage({ retry: -1, data: 'hello' }), RangeError)
    assert.throws(() => formatEventStreamMessage({ retry: 1.5, data: 'hello' }), RangeError)
  })

  it('rejects line breaks in event and id fields', () => {
    assert.throws(() => formatEventStreamMessage({ event: 'bad\nname', data: 'hello' }), TypeError)
    assert.throws(() => formatEventStreamMessage({ id: 'bad\rid', data: 'hello' }), TypeError)
  })
})
