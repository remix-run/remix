import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createHrefBuilder } from './href.ts'

describe('href', () => {
  it('uses a default protocol', () => {
    let href = createHrefBuilder({ protocol: 'http' })
    assert.equal(href('://remix.run/products/:id', { id: '1' }), 'http://remix.run/products/1')
  })

  it('uses a default hostname', () => {
    let href = createHrefBuilder({ host: 'remix.run' })
    assert.equal(href('products/:id', { id: '1' }), 'https://remix.run/products/1')
  })

  it('makes absolute hrefs when no hostname is provided', () => {
    let href = createHrefBuilder()
    assert.equal(href('products/:id', { id: '1' }), '/products/1')
  })

  it('substitutes * for unnamed wildcards in variants', () => {
    let href = createHrefBuilder()
    assert.equal(href('files/*.jpg', { '*': 'cat/dog' }), '/files/cat/dog.jpg')
  })

  it('uses a valid optional value', () => {
    let href = createHrefBuilder()
    assert.equal(href('products/:id(.:ext)', { id: '1', ext: 'jpg' }), '/products/1.jpg')
    // @ts-expect-error missing param keys
    assert.equal(href('products/:id(.:ext)', { id: '1' }), '/products/1.')
  })

  it('uses a valid enum value', () => {
    let href = createHrefBuilder()
    assert.equal(href('products/:id.{jpg,png}', { id: '1' }), '/products/1.jpg')
  })

  it('enforces type safety', () => {
    let href = createHrefBuilder<'products(/:id)'>()
    // @ts-expect-error invalid variant
    assert.equal(href('does-not-exist'), '/does-not-exist')
    // @ts-expect-error extraneous param arg
    assert.equal(href('://remix.run/about', {}), 'https://remix.run/about')
    // @ts-expect-error missing param arg
    assert.equal(href('products/:id'), '/products/')
    // @ts-expect-error missing param keys
    assert.equal(href('products/:id', {}), '/products/')
    // @ts-expect-error non-string param values
    assert.equal(href('products/:id', { id: 1 }), '/products/1')
  })

  it('fills in params', () => {
    let href = createHrefBuilder({ host: 'remix.run' })
    assert.equal(href('products/:id', { id: '1' }), 'https://remix.run/products/1')
  })

  it('fills in search params', () => {
    let href = createHrefBuilder({ host: 'remix.run' })

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

    assert.equal(href('/search?q=remix', null, { q: 'angular' }), '/search?q=angular')

    assert.equal(href('/search?q=remix', null, { some: 'thing' }), '/search?some=thing')
  })
})
