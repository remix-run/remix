import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { Assert, IsEqual } from './type-utils.ts'
import { Route, createRoutes as route } from './route-map.ts'

describe('createRoutes', () => {
  it('creates a route map', () => {
    let routes = route({
      home: '/',
      about: {
        index: 'about',
        company: 'about/company',
      },
    })

    assert.deepEqual(routes.home, new Route('ANY', '/'))
    assert.deepEqual(routes.about.index, new Route('ANY', '/about'))
    assert.deepEqual(routes.about.company, new Route('ANY', '/about/company'))
  })

  it('creates a route map with a base', () => {
    let routes = route('categories', {
      index: '/',
      new: '/new',
      show: '/:slug',
      edit: '/:slug/edit',
    })

    assert.deepEqual(routes.index, new Route('ANY', '/categories'))
    assert.deepEqual(routes.new, new Route('ANY', '/categories/new'))
    assert.deepEqual(routes.show, new Route('ANY', '/categories/:slug'))
    assert.deepEqual(routes.edit, new Route('ANY', '/categories/:slug/edit'))
  })

  it('creates a route map with a nested route map', () => {
    let categoriesRoutes = route('categories', {
      index: '/',
      new: '/new',
      show: '/:slug',
      edit: '/:slug/edit',
    })

    let routes = route({
      home: '/',
      about: '/about',
      // nested route map
      categories: categoriesRoutes,
    })

    assert.deepEqual(routes.home, new Route('ANY', '/'))
    assert.deepEqual(routes.about, new Route('ANY', '/about'))
    assert.deepEqual(routes.categories.index, new Route('ANY', '/categories'))
    assert.deepEqual(routes.categories.new, new Route('ANY', '/categories/new'))
    assert.deepEqual(routes.categories.show, new Route('ANY', '/categories/:slug'))
    assert.deepEqual(routes.categories.edit, new Route('ANY', '/categories/:slug/edit'))
  })

  it('creates nested routes using object spread syntax', () => {
    let routes = route({
      home: '/',
      ...route('posts', {
        posts: '/',
        editPost: '/:slug/edit',
      }),
    })

    assert.deepEqual(routes.home, new Route('ANY', '/'))
    assert.deepEqual(routes.posts, new Route('ANY', '/posts'))
    assert.deepEqual(routes.editPost, new Route('ANY', '/posts/:slug/edit'))
  })
})

let categoriesRoutes = route('categories', {
  index: '/',
  create: { method: 'POST', pattern: '/:slug/edit' },
  products: {
    index: '/:slug/products',
  },
})

let routes = route({
  home: '/',
  promo: '(/:lang)/promo',
  about: {
    index: 'about',
    company: 'about/company',
  },
  blog: {
    index: '/blog',
    show: '/blog(/:lang)/:slug',
  },
  category: '/categories/:slug',
  categories: categoriesRoutes,
})

type Tests = [
  Assert<IsEqual<typeof categoriesRoutes.index, Route<'ANY', '/categories'>>>,
  Assert<IsEqual<typeof categoriesRoutes.create, Route<'POST', '/categories/:slug/edit'>>>,
  Assert<
    IsEqual<typeof categoriesRoutes.products.index, Route<'ANY', '/categories/:slug/products'>>
  >,

  Assert<IsEqual<typeof routes.home, Route<'ANY', '/'>>>,
  Assert<IsEqual<typeof routes.promo, Route<'ANY', '(/:lang)/promo'>>>,
  Assert<IsEqual<typeof routes.about.index, Route<'ANY', '/about'>>>,
  Assert<IsEqual<typeof routes.about.company, Route<'ANY', '/about/company'>>>,
  Assert<IsEqual<typeof routes.blog.index, Route<'ANY', '/blog'>>>,
  Assert<IsEqual<typeof routes.blog.show, Route<'ANY', '/blog(/:lang)/:slug'>>>,
  Assert<IsEqual<typeof routes.category, Route<'ANY', '/categories/:slug'>>>,
  Assert<IsEqual<typeof routes.categories.index, Route<'ANY', '/categories'>>>,
  Assert<IsEqual<typeof routes.categories.create, Route<'POST', '/categories/:slug/edit'>>>,
  Assert<
    IsEqual<typeof routes.categories.products.index, Route<'ANY', '/categories/:slug/products'>>
  >,
]
