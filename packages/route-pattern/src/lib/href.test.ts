import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createHrefBuilder } from './href.ts'

describe('href', () => {
  it('fills in params', () => {
    type pattern = 'products(/:id)' | 'foo/*bar' | '://remix.run/about'
    let href = createHrefBuilder<pattern>()
    assert.deepEqual(href('products/:id', { id: '1' }), 'https:///products/1')

    // @ts-expect-error invalid variant
    href('does-not-exist')

    // @ts-expect-error extraneous params arg
    href('://remix.run/about', {})

    // @ts-expect-error missing params arg
    href('products/:id')
    // @ts-expect-error missing params keys
    href('products/:id', {})
    // @ts-expect-error non-string param values
    href('products/:id', { id: 1 })
  })
})
