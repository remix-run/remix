import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { html } from './safe-html.ts'

describe('html', () => {
  it('returns a SafeHtml value', () => {
    let value = html`<h1>Hello</h1>`
    assert.equal(String(value), '<h1>Hello</h1>')
  })

  it('escapes special characters', () => {
    let value = html`<h1>${'<script>alert(1)</script>'}</h1>`
    assert.equal(String(value), '<h1>&lt;script&gt;alert(1)&lt;/script&gt;</h1>')
  })

  it('preserves nested SafeHtml fragments', () => {
    let value = html`<h1>${html.raw`<b>Hello</b>`} World</h1>`
    assert.equal(String(value), '<h1><b>Hello</b> World</h1>')
  })

  it('flattens arrays and preserves nested escapes', () => {
    // prettier-ignore
    let value = html`<ul>${['<li>', html.raw`<b>Hello</b>`, '</li>']}</ul>`
    assert.equal(String(value), '<ul>&lt;li&gt;<b>Hello</b>&lt;/li&gt;</ul>')
  })

  it('handles numbers and booleans', () => {
    let value = html`<div>${42} ${true} ${false}</div>`
    assert.equal(String(value), '<div>42 true false</div>')
  })

  it('handles null and undefined', () => {
    let value = html`<div>${null}${undefined}</div>`
    assert.equal(String(value), '<div></div>')
  })

  it('throws when not used as a template tag', () => {
    assert.throws(
      () => {
        // @ts-expect-error - Testing runtime behavior
        html('<div>test</div>')
      },
      { message: 'html must be used as a template tag' },
    )
  })
})

describe('html.raw', () => {
  it('does not escape interpolated strings', () => {
    let rawHtml = '<b>Bold</b>'
    let value = html.raw`<div>${rawHtml}</div>`
    assert.equal(String(value), '<div><b>Bold</b></div>')
  })

  it('does not escape numbers', () => {
    let num = 42
    let value = html.raw`<div>${num}</div>`
    assert.equal(String(value), '<div>42</div>')
  })

  it('does not escape boolean values', () => {
    let bool = true
    let value = html.raw`<div>${bool}</div>`
    assert.equal(String(value), '<div>true</div>')
  })

  it('handles null and undefined', () => {
    let value = html.raw`<div>${null}${undefined}</div>`
    assert.equal(String(value), '<div></div>')
  })

  it('handles false', () => {
    let value = html.raw`<div>${false}</div>`
    assert.equal(String(value), '<div>false</div>')
  })

  it('preserves SafeHtml fragments', () => {
    let icon = html.raw`<i>icon</i>`
    let value = html.raw`<div>${icon}</div>`
    assert.equal(String(value), '<div><i>icon</i></div>')
  })

  it('does not escape dangerous HTML characters', () => {
    let dangerous = '<script>alert("XSS")</script>'
    let value = html.raw`<div>${dangerous}</div>`
    assert.equal(String(value), '<div><script>alert("XSS")</script></div>')
  })

  it('flattens arrays without escaping', () => {
    let items = ['<li>A</li>', '<li>B</li>', '<li>C</li>']
    let value = html.raw`<ul>${items}</ul>`
    assert.equal(String(value), '<ul><li>A</li><li>B</li><li>C</li></ul>')
  })

  it('handles nested arrays', () => {
    let nested = [
      ['<a>', '<b>'],
      ['</b>', '</a>'],
    ]
    let value = html.raw`<div>${nested}</div>`
    assert.equal(String(value), '<div><a><b></b></a></div>')
  })

  it('can be used to build pre-escaped HTML snippets', () => {
    let userInput = '<script>alert(1)</script>'
    let escaped = userInput.replace(/</g, '&lt;').replace(/>/g, '&gt;')
    let value = html.raw`<div class="content">${escaped}</div>`
    assert.equal(String(value), '<div class="content">&lt;script&gt;alert(1)&lt;/script&gt;</div>')
  })

  it('works with multiple interpolations', () => {
    let title = '<h1>Title</h1>'
    let body = '<p>Content</p>'
    let footer = '<footer>Footer</footer>'
    let value = html.raw`<div>${title}${body}${footer}</div>`
    assert.equal(String(value), '<div><h1>Title</h1><p>Content</p><footer>Footer</footer></div>')
  })

  it('throws when not used as a template tag', () => {
    assert.throws(
      () => {
        // @ts-expect-error - Testing runtime behavior
        html.raw('<div>test</div>')
      },
      { message: 'html.raw must be used as a template tag' },
    )
  })
})
