import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { html } from './html.ts'

describe('html(body, init?)', () => {
  it('creates a Response with HTML content-type header', async () => {
    let response = html('<h1>Hello</h1>')
    assert.equal(response.headers.get('Content-Type'), 'text/html; charset=UTF-8')
    assert.equal(await response.text(), '<h1>Hello</h1>')
  })

  it('preserves custom headers and status from init', async () => {
    let response = html('<h1>Hello</h1>', { headers: { 'X-Custom': 'a' }, status: 201 })
    assert.equal(response.headers.get('Content-Type'), 'text/html; charset=UTF-8')
    assert.equal(response.headers.get('X-Custom'), 'a')
    assert.equal(response.status, 201)
  })

  it('allows overriding Content-Type header', async () => {
    let response = html('<h1>Hello</h1>', { headers: { 'Content-Type': 'text/plain' } })
    assert.equal(response.headers.get('Content-Type'), 'text/plain')
  })

  it('handles ReadableStream body without modification', async () => {
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

  it('accepts SafeHtml from escape tag without re-escaping', async () => {
    let snippet = html.esc`<strong>${'Hi'}</strong>`
    let response = html(snippet)
    assert.equal(await response.text(), '<strong>Hi</strong>')
  })
})

describe('html`...` tagged template returns Response', () => {
  it('escapes special characters and sets Content-Type', async () => {
    let unsafe = '<script>alert(1)</script>'
    let response = html`<p>${unsafe}</p>`
    assert.equal(response.headers.get('Content-Type'), 'text/html; charset=UTF-8')
    assert.equal(await response.text(), '<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>')
  })

  it('treats null/undefined/false as empty, numbers/booleans as strings', async () => {
    let response = html`<div>${null}${undefined}${false}${true}${123}</div>`
    assert.equal(await response.text(), '<div>true123</div>')
  })

  it('flattens arrays recursively and escapes items', async () => {
    let nested = ['<a>', ['<b>'], html.esc`<i>${'x'}</i>`]
    // prettier-ignore
    let response = html`<ul>${nested}</ul>`
    assert.equal(await response.text(), '<ul>&lt;a&gt;&lt;b&gt;<i>x</i></ul>')
  })

  it('preserves nested SafeHtml fragments and supports html.raw', async () => {
    let icon = '<b>OK</b>'
    let inner = html.esc`<span>${'Text'}</span>`
    let response = html`<div>${inner}${html.raw(icon)}</div>`
    assert.equal(await response.text(), '<div><span>Text</span><b>OK</b></div>')
  })
})

describe('html.esc`...`', () => {
  it('escapes special characters', () => {
    let unsafe = '<script>alert(1)</script>'
    let frag = html.esc`<p>${unsafe}</p>`
    assert.equal(String(frag), '<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>')
  })

  it('flattens arrays and preserves nested escapes', () => {
    let items = ['<a>', html.esc`<i>${'x'}</i>`]
    let frag = html.esc`<ul>${items}</ul>`
    assert.equal(String(frag), '<ul>&lt;a&gt;<i>x</i></ul>')
  })

  it('composes with html() to create a Response', async () => {
    let frag = html.esc`<strong>${'<script>alert(1)</script>'}</strong>`
    let response = html(`<p>${frag}</p>`)
    assert.equal(
      await response.text(),
      '<p><strong>&lt;script&gt;alert(1)&lt;/script&gt;</strong></p>',
    )
  })
})

describe('html.raw(value)', () => {
  it('returns a SafeHtml fragment', () => {
    let icon = html.raw('<b>OK</b>')
    assert.equal(String(icon), '<b>OK</b>')
  })

  it('composes with html`...` to create a Response', async () => {
    let icon = html.raw('<b>OK</b>')
    let response = html`<p>${icon}</p>`
    assert.equal(await response.text(), '<p><b>OK</b></p>')
  })
})
