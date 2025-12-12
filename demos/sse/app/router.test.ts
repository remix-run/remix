import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { router } from './router.tsx'

describe('router', () => {
  describe('home page', () => {
    it('returns 200', async () => {
      let response = await router.fetch(new Request('http://localhost/'))

      assert.equal(response.status, 200)
    })

    it('returns HTML content', async () => {
      let response = await router.fetch(new Request('http://localhost/'))
      let text = await response.text()

      assert.ok(response.headers.get('Content-Type')?.startsWith('text/html'))
      assert.ok(text.includes('<html'))
    })

    it('includes expected content', async () => {
      let response = await router.fetch(new Request('http://localhost/'))
      let text = await response.text()

      assert.ok(text.includes('Server-Sent Events'))
      assert.ok(text.includes('Compression'))
    })

    it('shows limit info when limit param is provided', async () => {
      let response = await router.fetch(new Request('http://localhost/?limit=5'))
      let text = await response.text()

      assert.ok(text.includes('5'))
      assert.ok(text.includes('message'))
    })
  })

  describe('messages endpoint', () => {
    it('returns SSE content type', async () => {
      let controller = new AbortController()
      let response = await router.fetch(
        new Request('http://localhost/messages', { signal: controller.signal }),
      )

      assert.equal(response.headers.get('Content-Type'), 'text/event-stream')
      assert.equal(response.headers.get('Cache-Control'), 'no-cache')

      controller.abort()
    })

    it('streams messages with limit', async () => {
      let response = await router.fetch(new Request('http://localhost/messages?limit=2'))

      assert.ok(response.body)

      let text = await response.text()
      let events = text.split('\n\n').filter((e) => e.trim())

      // Each message has 2 lines: event and data
      assert.equal(events.length, 2)
      assert.ok(text.includes('event: message'))
      assert.ok(text.includes('"count":1'))
      assert.ok(text.includes('"count":2'))
    })
  })

  describe('POST requests', () => {
    it('returns 404 for non-GET requests to home', async () => {
      let response = await router.fetch(new Request('http://localhost/', { method: 'POST' }))

      assert.equal(response.status, 404)
    })

    it('returns 404 for non-GET requests to messages', async () => {
      let response = await router.fetch(
        new Request('http://localhost/messages', { method: 'POST' }),
      )

      assert.equal(response.status, 404)
    })
  })
})
