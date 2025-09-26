import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { RoutePattern } from '@remix-run/route-pattern'

import type { Assert, IsEqual } from './type-utils.ts'
import { createResources, createResource } from './resources.ts'
import type { Route } from './router.ts'

describe('createResources', () => {
  it('creates a pattern map and routes', () => {
    let articles = createResources('articles')

    type T1 = [
      Assert<
        IsEqual<
          typeof articles.patterns,
          {
            index: RoutePattern<'/articles'>
            new: RoutePattern<'/articles/new'>
            create: RoutePattern<'/articles'>
            show: RoutePattern<'/articles/:id'>
            edit: RoutePattern<'/articles/:id/edit'>
            update: RoutePattern<'/articles/:id'>
            destroy: RoutePattern<'/articles/:id'>
          }
        >
      >,
    ]

    assert.deepEqual(articles.patterns, {
      index: new RoutePattern('/articles'),
      new: new RoutePattern('/articles/new'),
      create: new RoutePattern('/articles'),
      show: new RoutePattern('/articles/:id'),
      edit: new RoutePattern('/articles/:id/edit'),
      update: new RoutePattern('/articles/:id'),
      destroy: new RoutePattern('/articles/:id'),
    })

    let routes = articles.createRoutes({
      index: () => new Response('Articles'),
      new: () => new Response('New article'),
      create: () => new Response('Create article'),
      show: () => new Response('Show article'),
      edit: () => new Response('Edit article'),
      update: () => new Response('Update article'),
      destroy: () => new Response('Destroy article'),
    })

    type T2 = [
      Assert<
        IsEqual<
          typeof routes,
          [
            Route<'GET', '/articles'>,
            Route<'GET', '/articles/new'>,
            Route<'POST', '/articles'>,
            Route<'GET', '/articles/:id'>,
            Route<'GET', '/articles/:id/edit'>,
            Route<'PUT', '/articles/:id'>,
            Route<'DELETE', '/articles/:id'>,
          ]
        >
      >,
    ]
  })

  it('creates a pattern map and routes with a base path', () => {
    let articles = createResources('articles', { base: '/admin' })

    type T1 = [
      Assert<
        IsEqual<
          typeof articles.patterns,
          {
            index: RoutePattern<'/admin/articles'>
            new: RoutePattern<'/admin/articles/new'>
            create: RoutePattern<'/admin/articles'>
            show: RoutePattern<'/admin/articles/:id'>
            edit: RoutePattern<'/admin/articles/:id/edit'>
            update: RoutePattern<'/admin/articles/:id'>
            destroy: RoutePattern<'/admin/articles/:id'>
          }
        >
      >,
    ]

    assert.deepEqual(articles.patterns, {
      index: new RoutePattern('/admin/articles'),
      new: new RoutePattern('/admin/articles/new'),
      create: new RoutePattern('/admin/articles'),
      show: new RoutePattern('/admin/articles/:id'),
      edit: new RoutePattern('/admin/articles/:id/edit'),
      update: new RoutePattern('/admin/articles/:id'),
      destroy: new RoutePattern('/admin/articles/:id'),
    })

    let routes = articles.createRoutes({
      index: () => new Response('Articles'),
      new: () => new Response('New article'),
      create: () => new Response('Create article'),
      show: () => new Response('Show article'),
      edit: () => new Response('Edit article'),
      update: () => new Response('Update article'),
      destroy: () => new Response('Destroy article'),
    })

    type T2 = [
      Assert<
        IsEqual<
          typeof routes,
          [
            Route<'GET', '/admin/articles'>,
            Route<'GET', '/admin/articles/new'>,
            Route<'POST', '/admin/articles'>,
            Route<'GET', '/admin/articles/:id'>,
            Route<'GET', '/admin/articles/:id/edit'>,
            Route<'PUT', '/admin/articles/:id'>,
            Route<'DELETE', '/admin/articles/:id'>,
          ]
        >
      >,
    ]
  })

  it('creates a pattern map and routes with a specific param', () => {
    let articles = createResources('articles', { param: 'article_id' })

    type T1 = [
      Assert<
        IsEqual<
          typeof articles.patterns,
          {
            index: RoutePattern<'/articles'>
            new: RoutePattern<'/articles/new'>
            create: RoutePattern<'/articles'>
            show: RoutePattern<'/articles/:article_id'>
            edit: RoutePattern<'/articles/:article_id/edit'>
            update: RoutePattern<'/articles/:article_id'>
            destroy: RoutePattern<'/articles/:article_id'>
          }
        >
      >,
    ]

    assert.deepEqual(articles.patterns, {
      index: new RoutePattern('/articles'),
      new: new RoutePattern('/articles/new'),
      create: new RoutePattern('/articles'),
      show: new RoutePattern('/articles/:article_id'),
      edit: new RoutePattern('/articles/:article_id/edit'),
      update: new RoutePattern('/articles/:article_id'),
      destroy: new RoutePattern('/articles/:article_id'),
    })

    let routes = articles.createRoutes({
      index: () => new Response('Articles'),
      new: () => new Response('New article'),
      create: () => new Response('Create article'),
      show: () => new Response('Show article'),
      edit: () => new Response('Edit article'),
      update: () => new Response('Update article'),
      destroy: () => new Response('Destroy article'),
    })

    type T2 = [
      Assert<
        IsEqual<
          typeof routes,
          [
            Route<'GET', '/articles'>,
            Route<'GET', '/articles/new'>,
            Route<'POST', '/articles'>,
            Route<'GET', '/articles/:article_id'>,
            Route<'GET', '/articles/:article_id/edit'>,
            Route<'PUT', '/articles/:article_id'>,
            Route<'DELETE', '/articles/:article_id'>,
          ]
        >
      >,
    ]
  })

  it('creates a pattern map and routes with only specific methods', () => {
    let articles = createResources('articles', { only: ['index', 'show'] })

    type T1 = [
      Assert<
        IsEqual<
          typeof articles.patterns,
          {
            index: RoutePattern<'/articles'>
            show: RoutePattern<'/articles/:id'>
          }
        >
      >,
    ]

    assert.deepEqual(articles.patterns, {
      index: new RoutePattern('/articles'),
      show: new RoutePattern('/articles/:id'),
    })

    let routes = articles.createRoutes({
      index: () => new Response('Articles'),
      show: () => new Response('Show article'),
    })

    type T2 = [
      Assert<IsEqual<typeof routes, [Route<'GET', '/articles'>, Route<'GET', '/articles/:id'>]>>,
    ]
  })
})

describe('createResource', () => {
  it('creates a pattern map and routes', () => {
    let article = createResource('article')

    type T1 = [
      Assert<
        IsEqual<
          typeof article.patterns,
          {
            new: RoutePattern<'/article/new'>
            create: RoutePattern<'/article'>
            show: RoutePattern<'/article'>
            edit: RoutePattern<'/article/edit'>
            update: RoutePattern<'/article'>
            destroy: RoutePattern<'/article'>
          }
        >
      >,
    ]

    assert.deepEqual(article.patterns, {
      new: new RoutePattern('/article/new'),
      create: new RoutePattern('/article'),
      show: new RoutePattern('/article'),
      edit: new RoutePattern('/article/edit'),
      update: new RoutePattern('/article'),
      destroy: new RoutePattern('/article'),
    })

    let routes = article.createRoutes({
      new: () => new Response('New article'),
      create: () => new Response('Create article'),
      show: () => new Response('Show article'),
      edit: () => new Response('Edit article'),
      update: () => new Response('Update article'),
      destroy: () => new Response('Destroy article'),
    })

    type T2 = [
      Assert<
        IsEqual<
          typeof routes,
          [
            Route<'GET', '/article/new'>,
            Route<'POST', '/article'>,
            Route<'GET', '/article'>,
            Route<'GET', '/article/edit'>,
            Route<'PUT', '/article'>,
            Route<'DELETE', '/article'>,
          ]
        >
      >,
    ]
  })

  it('creates a pattern map and routes with a base path', () => {
    let article = createResource('article', { base: '/admin' })

    type T1 = [
      Assert<
        IsEqual<
          typeof article.patterns,
          {
            new: RoutePattern<'/admin/article/new'>
            create: RoutePattern<'/admin/article'>
            show: RoutePattern<'/admin/article'>
            edit: RoutePattern<'/admin/article/edit'>
            update: RoutePattern<'/admin/article'>
            destroy: RoutePattern<'/admin/article'>
          }
        >
      >,
    ]

    assert.deepEqual(article.patterns, {
      new: new RoutePattern('/admin/article/new'),
      create: new RoutePattern('/admin/article'),
      show: new RoutePattern('/admin/article'),
      edit: new RoutePattern('/admin/article/edit'),
      update: new RoutePattern('/admin/article'),
      destroy: new RoutePattern('/admin/article'),
    })

    let routes = article.createRoutes({
      new: () => new Response('New article'),
      create: () => new Response('Create article'),
      show: () => new Response('Show article'),
      edit: () => new Response('Edit article'),
      update: () => new Response('Update article'),
      destroy: () => new Response('Destroy article'),
    })

    type T2 = [
      Assert<
        IsEqual<
          typeof routes,
          [
            Route<'GET', '/admin/article/new'>,
            Route<'POST', '/admin/article'>,
            Route<'GET', '/admin/article'>,
            Route<'GET', '/admin/article/edit'>,
            Route<'PUT', '/admin/article'>,
            Route<'DELETE', '/admin/article'>,
          ]
        >
      >,
    ]
  })

  it('creates a pattern map with only specific methods', () => {
    let article = createResource('article', { only: ['new', 'show'] })

    type T1 = [
      Assert<
        IsEqual<
          typeof article.patterns,
          {
            new: RoutePattern<'/article/new'>
            show: RoutePattern<'/article'>
          }
        >
      >,
    ]

    assert.deepEqual(article.patterns, {
      new: new RoutePattern('/article/new'),
      show: new RoutePattern('/article'),
    })

    let routes = article.createRoutes({
      new: () => new Response('New article'),
      show: () => new Response('Show article'),
    })

    type T2 = [
      Assert<IsEqual<typeof routes, [Route<'GET', '/article/new'>, Route<'GET', '/article'>]>>,
    ]
  })
})
