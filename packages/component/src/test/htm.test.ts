import { describe, it, expect } from 'vitest'
import { html } from '../lib/htm.ts'
import { Fragment } from '../lib/component.ts'
import { jsx } from '../lib/jsx.ts'

function MyComponent() {
  return () => null
}

describe('html tagged template', () => {
  it('creates a basic host element with text child', () => {
    let el = html`<div>hello</div>`
    expect(el).toEqual(jsx('div', { children: 'hello' }))
  })

  it('creates an element with static string props', () => {
    let el = html`<div class="foo" id="bar"></div>`
    expect(el).toEqual(jsx('div', { class: 'foo', id: 'bar' }))
  })

  it('creates an element with dynamic props', () => {
    let cls = 'active'
    let id = 'main'
    let el = html`<div class=${cls} id=${id}></div>`
    expect(el).toEqual(jsx('div', { class: 'active', id: 'main' }))
  })

  it('supports dynamic component types', () => {
    let el = html`<${MyComponent} foo=${'bar'}><//>`
    expect(el).toEqual(jsx(MyComponent, { foo: 'bar' }))
  })

  it('supports dynamic component type with children', () => {
    let el = html`<${MyComponent}>hello<//>`
    expect(el).toEqual(jsx(MyComponent, { children: 'hello' }))
  })

  it('creates self-closing host elements', () => {
    let el = html`<input type="text" />`
    expect(el).toEqual(jsx('input', { type: 'text' }))
  })

  it('creates self-closing elements with no props', () => {
    let el = html`<br />`
    expect(el).toEqual(jsx('br', {}))
  })

  it('creates fragment shorthand', () => {
    let a = html`<div></div>`
    let b = html`<span></span>`
    let el = html`<>${a}${b}</>`
    expect(el).toEqual(jsx(Fragment, { children: [a, b] }))
  })

  it('supports spread props', () => {
    let props = { class: 'foo', id: 'bar' }
    let el = html`<div ...${props}></div>`
    expect(el).toEqual(jsx('div', { class: 'foo', id: 'bar' }))
  })

  it('supports spread props mixed with other props', () => {
    let extra = { class: 'foo' }
    let el = html`<div ...${extra} id="main"></div>`
    expect(el).toEqual(jsx('div', { class: 'foo', id: 'main' }))
  })

  it('creates nested elements', () => {
    let el = html`<ul><li>one</li><li>two</li></ul>`
    expect(el).toEqual(
      jsx('ul', {
        children: [jsx('li', { children: 'one' }), jsx('li', { children: 'two' })],
      }),
    )
  })

  it('supports children from array (map)', () => {
    let items = ['a', 'b', 'c']
    let el = html`<ul>${items.map((i) => html`<li>${i}</li>`)}</ul>`
    expect(el).toEqual(
      jsx('ul', {
        children: [
          jsx('li', { children: 'a' }),
          jsx('li', { children: 'b' }),
          jsx('li', { children: 'c' }),
        ],
      }),
    )
  })

  it('supports boolean attributes', () => {
    let el = html`<input disabled />`
    expect(el).toEqual(jsx('input', { disabled: true }))
  })

  it('supports multiple boolean attributes', () => {
    let el = html`<input disabled readonly />`
    expect(el).toEqual(jsx('input', { disabled: true, readonly: true }))
  })

  it('returns multiple root-level siblings as an array', () => {
    let el = html`<div></div><span></span>`
    expect(el).toEqual([jsx('div', {}), jsx('span', {})])
  })

  it('returns two paragraphs with text as an array', () => {
    let el = html`<p>a</p><p>b</p>`
    expect(el).toEqual([jsx('p', { children: 'a' }), jsx('p', { children: 'b' })])
  })

  it('supports dynamic child interpolation', () => {
    let name = 'world'
    let el = html`<p>hello ${name}!</p>`
    expect(el).toEqual(jsx('p', { children: ['hello ', 'world', '!'] }))
  })

  it('closes dynamic type with </>', () => {
    let el = html`<${MyComponent}></${MyComponent}>`
    expect(el).toEqual(jsx(MyComponent, {}))
  })

  it('skips null child values', () => {
    let el = html`<div>${null}</div>`
    expect(el).toEqual(jsx('div', {}))
  })

  it('skips undefined child values', () => {
    let el = html`<div>${undefined}</div>`
    expect(el).toEqual(jsx('div', {}))
  })

  it('handles deeply nested elements', () => {
    let el = html`<div><p><span>text</span></p></div>`
    expect(el).toEqual(
      jsx('div', {
        children: jsx('p', { children: jsx('span', { children: 'text' }) }),
      }),
    )
  })
})
