import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { type HrefBuilder, MissingParamError, createHrefBuilder } from './href.ts'
import { RoutePattern } from './route-pattern.ts'
import type { Assert, IsEqual } from '../type-utils.d.ts'

describe('href', () => {
  it('uses a default protocol', () => {
    let href = createHrefBuilder({ protocol: 'http' })
    assert.equal(href('://remix.run/products/:id', { id: '1' }), 'http://remix.run/products/1')
  })

  it('uses a default protocol with a colon', () => {
    let href = createHrefBuilder({ protocol: 'http:' })
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

  it('accepts a RoutePattern directly', () => {
    let href = createHrefBuilder()
    assert.equal(href(new RoutePattern('products/:id'), { id: '1' }), '/products/1')
  })

  it('substitutes * for unnamed wildcards in variants', () => {
    let href = createHrefBuilder()
    assert.equal(href('/files/*.jpg', { '*': 'cat/dog' }), '/files/cat/dog.jpg')
    assert.equal(href('*/files/*.jpg', { '*': 'cat/dog' }), '/cat/dog/files/cat/dog.jpg')
  })

  it('fills in params', () => {
    let href = createHrefBuilder({ host: 'remix.run' })

    assert.equal(href('products/:id', { id: '1' }), 'https://remix.run/products/1')
    assert.equal(href('products/:id', { id: 1 }), 'https://remix.run/products/1')

    assert.equal(
      href('images/*path.png', { path: 'images/hero' }),
      'https://remix.run/images/images/hero.png',
    )

    assert.equal(
      href('images/*.png', { '*': 'images/hero' }),
      'https://remix.run/images/images/hero.png',
    )

    // Use the first member of an enum
    assert.equal(
      href('images/:id.{jpg,png}', { id: 'remix' }),
      'https://remix.run/images/remix.jpg',
    )

    // Include optionals by default
    assert.equal(href('products(.md)'), 'https://remix.run/products.md')

    // Omit optionals with undefined/missing params
    assert.equal(href('products/:id(.:ext)', { id: '1' }), 'https://remix.run/products/1')
    assert.equal(href('products(/:id)', {}), 'https://remix.run/products')
    assert.equal(href('products(/:id)', null), 'https://remix.run/products')
  })

  it('requires a valid pattern', () => {
    let href = createHrefBuilder<'products(/:id)'>()
    // @ts-expect-error invalid pattern
    assert.equal(href('does-not-exist'), '/does-not-exist')
  })

  it('throws when required params are missing', () => {
    let href = createHrefBuilder()
    // @ts-expect-error missing required param
    assert.throws(() => href('products/:id', {}), new MissingParamError('id'))
    // @ts-expect-error missing named wildcard value
    assert.throws(() => href('products/*path', {}), new MissingParamError('path'))
    // @ts-expect-error missing unnamed wildcard value
    assert.throws(() => href('products/*', {}), new MissingParamError('*'))
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
