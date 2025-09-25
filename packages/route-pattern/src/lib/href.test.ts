import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { MissingParamError, createHrefBuilder } from './href.ts'
import { RoutePattern } from './route-pattern.ts'
import { createRoutes } from './route-map.ts'

describe('href', () => {
  it('makes absolute hrefs when no host is provided', () => {
    let href = createHrefBuilder()
    assert.equal(href('products/:id', { id: '1' }), '/products/1')
  })

  it('accepts a RoutePattern directly', () => {
    let href = createHrefBuilder()
    assert.equal(href(new RoutePattern('products/:id'), { id: '1' }), '/products/1')
  })

  it('works with a RouteMap', () => {
    let routes = createRoutes({ products: '/products/:id' })
    let href = createHrefBuilder<typeof routes>()
    assert.equal(href('/products/:id', { id: '1' }), '/products/1')
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

  // A "trailing wildcard" is a wildcard at the end of a pattern that immediately follows a slash
  describe('trailing wildcards', () => {
    it('does not throw when param is missing', () => {
      let href = createHrefBuilder()
      assert.equal(href('products/*path', {}), '/products')
      assert.equal(href('products/:id/*path', { id: '1' }), '/products/1')
      assert.equal(href('products/*', {}), '/products')
      assert.equal(href('products/:id/*', { id: '1' }), '/products/1')
    })

    it('omits the trailing slash when param is empty string', () => {
      let href = createHrefBuilder()
      assert.equal(href('products/*path', { path: '' }), '/products')
      assert.equal(href('products/:id/*path', { id: '1', path: '' }), '/products/1')
      assert.equal(href('products/*', { '*': '' }), '/products')
      assert.equal(href('products/:id/*', { id: '1', '*': '' }), '/products/1')
    })
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
})
