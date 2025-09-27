import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createResources, createResource } from './resources.ts'
import { createRouter } from './router.ts'
import type { RequestContext, Route, RouteHandler } from './router.ts'
import type { Assert, IsEqual } from './type-utils.ts'

describe('createResources', () => {
  it('creates a route map and handlers', () => {
    let articles = createResources('articles')

    type T1 = [
      Assert<
        IsEqual<
          typeof articles.routes,
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

    assert.deepEqual(articles.routes.index.methods, ['GET'])
    assert.equal(articles.routes.index.pattern.source, '/articles')

    assert.deepEqual(articles.routes.new.methods, ['GET'])
    assert.equal(articles.routes.new.pattern.source, '/articles/new')

    assert.deepEqual(articles.routes.create.methods, ['POST'])
    assert.equal(articles.routes.create.pattern.source, '/articles')

    assert.deepEqual(articles.routes.show.methods, ['GET'])
    assert.equal(articles.routes.show.pattern.source, '/articles/:id')

    assert.deepEqual(articles.routes.edit.methods, ['GET'])
    assert.equal(articles.routes.edit.pattern.source, '/articles/:id/edit')

    assert.deepEqual(articles.routes.update.methods, ['PUT'])
    assert.equal(articles.routes.update.pattern.source, '/articles/:id')

    assert.deepEqual(articles.routes.destroy.methods, ['DELETE'])
    assert.equal(articles.routes.destroy.pattern.source, '/articles/:id')

    let handlers = articles.createHandlers({
      index: () => new Response('Articles'),
      new: () => new Response('New article'),
      create: () => new Response('Create article'),
      show: () => new Response('Show article'),
      edit: () => new Response('Edit article'),
      update: () => new Response('Update article'),
      destroy: () => new Response('Destroy article'),
    })

    assert.ok(handlers.index)
    assert.ok(handlers.new)
    assert.ok(handlers.create)
    assert.ok(handlers.show)
    assert.ok(handlers.edit)
    assert.ok(handlers.update)
    assert.ok(handlers.destroy)
  })

  it('creates a route map and handlers with a base path', () => {
    let articles = createResources('articles', { base: '/admin' })

    type T1 = [
      Assert<
        IsEqual<
          typeof articles.routes,
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

    assert.deepEqual(articles.routes.index.methods, ['GET'])
    assert.equal(articles.routes.index.pattern.source, '/admin/articles')

    assert.deepEqual(articles.routes.new.methods, ['GET'])
    assert.equal(articles.routes.new.pattern.source, '/admin/articles/new')

    assert.deepEqual(articles.routes.create.methods, ['POST'])
    assert.equal(articles.routes.create.pattern.source, '/admin/articles')

    assert.deepEqual(articles.routes.show.methods, ['GET'])
    assert.equal(articles.routes.show.pattern.source, '/admin/articles/:id')

    assert.deepEqual(articles.routes.edit.methods, ['GET'])
    assert.equal(articles.routes.edit.pattern.source, '/admin/articles/:id/edit')

    assert.deepEqual(articles.routes.update.methods, ['PUT'])
    assert.equal(articles.routes.update.pattern.source, '/admin/articles/:id')

    assert.deepEqual(articles.routes.destroy.methods, ['DELETE'])
    assert.equal(articles.routes.destroy.pattern.source, '/admin/articles/:id')

    let handlers = articles.createHandlers({
      index: () => new Response('Articles'),
      new: () => new Response('New article'),
      create: () => new Response('Create article'),
      show: () => new Response('Show article'),
      edit: () => new Response('Edit article'),
      update: () => new Response('Update article'),
      destroy: () => new Response('Destroy article'),
    })

    assert.ok(handlers.index)
    assert.ok(handlers.new)
    assert.ok(handlers.create)
    assert.ok(handlers.show)
    assert.ok(handlers.edit)
    assert.ok(handlers.update)
    assert.ok(handlers.destroy)
  })

  it('creates a route map and handlers with a specific param', () => {
    let articles = createResources('articles', { param: 'article_id' })

    type T1 = [
      Assert<
        IsEqual<
          typeof articles.routes,
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

    assert.deepEqual(articles.routes.index.methods, ['GET'])
    assert.equal(articles.routes.index.pattern.source, '/articles')

    assert.deepEqual(articles.routes.new.methods, ['GET'])
    assert.equal(articles.routes.new.pattern.source, '/articles/new')

    assert.deepEqual(articles.routes.create.methods, ['POST'])
    assert.equal(articles.routes.create.pattern.source, '/articles')

    assert.deepEqual(articles.routes.show.methods, ['GET'])
    assert.equal(articles.routes.show.pattern.source, '/articles/:article_id')

    assert.deepEqual(articles.routes.edit.methods, ['GET'])
    assert.equal(articles.routes.edit.pattern.source, '/articles/:article_id/edit')

    assert.deepEqual(articles.routes.update.methods, ['PUT'])
    assert.equal(articles.routes.update.pattern.source, '/articles/:article_id')

    assert.deepEqual(articles.routes.destroy.methods, ['DELETE'])
    assert.equal(articles.routes.destroy.pattern.source, '/articles/:article_id')

    let handlers = articles.createHandlers({
      index: () => new Response('Articles'),
      new: () => new Response('New article'),
      create: () => new Response('Create article'),
      show: () => new Response('Show article'),
      edit: () => new Response('Edit article'),
      update: () => new Response('Update article'),
      destroy: () => new Response('Destroy article'),
    })

    assert.ok(handlers.index)
    assert.ok(handlers.new)
    assert.ok(handlers.create)
    assert.ok(handlers.show)
    assert.ok(handlers.edit)
    assert.ok(handlers.update)
    assert.ok(handlers.destroy)
  })

  it('creates a route map and handlers with only specific methods', () => {
    let articles = createResources('articles', { only: ['index', 'show'] })

    type T1 = [
      Assert<
        IsEqual<
          typeof articles.routes,
          {
            index: Route<'GET', '/articles'>
            show: Route<'GET', '/articles/:id'>
          }
        >
      >,
    ]

    assert.deepEqual(articles.routes.index.methods, ['GET'])
    assert.equal(articles.routes.index.pattern.source, '/articles')

    assert.deepEqual(articles.routes.show.methods, ['GET'])
    assert.equal(articles.routes.show.pattern.source, '/articles/:id')

    let handlers = articles.createHandlers({
      index: () => new Response('Articles'),
      show: () => new Response('Show article'),
    })

    assert.ok(handlers.index)
    assert.ok(handlers.show)
  })

  it('supports middleware', async () => {
    let articles = createResources('articles', { only: ['index'] })

    let middlewareInvocations: string[] = []

    function authMiddleware() {
      middlewareInvocations.push('auth')
    }

    let handlers = articles.createHandlers([authMiddleware], {
      index: () => {
        middlewareInvocations.push('handler')
        return new Response('Articles')
      },
    })

    assert.ok(handlers.index)
    assert.deepEqual(handlers.index.middleware, [authMiddleware])
  })
})

describe('createResource', () => {
  it('creates a route map and handlers', () => {
    let article = createResource('article')

    type T1 = [
      Assert<
        IsEqual<
          typeof article.routes,
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

    assert.deepEqual(article.routes.new.methods, ['GET'])
    assert.equal(article.routes.new.pattern.source, '/article/new')

    assert.deepEqual(article.routes.create.methods, ['POST'])
    assert.equal(article.routes.create.pattern.source, '/article')

    assert.deepEqual(article.routes.show.methods, ['GET'])
    assert.equal(article.routes.show.pattern.source, '/article')

    assert.deepEqual(article.routes.edit.methods, ['GET'])
    assert.equal(article.routes.edit.pattern.source, '/article/edit')

    assert.deepEqual(article.routes.update.methods, ['PUT'])
    assert.equal(article.routes.update.pattern.source, '/article')

    assert.deepEqual(article.routes.destroy.methods, ['DELETE'])
    assert.equal(article.routes.destroy.pattern.source, '/article')

    let handlers = article.createHandlers({
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
          typeof handlers,
          {
            new: RouteHandler<Route<'GET', '/article/new'>>
            create: RouteHandler<Route<'POST', '/article'>>
            show: RouteHandler<Route<'GET', '/article'>>
            edit: RouteHandler<Route<'GET', '/article/edit'>>
            update: RouteHandler<Route<'PUT', '/article'>>
            destroy: RouteHandler<Route<'DELETE', '/article'>>
          }
        >
      >,
    ]

    assert.ok(handlers.new)
    assert.ok(handlers.create)
    assert.ok(handlers.show)
    assert.ok(handlers.edit)
    assert.ok(handlers.update)
    assert.ok(handlers.destroy)
  })

  it('creates a route map and handlers with a base path', () => {
    let article = createResource('article', { base: '/admin' })

    type T1 = [
      Assert<
        IsEqual<
          typeof article.routes,
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

    assert.deepEqual(article.routes.new.methods, ['GET'])
    assert.equal(article.routes.new.pattern.source, '/admin/article/new')

    assert.deepEqual(article.routes.create.methods, ['POST'])
    assert.equal(article.routes.create.pattern.source, '/admin/article')

    assert.deepEqual(article.routes.show.methods, ['GET'])
    assert.equal(article.routes.show.pattern.source, '/admin/article')

    assert.deepEqual(article.routes.edit.methods, ['GET'])
    assert.equal(article.routes.edit.pattern.source, '/admin/article/edit')

    assert.deepEqual(article.routes.update.methods, ['PUT'])
    assert.equal(article.routes.update.pattern.source, '/admin/article')

    assert.deepEqual(article.routes.destroy.methods, ['DELETE'])
    assert.equal(article.routes.destroy.pattern.source, '/admin/article')

    let handlers = article.createHandlers({
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
          typeof handlers,
          {
            new: RouteHandler<Route<'GET', '/admin/article/new'>>
            create: RouteHandler<Route<'POST', '/admin/article'>>
            show: RouteHandler<Route<'GET', '/admin/article'>>
            edit: RouteHandler<Route<'GET', '/admin/article/edit'>>
            update: RouteHandler<Route<'PUT', '/admin/article'>>
            destroy: RouteHandler<Route<'DELETE', '/admin/article'>>
          }
        >
      >,
    ]

    assert.ok(handlers.new)
    assert.ok(handlers.create)
    assert.ok(handlers.show)
    assert.ok(handlers.edit)
    assert.ok(handlers.update)
    assert.ok(handlers.destroy)
  })

  it('creates a route map with only specific methods', () => {
    let article = createResource('article', { only: ['new', 'show'] })

    type T1 = [
      Assert<
        IsEqual<
          typeof article.routes,
          {
            new: Route<'GET', '/article/new'>
            show: Route<'GET', '/article'>
          }
        >
      >,
    ]

    assert.deepEqual(article.routes.new.methods, ['GET'])
    assert.equal(article.routes.new.pattern.source, '/article/new')

    assert.deepEqual(article.routes.show.methods, ['GET'])
    assert.equal(article.routes.show.pattern.source, '/article')

    let handlers = article.createHandlers({
      new: () => new Response('New article'),
      show: () => new Response('Show article'),
    })

    type T2 = [
      Assert<
        IsEqual<
          typeof handlers,
          {
            new: RouteHandler<Route<'GET', '/article/new'>>
            show: RouteHandler<Route<'GET', '/article'>>
          }
        >
      >,
    ]

    assert.ok(handlers.new)
    assert.ok(handlers.show)
  })

  it('supports middleware', async () => {
    let article = createResource('article', { only: ['show'] })

    let middlewareInvocations: string[] = []

    function authMiddleware() {
      middlewareInvocations.push('auth')
    }

    let handlers = article.createHandlers([authMiddleware], {
      show: () => {
        middlewareInvocations.push('handler')
        return new Response('Article')
      },
    })

    type T1 = [
      Assert<
        IsEqual<
          typeof handlers,
          {
            show: RouteHandler<Route<'GET', '/article'>>
          }
        >
      >,
    ]

    assert.ok(handlers.show)
    assert.deepEqual(handlers.show.middleware, [authMiddleware])
  })
})

describe('integration', () => {
  it('resources work end-to-end with router', async () => {
    let articles = createResources('articles', { only: ['index', 'show'] })

    let requestLog: string[] = []

    function logMiddleware({ request }: RequestContext) {
      requestLog.push(`${request.method} ${new URL(request.url).pathname}`)
    }

    let handlers = articles.createHandlers([logMiddleware], {
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
