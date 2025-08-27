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
    // assert.equal(href('/files/*.jpg', { '*': 'cat/dog' }), '/files/cat/dog.jpg')
    //assert.equal(href('*/files/*.jpg', { '*': 'cat/dog' }), 'cat/dog/files/cat/dog.jpg')

    assert.equal(href('files/:id/images/:id.jpg', { id: 'cat' }), '/files/cat/images/cat.jpg')
  })

  it('throws when using optional in href()', () => {
    let href = createHrefBuilder()
    assert.throws(
      // @ts-expect-error missing param keys
      () => href('products/:id(.:ext)', { id: '1' }),
      new Error('Cannot use pattern with optional in href()'),
    )
  })

  it('throws when using enum in href()', () => {
    let href = createHrefBuilder()
    assert.throws(
      () => href('products/:id.{jpg,png}', { id: 'blah' }),
      new Error('Cannot use pattern with enum in href()'),
    )
  })

  it('enforces type safety', () => {
    let href = createHrefBuilder<'products(/:id)'>()
    // @ts-expect-error invalid variant
    assert.equal(href('does-not-exist'), '/does-not-exist')
    // @ts-expect-error extraneous param arg
    assert.equal(href('://remix.run/about', {}), 'https://remix.run/about')
    // @ts-expect-error missing param arg
    assert.throws(() => href('products/:id', {}), new Error('Missing required parameter: id'))
    // @ts-expect-error missing param keys
    assert.throws(() => href('products/:id', {}), new Error('Missing required parameter: id'))
    // @ts-expect-error non-string param values
    assert.equal(href('products/:id', { id: 1 }), '/products/1')
  })

  it('throws when required params are missing', () => {
    let href = createHrefBuilder()
    // @ts-expect-error missing param keys
    assert.throws(() => href('products/:id', {}), new Error('Missing required parameter: id'))
    // @ts-expect-error missing param keys
    assert.throws(() => href('products/*path', {}), new Error('Missing required parameter: path'))
    // @ts-expect-error missing param keys
    assert.throws(() => href('products/*', {}), new Error('Missing required parameter: *'))
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

    assert.equal(
      href('https://remix.run/search?q=remix', null, { q: 'angular' }),
      'https://remix.run/search?q=angular',
    )

    assert.equal(
      href('https://remix.run/search?q=remix', null, { some: 'thing' }),
      'https://remix.run/search?some=thing',
    )
  })
})
