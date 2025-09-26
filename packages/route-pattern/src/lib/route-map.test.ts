import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { Assert, IsEqual } from './type-utils.ts'
import { RoutePattern } from './route-pattern.ts'
import { createRoutes } from './route-map.ts'

let categoriesRoutes = createRoutes('categories', {
  index: '/',
  edit: '/:slug/edit',
  products: {
    index: '/:slug/products',
  },
})

let routes = createRoutes({
  home: '/',
  promo: '(/:lang)/promo',
  about: {
    index: 'about',
    company: 'about/company',
  },
  blog: {
    index: '/blog',
    post: '/blog(/:lang)/:slug',
  },
  category: '/categories/:slug',
  categories: categoriesRoutes,
})

describe('createRoutes', () => {
  it('creates a route map', () => {
    assert.deepEqual(routes.home, new RoutePattern('/'))
    assert.deepEqual(routes.promo, new RoutePattern('(/:lang)/promo'))
    assert.deepEqual(routes.about.index, new RoutePattern('/about'))
    assert.deepEqual(routes.about.company, new RoutePattern('/about/company'))
    assert.deepEqual(routes.blog.index, new RoutePattern('/blog'))
    assert.deepEqual(routes.blog.post, new RoutePattern('/blog(/:lang)/:slug'))
    assert.deepEqual(routes.category, new RoutePattern('/categories/:slug'))
    assert.deepEqual(routes.categories.index, new RoutePattern('/categories'))
    assert.deepEqual(routes.categories.edit, new RoutePattern('/categories/:slug/edit'))
    assert.deepEqual(
      routes.categories.products.index,
      new RoutePattern('/categories/:slug/products'),
    )
  })
})

type Tests = [
  Assert<IsEqual<typeof routes.home, RoutePattern<'/'>>>,
  Assert<IsEqual<typeof routes.promo, RoutePattern<'(/:lang)/promo'>>>,
  Assert<IsEqual<typeof routes.about.index, RoutePattern<'/about'>>>,
  Assert<IsEqual<typeof routes.about.company, RoutePattern<'/about/company'>>>,
  Assert<IsEqual<typeof routes.blog.index, RoutePattern<'/blog'>>>,
  Assert<IsEqual<typeof routes.blog.post, RoutePattern<'/blog(/:lang)/:slug'>>>,
  Assert<IsEqual<typeof routes.category, RoutePattern<'/categories/:slug'>>>,
  Assert<IsEqual<typeof routes.categories.index, RoutePattern<'/categories'>>>,
  Assert<IsEqual<typeof routes.categories.edit, RoutePattern<'/categories/:slug/edit'>>>,
  Assert<
    IsEqual<typeof routes.categories.products.index, RoutePattern<'/categories/:slug/products'>>
  >,
]
