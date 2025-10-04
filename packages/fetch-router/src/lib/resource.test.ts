import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createResource, createResources } from './resource.ts'
import { Route } from './route-map.ts'
import type { Assert, IsEqual } from './type-utils.ts'

describe('createResource', () => {
  it('creates a resource', () => {
    let book = createResource('book')

    type T = [
      Assert<
        IsEqual<
          typeof book,
          {
            show: Route<'GET', '/book'>
            new: Route<'GET', '/book/new'>
            create: Route<'POST', '/book'>
            edit: Route<'GET', '/book/edit'>
            update: Route<'PUT', '/book'>
            destroy: Route<'DELETE', '/book'>
          }
        >
      >,
    ]

    assert.deepEqual(book.show, new Route('GET', '/book'))
    assert.deepEqual(book.new, new Route('GET', '/book/new'))
    assert.deepEqual(book.create, new Route('POST', '/book'))
    assert.deepEqual(book.edit, new Route('GET', '/book/edit'))
    assert.deepEqual(book.update, new Route('PUT', '/book'))
    assert.deepEqual(book.destroy, new Route('DELETE', '/book'))
  })

  it('creates a resource with only option', () => {
    let book = createResource('book', { only: ['show', 'update'] })

    type T = [
      Assert<
        IsEqual<
          typeof book,
          {
            show: Route<'GET', '/book'>
            update: Route<'PUT', '/book'>
          }
        >
      >,
    ]

    assert.deepEqual(book.show, new Route('GET', '/book'))
    assert.deepEqual(book.update, new Route('PUT', '/book'))
    // Other routes are excluded from the type
    assert.equal((book as any).new, undefined)
    assert.equal((book as any).create, undefined)
  })

  it('creates a resource with custom route names', () => {
    let book = createResource('book', {
      routeNames: {
        show: 'view',
        new: 'newForm',
        create: 'store',
        edit: 'editForm',
        update: 'save',
        destroy: 'delete',
      },
    })

    type T = [
      Assert<
        IsEqual<
          typeof book,
          {
            view: Route<'GET', '/book'>
            newForm: Route<'GET', '/book/new'>
            store: Route<'POST', '/book'>
            editForm: Route<'GET', '/book/edit'>
            save: Route<'PUT', '/book'>
            delete: Route<'DELETE', '/book'>
          }
        >
      >,
    ]

    assert.deepEqual(book.view, new Route('GET', '/book'))
    assert.deepEqual(book.newForm, new Route('GET', '/book/new'))
    assert.deepEqual(book.store, new Route('POST', '/book'))
    assert.deepEqual(book.editForm, new Route('GET', '/book/edit'))
    assert.deepEqual(book.save, new Route('PUT', '/book'))
    assert.deepEqual(book.delete, new Route('DELETE', '/book'))
    // Old route names should not exist
    assert.equal((book as any).show, undefined)
    assert.equal((book as any).new, undefined)
    assert.equal((book as any).create, undefined)
  })

  it('creates a resource with partial custom route names', () => {
    let book = createResource('book', {
      routeNames: {
        show: 'view',
        create: 'store',
      },
    })

    type T = [
      Assert<
        IsEqual<
          typeof book,
          {
            view: Route<'GET', '/book'>
            new: Route<'GET', '/book/new'>
            store: Route<'POST', '/book'>
            edit: Route<'GET', '/book/edit'>
            update: Route<'PUT', '/book'>
            destroy: Route<'DELETE', '/book'>
          }
        >
      >,
    ]

    assert.deepEqual(book.view, new Route('GET', '/book'))
    assert.deepEqual(book.new, new Route('GET', '/book/new'))
    assert.deepEqual(book.store, new Route('POST', '/book'))
    assert.deepEqual(book.edit, new Route('GET', '/book/edit'))
    assert.deepEqual(book.update, new Route('PUT', '/book'))
    assert.deepEqual(book.destroy, new Route('DELETE', '/book'))
  })

  it('creates a resource with custom route names and only option', () => {
    let book = createResource('book', {
      only: ['show', 'create'],
      routeNames: {
        show: 'view',
        create: 'store',
        update: 'save',
      },
    })

    type T = [
      Assert<
        IsEqual<
          typeof book,
          {
            view: Route<'GET', '/book'>
            store: Route<'POST', '/book'>
          }
        >
      >,
    ]

    assert.deepEqual(book.view, new Route('GET', '/book'))
    assert.deepEqual(book.store, new Route('POST', '/book'))
    // Other routes are excluded from the type
    assert.equal((book as any).save, undefined)
    assert.equal((book as any).new, undefined)
    assert.equal((book as any).edit, undefined)
    assert.equal((book as any).destroy, undefined)
  })
})

describe('createResources', () => {
  it('creates resources with index route', () => {
    let books = createResources('books')

    type T = [
      Assert<
        IsEqual<
          typeof books,
          {
            index: Route<'GET', '/books'>
            show: Route<'GET', '/books/:id'>
            new: Route<'GET', '/books/new'>
            create: Route<'POST', '/books'>
            edit: Route<'GET', '/books/:id/edit'>
            update: Route<'PUT', '/books/:id'>
            destroy: Route<'DELETE', '/books/:id'>
          }
        >
      >,
    ]

    assert.deepEqual(books.index, new Route('GET', '/books'))
    assert.deepEqual(books.show, new Route('GET', '/books/:id'))
    assert.deepEqual(books.new, new Route('GET', '/books/new'))
    assert.deepEqual(books.create, new Route('POST', '/books'))
    assert.deepEqual(books.edit, new Route('GET', '/books/:id/edit'))
    assert.deepEqual(books.update, new Route('PUT', '/books/:id'))
    assert.deepEqual(books.destroy, new Route('DELETE', '/books/:id'))
  })

  it('creates resources with custom param', () => {
    let posts = createResources('posts', { param: 'slug' })

    type T = [
      Assert<
        IsEqual<
          typeof posts,
          {
            index: Route<'GET', '/posts'>
            show: Route<'GET', '/posts/:slug'>
            new: Route<'GET', '/posts/new'>
            create: Route<'POST', '/posts'>
            edit: Route<'GET', '/posts/:slug/edit'>
            update: Route<'PUT', '/posts/:slug'>
            destroy: Route<'DELETE', '/posts/:slug'>
          }
        >
      >,
    ]

    assert.deepEqual(posts.show, new Route('GET', '/posts/:slug'))
    assert.deepEqual(posts.edit, new Route('GET', '/posts/:slug/edit'))
    assert.deepEqual(posts.update, new Route('PUT', '/posts/:slug'))
    assert.deepEqual(posts.destroy, new Route('DELETE', '/posts/:slug'))
  })

  it('creates resources with only option', () => {
    let books = createResources('books', { only: ['index', 'show', 'create'] })

    type T = [
      Assert<
        IsEqual<
          typeof books,
          {
            index: Route<'GET', '/books'>
            show: Route<'GET', '/books/:id'>
            create: Route<'POST', '/books'>
          }
        >
      >,
    ]

    assert.deepEqual(books.index, new Route('GET', '/books'))
    assert.deepEqual(books.show, new Route('GET', '/books/:id'))
    assert.deepEqual(books.create, new Route('POST', '/books'))
    // Other routes are excluded from the type
    assert.equal((books as any).new, undefined)
    assert.equal((books as any).edit, undefined)
    assert.equal((books as any).update, undefined)
    assert.equal((books as any).destroy, undefined)
  })

  it('creates resources with custom param and only option', () => {
    let articles = createResources('articles', {
      only: ['index', 'show'],
      param: 'slug',
    })

    type T = [
      Assert<
        IsEqual<
          typeof articles,
          {
            index: Route<'GET', '/articles'>
            show: Route<'GET', '/articles/:slug'>
          }
        >
      >,
    ]

    assert.deepEqual(articles.index, new Route('GET', '/articles'))
    assert.deepEqual(articles.show, new Route('GET', '/articles/:slug'))
    // Other routes are excluded from the type
    assert.equal((articles as any).new, undefined)
    assert.equal((articles as any).create, undefined)
  })

  it('creates resources with custom route names', () => {
    let books = createResources('books', {
      routeNames: {
        index: 'list',
        show: 'view',
        new: 'newForm',
        create: 'store',
        edit: 'editForm',
        update: 'save',
        destroy: 'delete',
      },
    })

    type T = [
      Assert<
        IsEqual<
          typeof books,
          {
            list: Route<'GET', '/books'>
            view: Route<'GET', '/books/:id'>
            newForm: Route<'GET', '/books/new'>
            store: Route<'POST', '/books'>
            editForm: Route<'GET', '/books/:id/edit'>
            save: Route<'PUT', '/books/:id'>
            delete: Route<'DELETE', '/books/:id'>
          }
        >
      >,
    ]

    assert.deepEqual(books.list, new Route('GET', '/books'))
    assert.deepEqual(books.view, new Route('GET', '/books/:id'))
    assert.deepEqual(books.newForm, new Route('GET', '/books/new'))
    assert.deepEqual(books.store, new Route('POST', '/books'))
    assert.deepEqual(books.editForm, new Route('GET', '/books/:id/edit'))
    assert.deepEqual(books.save, new Route('PUT', '/books/:id'))
    assert.deepEqual(books.delete, new Route('DELETE', '/books/:id'))
    // Old route names should not exist
    assert.equal((books as any).index, undefined)
    assert.equal((books as any).show, undefined)
    assert.equal((books as any).create, undefined)
  })

  it('creates resources with partial custom route names', () => {
    let books = createResources('books', {
      routeNames: {
        index: 'list',
        show: 'view',
        create: 'store',
      },
    })

    type T = [
      Assert<
        IsEqual<
          typeof books,
          {
            list: Route<'GET', '/books'>
            view: Route<'GET', '/books/:id'>
            new: Route<'GET', '/books/new'>
            store: Route<'POST', '/books'>
            edit: Route<'GET', '/books/:id/edit'>
            update: Route<'PUT', '/books/:id'>
            destroy: Route<'DELETE', '/books/:id'>
          }
        >
      >,
    ]

    assert.deepEqual(books.list, new Route('GET', '/books'))
    assert.deepEqual(books.view, new Route('GET', '/books/:id'))
    assert.deepEqual(books.new, new Route('GET', '/books/new'))
    assert.deepEqual(books.store, new Route('POST', '/books'))
    assert.deepEqual(books.edit, new Route('GET', '/books/:id/edit'))
    assert.deepEqual(books.update, new Route('PUT', '/books/:id'))
    assert.deepEqual(books.destroy, new Route('DELETE', '/books/:id'))
  })

  it('creates resources with custom route names and only option', () => {
    let books = createResources('books', {
      only: ['index', 'show'],
      routeNames: {
        index: 'list',
        show: 'view',
        create: 'store',
      },
    })

    type T = [
      Assert<
        IsEqual<
          typeof books,
          {
            list: Route<'GET', '/books'>
            view: Route<'GET', '/books/:id'>
          }
        >
      >,
    ]

    assert.deepEqual(books.list, new Route('GET', '/books'))
    assert.deepEqual(books.view, new Route('GET', '/books/:id'))
    // Other routes are excluded from the type
    assert.equal((books as any).store, undefined)
    assert.equal((books as any).new, undefined)
    assert.equal((books as any).edit, undefined)
    assert.equal((books as any).update, undefined)
    assert.equal((books as any).destroy, undefined)
  })

  it('creates resources with custom route names and custom param', () => {
    let posts = createResources('posts', {
      param: 'slug',
      routeNames: {
        index: 'list',
        show: 'view',
        edit: 'editForm',
        update: 'save',
        destroy: 'delete',
      },
    })

    type T = [
      Assert<
        IsEqual<
          typeof posts,
          {
            list: Route<'GET', '/posts'>
            view: Route<'GET', '/posts/:slug'>
            new: Route<'GET', '/posts/new'>
            create: Route<'POST', '/posts'>
            editForm: Route<'GET', '/posts/:slug/edit'>
            save: Route<'PUT', '/posts/:slug'>
            delete: Route<'DELETE', '/posts/:slug'>
          }
        >
      >,
    ]

    assert.deepEqual(posts.list, new Route('GET', '/posts'))
    assert.deepEqual(posts.view, new Route('GET', '/posts/:slug'))
    assert.deepEqual(posts.new, new Route('GET', '/posts/new'))
    assert.deepEqual(posts.create, new Route('POST', '/posts'))
    assert.deepEqual(posts.editForm, new Route('GET', '/posts/:slug/edit'))
    assert.deepEqual(posts.save, new Route('PUT', '/posts/:slug'))
    assert.deepEqual(posts.delete, new Route('DELETE', '/posts/:slug'))
  })
})
