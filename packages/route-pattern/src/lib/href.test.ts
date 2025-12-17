import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { MissingParamError, createHrefBuilder } from './href.ts'
import { RoutePattern } from './route-pattern.ts'

describe('href', () => {
  it('makes absolute hrefs when no host is provided', () => {
    let href = createHrefBuilder()
    assert.equal(href('products/:id', { id: '1' }), '/products/1')
  })

  it('works with a RoutePattern', () => {
    let href = createHrefBuilder()
    assert.equal(href(new RoutePattern('products/:id'), { id: '1' }), '/products/1')
  })

  it('substitutes * for unnamed wildcards in variants', () => {
    let href = createHrefBuilder()
    assert.equal(href('/files/*.jpg', { '*': 'cat/dog' }), '/files/cat/dog.jpg')
    assert.equal(href('*/files/*.jpg', { '*': 'cat/dog' }), '/cat/dog/files/cat/dog.jpg')
  })

  it('fills in params', () => {
    let href = createHrefBuilder()

    assert.equal(href('products/:id', { id: '1' }), '/products/1')
    // Number is coerced to string
    assert.equal(href('products/:id', { id: 1 }), '/products/1')

    assert.equal(href('images/*path.png', { path: 'images/hero' }), '/images/images/hero.png')
    assert.equal(href('images/*.png', { '*': 'images/hero' }), '/images/images/hero.png')

    // Include optionals by default
    assert.equal(href('products(.md)'), '/products.md')

    // Omit optionals with undefined/missing params
    assert.equal(href('products/:id(.:ext)', { id: '1' }), '/products/1')
    assert.equal(href('products(/:id)', {}), '/products')
    assert.equal(href('products(/:id)', null), '/products')
  })

  it('requires a valid pattern', () => {
    let href = createHrefBuilder<'products(/:id)'>()
    // @ts-expect-error invalid pattern
    assert.equal(href('does-not-exist'), '/does-not-exist')
  })

  it('throws when required params are missing', () => {
    let href = createHrefBuilder()
    // @ts-expect-error missing required "id" param
    assert.throws(() => href('products/:id', {}), new MissingParamError('id'))
    // @ts-expect-error missing required "category" param
    assert.throws(() => href('*category/products', {}), new MissingParamError('category'))
  })

  it('fills in search params', () => {
    let href = createHrefBuilder()

    assert.equal(href('products/:id', { id: '1' }, { sort: 'asc' }), '/products/1?sort=asc')

    assert.equal(
      href('products/:id', { id: '1' }, { sort: 'asc', limit: '10' }),
      '/products/1?sort=asc&limit=10',
    )

    assert.equal(
      href('products/:id', { id: '1' }, 'sort=asc&limit=10'),
      '/products/1?sort=asc&limit=10',
    )

    assert.equal(
      href('products/:id', { id: '1' }, new URLSearchParams('sort=asc&limit=10')),
      '/products/1?sort=asc&limit=10',
    )

    assert.equal(
      href('products/:id', { id: '1' }, [
        ['sort', 'asc'],
        ['limit', '10'],
      ]),
      '/products/1?sort=asc&limit=10',
    )

    // Preserves existing search params exactly as provided
    assert.equal(href('products/:id?sort=asc&limit=', { id: '1' }), '/products/1?sort=asc&limit=')

    // Swaps out a new value for an existing param
    assert.equal(
      href('https://remix.run/search?q=remix', null, { q: 'angular' }),
      'https://remix.run/search?q=angular',
    )

    // Completely replaces existing search params
    assert.equal(
      href('https://remix.run/search?q=remix', null, { some: 'thing' }),
      'https://remix.run/search?some=thing',
    )
  })

  it('filters out undefined and null search params', () => {
    let href = createHrefBuilder()
    assert.equal(
      href('products/:id', { id: '1' }, { sort: 'asc', filter: undefined }),
      '/products/1?sort=asc',
    )
    assert.equal(
      href('products/:id', { id: '1' }, { sort: 'asc', filter: null }),
      '/products/1?sort=asc',
    )
    assert.equal(href('products/:id', { id: '1' }, { filter: undefined }), '/products/1')
    assert.equal(href('products/:id', { id: '1' }, { filter: null }), '/products/1')
    assert.equal(
      href('products/:id', { id: '1' }, { sort: 'asc', filter: undefined, limit: '10' }),
      '/products/1?sort=asc&limit=10',
    )
  })

  it('does not add trailing ? for empty search params', () => {
    let href = createHrefBuilder()
    assert.equal(href('products/:id', { id: '1' }, {}), '/products/1')
    assert.equal(href('products/:id', { id: '1' }, new URLSearchParams()), '/products/1')
    assert.equal(href('products/:id', { id: '1' }, ''), '/products/1')
    assert.equal(href('products/:id', { id: '1' }, []), '/products/1')
  })

  it('retains port if one is set', () => {
    let href = createHrefBuilder()
    assert.equal(
      href('https://example.com:8080/products/:id', { id: '1' }),
      'https://example.com:8080/products/1',
    )
  })

  it('handles URLs without a pathname', () => {
    let href = createHrefBuilder()
    assert.equal(href('https://example.com', {}), 'https://example.com/')
  })
})
