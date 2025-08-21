import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createHrefBuilder } from './href.ts'

describe('href', () => {
  it('uses a default protocol', () => {
    let href = createHrefBuilder<'://remix.run/products(/:id)'>({ protocol: 'http' })
    assert.equal(href('://remix.run/products/:id', { id: '1' }), 'http://remix.run/products/1')
  })

  it('uses a default hostname', () => {
    let href = createHrefBuilder<'products(/:id)'>({ host: 'remix.run' })
    assert.equal(href('products/:id', { id: '1' }), 'https://remix.run/products/1')
  })

  it('makes absolute hrefs when no hostname is provided', () => {
    let href = createHrefBuilder<'products(/:id)'>()
    assert.equal(href('products/:id', { id: '1' }), '/products/1')
  })

  it('fills in params', () => {
    let href = createHrefBuilder<'products(/:id)'>({ host: 'remix.run' })

    assert.equal(href('products/:id', { id: '1' }), 'https://remix.run/products/1')

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

  it('fills in search params', () => {
    let href = createHrefBuilder<'products(/:id)'>({ host: 'remix.run' })

    assert.equal(
      href('products/:id', { id: '1' }, { sort: 'asc' }),
      'https://remix.run/products/1?sort=asc',
    )

    assert.equal(
      href('products/:id', { id: '1' }, { sort: 'asc', limit: '10' }),
      'https://remix.run/products/1?sort=asc&limit=10',
    )

    assert.equal(
      href('products/:id', { id: '1' }, 'sort=asc&limit=10'),
      'https://remix.run/products/1?sort=asc&limit=10',
    )

    assert.equal(
      href('products/:id', { id: '1' }, new URLSearchParams('sort=asc&limit=10')),
      'https://remix.run/products/1?sort=asc&limit=10',
    )

    assert.equal(
      href('products/:id', { id: '1' }, [
        ['sort', 'asc'],
        ['limit', '10'],
      ]),
      'https://remix.run/products/1?sort=asc&limit=10',
    )
  })
})
