import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { parseDocument } from '../runtime/parse-document.ts'

describe('parseDocument', () => {
  it('preserves document attributes and head content with native HTML parsing', () => {
    let root = parseDocument(
      document,
      '<!doctype html><!-- <html lang="wrong"> -->' +
        '<HTML lang="fr" dir="rtl" data-label="A > B &amp; 🐈" data-other=unquoted>' +
        '<head data-page="next"><title>Next &amp; last</title>' +
        '<script type="application/json">{"html":"<style>p{color:red}</style>","doctype":"<!doctype html>"}</script></head>' +
        '<body class="next"><table><tr><td>Cell</td></tr></table></body></html>',
    )

    assert.equal(root.isConnected, false)
    assert.equal(root.lang, 'fr')
    assert.equal(root.dir, 'rtl')
    assert.equal(root.dataset.label, 'A > B & 🐈')
    assert.equal(root.dataset.other, 'unquoted')
    assert.equal(root.querySelector('head')?.dataset.page, 'next')
    assert.equal(root.querySelector('title')?.textContent, 'Next & last')
    assert.deepEqual(JSON.parse(root.querySelector('script')?.textContent ?? '{}'), {
      html: '<style>p{color:red}</style>',
      doctype: '<!doctype html>',
    })
    assert.equal(root.querySelector('body')?.className, 'next')
    assert.equal(root.querySelector('table > tbody > tr > td')?.textContent, 'Cell')
  })

  it('supplies omitted document elements and handles an empty response', () => {
    let root = parseDocument(document, '<title>Next</title><p>Hello</p>')
    assert.equal(root.querySelector('head > title')?.textContent, 'Next')
    assert.equal(root.querySelector('body > p')?.textContent, 'Hello')
    assert.equal(parseDocument(document, '').innerHTML, '<head></head><body></body>')
  })

  it('keeps scripts and custom elements inactive until insertion and ignores noscript', async (t) => {
    let constructions = 0
    let name = `parse-probe-${crypto.randomUUID()}`
    customElements.define(
      name,
      class extends HTMLElement {
        constructor() {
          super()
          constructions++
        }
      },
    )
    let key = `parse-script-${crypto.randomUUID()}`
    t.after(() => Reflect.deleteProperty(globalThis, key))
    let script = `globalThis[${JSON.stringify(key)}] = true`
    let root = parseDocument(
      document,
      '<html><head><noscript><style>p { color: red }</style></noscript></head><body>' +
        `<${name}></${name}><script>${script}</script>` +
        `<template><script>${script}</script><noscript><img src="/unused"></noscript></template>` +
        '</body></html>',
    )
    let body = root.querySelector('body')
    let template = root.querySelector('template')
    assert.ok(body && template)
    assert.equal(constructions, 0)
    assert.equal(root.querySelector('noscript')?.textContent, '')
    assert.equal(template.content.querySelector('noscript')?.textContent, '')

    let container = document.createElement('div')
    t.after(() => container.remove())
    container.append(...body.childNodes, template.content.cloneNode(true))
    document.body.append(container)
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
    assert.equal(constructions, 1)
    assert.equal(Reflect.get(globalThis, key), undefined)
  })
})
