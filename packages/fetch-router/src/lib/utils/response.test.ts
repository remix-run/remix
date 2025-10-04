import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { html } from './response.ts'

describe('html()', () => {
  it('creates a Response with HTML content-type header', async () => {
    let response = html('<h1>Hello</h1>')

    assert.equal(response.headers.get('Content-Type'), 'text/html; charset=UTF-8')
    assert.equal(await response.text(), '<h1>Hello</h1>')
  })

  it('preserves custom headers from init', async () => {
    let response = html('<h1>Hello</h1>', {
      headers: { 'X-Custom': 'test' },
      status: 201,
    })

    assert.equal(response.headers.get('Content-Type'), 'text/html; charset=UTF-8')
    assert.equal(response.headers.get('X-Custom'), 'test')
    assert.equal(response.status, 201)
  })

  it('allows overriding Content-Type header', async () => {
    let response = html('<h1>Hello</h1>', {
      headers: { 'Content-Type': 'text/plain' },
    })

    assert.equal(response.headers.get('Content-Type'), 'text/plain')
  })

  it('handles ReadableStream content without modification', async () => {
    let stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('<h1>Stream</h1>'))
        controller.close()
      },
    })

    let response = html(stream)

    assert.equal(response.headers.get('Content-Type'), 'text/html; charset=UTF-8')
    assert.equal(await response.text(), '<h1>Stream</h1>')
  })
})
