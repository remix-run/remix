import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createResources, createResource } from './resource.ts'
import { createRouter, createHandlers } from './router.ts'
import type { RequestContext, Route } from './router.ts'
import type { Assert, IsEqual } from './type-utils.ts'

describe('createResources', () => {
  it('creates a route map', () => {
    let articles = createResources('articles')

    type T1 = [
      Assert<
        IsEqual<
          typeof articles,
          {
            index: Route<'GET', '/articles'>
            new: Route<'GET', '/articles/new'>
            create: Route<'POST', '/articles'>
            show: Route<'GET', '/articles/:id'>
            edit: Route<'GET', '/articles/:id/edit'>
            update: Route<'PUT', '/articles/:id'>
            destroy: Route<'DELETE', '/articles/:id'>
          }
        >
      >,
    ]

    assert.deepEqual(articles.index.methods, ['GET'])
    assert.equal(articles.index.pattern.source, '/articles')

    assert.deepEqual(articles.new.methods, ['GET'])
    assert.equal(articles.new.pattern.source, '/articles/new')

    assert.deepEqual(articles.create.methods, ['POST'])
    assert.equal(articles.create.pattern.source, '/articles')

    assert.deepEqual(articles.show.methods, ['GET'])
    assert.equal(articles.show.pattern.source, '/articles/:id')

    assert.deepEqual(articles.edit.methods, ['GET'])
    assert.equal(articles.edit.pattern.source, '/articles/:id/edit')

    assert.deepEqual(articles.update.methods, ['PUT'])
    assert.equal(articles.update.pattern.source, '/articles/:id')

    assert.deepEqual(articles.destroy.methods, ['DELETE'])
    assert.equal(articles.destroy.pattern.source, '/articles/:id')
  })

  it('creates a route map with a base path', () => {
    let articles = createResources('articles', { base: '/admin' })

    type T1 = [
      Assert<
        IsEqual<
          typeof articles,
          {
            index: Route<'GET', '/admin/articles'>
            new: Route<'GET', '/admin/articles/new'>
            create: Route<'POST', '/admin/articles'>
            show: Route<'GET', '/admin/articles/:id'>
            edit: Route<'GET', '/admin/articles/:id/edit'>
            update: Route<'PUT', '/admin/articles/:id'>
            destroy: Route<'DELETE', '/admin/articles/:id'>
          }
        >
      >,
    ]

    assert.deepEqual(articles.index.methods, ['GET'])
    assert.equal(articles.index.pattern.source, '/admin/articles')

    assert.deepEqual(articles.new.methods, ['GET'])
    assert.equal(articles.new.pattern.source, '/admin/articles/new')

    assert.deepEqual(articles.create.methods, ['POST'])
    assert.equal(articles.create.pattern.source, '/admin/articles')

    assert.deepEqual(articles.show.methods, ['GET'])
    assert.equal(articles.show.pattern.source, '/admin/articles/:id')

    assert.deepEqual(articles.edit.methods, ['GET'])
    assert.equal(articles.edit.pattern.source, '/admin/articles/:id/edit')

    assert.deepEqual(articles.update.methods, ['PUT'])
    assert.equal(articles.update.pattern.source, '/admin/articles/:id')

    assert.deepEqual(articles.destroy.methods, ['DELETE'])
    assert.equal(articles.destroy.pattern.source, '/admin/articles/:id')
  })

  it('creates a route map with a specific param', () => {
    let articles = createResources('articles', { param: 'article_id' })

    type T1 = [
      Assert<
        IsEqual<
          typeof articles,
          {
            index: Route<'GET', '/articles'>
            new: Route<'GET', '/articles/new'>
            create: Route<'POST', '/articles'>
            show: Route<'GET', '/articles/:article_id'>
            edit: Route<'GET', '/articles/:article_id/edit'>
            update: Route<'PUT', '/articles/:article_id'>
            destroy: Route<'DELETE', '/articles/:article_id'>
          }
        >
      >,
    ]

    assert.deepEqual(articles.index.methods, ['GET'])
    assert.equal(articles.index.pattern.source, '/articles')

    assert.deepEqual(articles.new.methods, ['GET'])
    assert.equal(articles.new.pattern.source, '/articles/new')

    assert.deepEqual(articles.create.methods, ['POST'])
    assert.equal(articles.create.pattern.source, '/articles')

    assert.deepEqual(articles.show.methods, ['GET'])
    assert.equal(articles.show.pattern.source, '/articles/:article_id')

    assert.deepEqual(articles.edit.methods, ['GET'])
    assert.equal(articles.edit.pattern.source, '/articles/:article_id/edit')

    assert.deepEqual(articles.update.methods, ['PUT'])
    assert.equal(articles.update.pattern.source, '/articles/:article_id')

    assert.deepEqual(articles.destroy.methods, ['DELETE'])
    assert.equal(articles.destroy.pattern.source, '/articles/:article_id')
  })

  it('creates a route map with only specific methods', () => {
    let articles = createResources('articles', { only: ['index', 'show'] })

    type T1 = [
      Assert<
        IsEqual<
          typeof articles,
          {
            index: Route<'GET', '/articles'>
            show: Route<'GET', '/articles/:id'>
          }
        >
      >,
    ]

    assert.deepEqual(articles.index.methods, ['GET'])
    assert.equal(articles.index.pattern.source, '/articles')

    assert.deepEqual(articles.show.methods, ['GET'])
    assert.equal(articles.show.pattern.source, '/articles/:id')
  })
})

describe('createResource', () => {
  it('creates a route map', () => {
    let article = createResource('article')

    type T1 = [
      Assert<
        IsEqual<
          typeof article,
          {
            new: Route<'GET', '/article/new'>
            create: Route<'POST', '/article'>
            show: Route<'GET', '/article'>
            edit: Route<'GET', '/article/edit'>
            update: Route<'PUT', '/article'>
            destroy: Route<'DELETE', '/article'>
          }
        >
      >,
    ]

    assert.deepEqual(article.new.methods, ['GET'])
    assert.equal(article.new.pattern.source, '/article/new')

    assert.deepEqual(article.create.methods, ['POST'])
    assert.equal(article.create.pattern.source, '/article')

    assert.deepEqual(article.show.methods, ['GET'])
    assert.equal(article.show.pattern.source, '/article')

    assert.deepEqual(article.edit.methods, ['GET'])
    assert.equal(article.edit.pattern.source, '/article/edit')

    assert.deepEqual(article.update.methods, ['PUT'])
    assert.equal(article.update.pattern.source, '/article')

    assert.deepEqual(article.destroy.methods, ['DELETE'])
    assert.equal(article.destroy.pattern.source, '/article')
  })

  it('creates a route map with a base path', () => {
    let article = createResource('article', { base: '/admin' })

    type T1 = [
      Assert<
        IsEqual<
          typeof article,
          {
            new: Route<'GET', '/admin/article/new'>
            create: Route<'POST', '/admin/article'>
            show: Route<'GET', '/admin/article'>
            edit: Route<'GET', '/admin/article/edit'>
            update: Route<'PUT', '/admin/article'>
            destroy: Route<'DELETE', '/admin/article'>
          }
        >
      >,
    ]

    assert.deepEqual(article.new.methods, ['GET'])
    assert.equal(article.new.pattern.source, '/admin/article/new')

    assert.deepEqual(article.create.methods, ['POST'])
    assert.equal(article.create.pattern.source, '/admin/article')

    assert.deepEqual(article.show.methods, ['GET'])
    assert.equal(article.show.pattern.source, '/admin/article')

    assert.deepEqual(article.edit.methods, ['GET'])
    assert.equal(article.edit.pattern.source, '/admin/article/edit')

    assert.deepEqual(article.update.methods, ['PUT'])
    assert.equal(article.update.pattern.source, '/admin/article')

    assert.deepEqual(article.destroy.methods, ['DELETE'])
    assert.equal(article.destroy.pattern.source, '/admin/article')
  })

  it('creates a route map with only specific methods', () => {
    let article = createResource('article', { only: ['new', 'show'] })

    type T1 = [
      Assert<
        IsEqual<
          typeof article,
          {
            new: Route<'GET', '/article/new'>
            show: Route<'GET', '/article'>
          }
        >
      >,
    ]

    assert.deepEqual(article.new.methods, ['GET'])
    assert.equal(article.new.pattern.source, '/article/new')

    assert.deepEqual(article.show.methods, ['GET'])
    assert.equal(article.show.pattern.source, '/article')
  })
})

describe('integration', () => {
  it('resources work end-to-end with router', async () => {
    let articles = createResources('articles', { only: ['index', 'show'] })

    let requestLog: string[] = []

    function logMiddleware({ request }: RequestContext) {
      requestLog.push(`${request.method} ${new URL(request.url).pathname}`)
    }

    let handlers = createHandlers(articles, [logMiddleware], {
      index: () => new Response('Article list'),
      show: ({ params }: any) => new Response(`Article ${params.id}`),
    })

    let router = createRouter(handlers)

    let indexResponse = await router.fetch('https://example.com/articles')
    assert.equal(indexResponse.status, 200)
    assert.equal(await indexResponse.text(), 'Article list')

    let showResponse = await router.fetch('https://example.com/articles/123')
    assert.equal(showResponse.status, 200)
    assert.equal(await showResponse.text(), 'Article 123')

    assert.deepEqual(requestLog, ['GET /articles', 'GET /articles/123'])
  })
})
