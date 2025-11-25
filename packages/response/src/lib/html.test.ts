import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { html as safeHtml } from '@remix-run/html-template'

import { createHtmlResponse } from './html.ts'

describe('createHtmlResponse()', () => {
  it('creates a Response with HTML content-type header', async () => {
    let response = createHtmlResponse('<h1>Hello</h1>')
    assert.equal(response.headers.get('Content-Type'), 'text/html; charset=UTF-8')
    assert.equal(await response.text(), '<!DOCTYPE html><h1>Hello</h1>')
  })

  it('preserves custom headers and status from init', async () => {
    let response = createHtmlResponse('<h1>Hello</h1>', {
      headers: { 'X-Custom': 'a' },
      status: 201,
    })
    assert.equal(response.headers.get('Content-Type'), 'text/html; charset=UTF-8')
    assert.equal(response.headers.get('X-Custom'), 'a')
    assert.equal(response.status, 201)
    assert.equal(await response.text(), '<!DOCTYPE html><h1>Hello</h1>')
  })

  it('allows overriding Content-Type header', async () => {
    let response = createHtmlResponse('<h1>Hello</h1>', {
      headers: { 'Content-Type': 'text/plain' },
    })
    assert.equal(response.headers.get('Content-Type'), 'text/plain')
  })

  it('accepts SafeHtml from escape tag without re-escaping', async () => {
    let snippet = safeHtml`<strong>${'Hi'}</strong>`
    let response = createHtmlResponse(snippet)
    assert.equal(await response.text(), '<!DOCTYPE html><strong>Hi</strong>')
  })

  describe('DOCTYPE prepending', () => {
    describe('string body', () => {
      it('prepends DOCTYPE to string body', async () => {
        let response = createHtmlResponse('<html><body>Hello</body></html>')
        assert.equal(await response.text(), '<!DOCTYPE html><html><body>Hello</body></html>')
      })

      it('does not prepend DOCTYPE if already present', async () => {
        let response = createHtmlResponse('<!DOCTYPE html><html><body>Hello</body></html>')
        assert.equal(await response.text(), '<!DOCTYPE html><html><body>Hello</body></html>')
      })

      it('handles DOCTYPE with leading whitespace', async () => {
        let response = createHtmlResponse('  <!DOCTYPE html><html><body>Hello</body></html>')
        assert.equal(await response.text(), '  <!DOCTYPE html><html><body>Hello</body></html>')
      })

      it('handles DOCTYPE case-insensitively', async () => {
        let response = createHtmlResponse('<!doctype html><html><body>Hello</body></html>')
        assert.equal(await response.text(), '<!doctype html><html><body>Hello</body></html>')
      })
    })

    describe('SafeHtml body', () => {
      it('prepends DOCTYPE to SafeHtml body', async () => {
        let snippet = safeHtml`<html><body>Hello</body></html>`
        let response = createHtmlResponse(snippet)
        assert.equal(await response.text(), '<!DOCTYPE html><html><body>Hello</body></html>')
      })

      it('does not prepend DOCTYPE if already present in SafeHtml', async () => {
        let snippet = safeHtml`<!DOCTYPE html><html><body>Hello</body></html>`
        let response = createHtmlResponse(snippet)
        assert.equal(await response.text(), '<!DOCTYPE html><html><body>Hello</body></html>')
      })
    })

    describe('Blob body', () => {
      it('prepends DOCTYPE to Blob body', async () => {
        let blob = new Blob(['<html><body>Hello</body></html>'], { type: 'text/html' })
        let response = createHtmlResponse(blob)
        assert.equal(await response.text(), '<!DOCTYPE html><html><body>Hello</body></html>')
      })

      it('does not prepend DOCTYPE if already present in Blob', async () => {
        let blob = new Blob(['<!DOCTYPE html><html><body>Hello</body></html>'], {
          type: 'text/html',
        })
        let response = createHtmlResponse(blob)
        assert.equal(await response.text(), '<!DOCTYPE html><html><body>Hello</body></html>')
      })
    })

    describe('ArrayBuffer body', () => {
      it('prepends DOCTYPE to ArrayBuffer body', async () => {
        let buffer = new TextEncoder().encode('<html><body>Hello</body></html>')
        let response = createHtmlResponse(buffer.buffer)
        assert.equal(await response.text(), '<!DOCTYPE html><html><body>Hello</body></html>')
      })

      it('does not prepend DOCTYPE if already present in ArrayBuffer', async () => {
        let buffer = new TextEncoder().encode('<!DOCTYPE html><html><body>Hello</body></html>')
        let response = createHtmlResponse(buffer.buffer)
        assert.equal(await response.text(), '<!DOCTYPE html><html><body>Hello</body></html>')
      })
    })

    describe('Uint8Array body', () => {
      it('prepends DOCTYPE to Uint8Array body', async () => {
        let buffer = new TextEncoder().encode('<html><body>Hello</body></html>')
        let response = createHtmlResponse(buffer)
        assert.equal(await response.text(), '<!DOCTYPE html><html><body>Hello</body></html>')
      })

      it('does not prepend DOCTYPE if already present in Uint8Array', async () => {
        let buffer = new TextEncoder().encode('<!DOCTYPE html><html><body>Hello</body></html>')
        let response = createHtmlResponse(buffer)
        assert.equal(await response.text(), '<!DOCTYPE html><html><body>Hello</body></html>')
      })
    })

    describe('DataView body', () => {
      it('prepends DOCTYPE to DataView body', async () => {
        let buffer = new TextEncoder().encode('<html><body>Hello</body></html>')
        let dataView = new DataView(buffer.buffer)
        let response = createHtmlResponse(dataView)
        assert.equal(await response.text(), '<!DOCTYPE html><html><body>Hello</body></html>')
      })

      it('does not prepend DOCTYPE if already present in DataView', async () => {
        let buffer = new TextEncoder().encode('<!DOCTYPE html><html><body>Hello</body></html>')
        let dataView = new DataView(buffer.buffer)
        let response = createHtmlResponse(dataView)
        assert.equal(await response.text(), '<!DOCTYPE html><html><body>Hello</body></html>')
      })
    })

    describe('ReadableStream body', () => {
      it('prepends DOCTYPE to ReadableStream body', async () => {
        let stream = new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('<html><body>Hello</body></html>'))
            controller.close()
          },
        })
        let response = createHtmlResponse(stream)
        assert.equal(await response.text(), '<!DOCTYPE html><html><body>Hello</body></html>')
      })

      it('does not prepend DOCTYPE if already present in ReadableStream', async () => {
        let stream = new ReadableStream({
          start(controller) {
            controller.enqueue(
              new TextEncoder().encode('<!DOCTYPE html><html><body>Hello</body></html>'),
            )
            controller.close()
          },
        })
        let response = createHtmlResponse(stream)
        assert.equal(await response.text(), '<!DOCTYPE html><html><body>Hello</body></html>')
      })

      it('handles empty ReadableStream', async () => {
        let stream = new ReadableStream({
          start(controller) {
            controller.close()
          },
        })
        let response = createHtmlResponse(stream)
        assert.equal(await response.text(), '<!DOCTYPE html>')
      })

      it('handles multi-chunk ReadableStream', async () => {
        let stream = new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('<html>'))
            controller.enqueue(new TextEncoder().encode('<body>'))
            controller.enqueue(new TextEncoder().encode('Hello</body></html>'))
            controller.close()
          },
        })
        let response = createHtmlResponse(stream)
        assert.equal(await response.text(), '<!DOCTYPE html><html><body>Hello</body></html>')
      })
    })
  })
})
