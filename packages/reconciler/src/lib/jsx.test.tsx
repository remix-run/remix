import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { RECONCILER_FRAGMENT } from '../testing/jsx.ts'
import { RECONCILER_PROP_KEYS, RECONCILER_PROP_SHAPE } from '../testing/jsx.ts'
import { Fragment, jsx, jsxs } from '../testing/jsx-runtime.ts'
import type { Component } from '../testing/jsx-runtime.ts'

describe('testing jsx runtime', () => {
  it('creates a branded host element', () => {
    let host = <view id="x" />
    assert.equal(host.$rmx, true)
    assert.equal(host.type, 'view')
    assert.equal(host.key, null)
    assert.equal(host.props.id, 'x')
  })

  it('extracts key from props', () => {
    let element = <view key="props-key" id="x" />
    assert.equal(element.key, 'props-key')
    assert.equal('key' in element.props, false)
  })

  it('supports explicit key and jsxs', () => {
    let a = jsx('view', null, 'explicit')
    let b = jsxs('view', { id: 'x', children: ['a', 'b'] })
    assert.equal(a.key, 'explicit')
    assert.equal(b.props.id, 'x')
  })

  it('exports reconciler-compatible fragment symbol', () => {
    assert.equal(Fragment, RECONCILER_FRAGMENT)
  })

  it('tracks prop metadata for routing', () => {
    let element = <view on={{}} data-id="123" children="x" />
    assert.deepEqual(element[RECONCILER_PROP_KEYS], ['on', 'data-id'])
    assert.equal(element[RECONCILER_PROP_SHAPE], 'on\u0001data-id')
  })

  it('supports component setup typing', () => {
    let Comp: Component<number, { name: string }> = (_handle, _setup) => (props) => (
      <view>{props.name}</view>
    )
    let componentElement = <Comp setup={1} name="hello" />
    assert.equal(componentElement.type, Comp)
  })
})
