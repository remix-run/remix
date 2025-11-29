import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { Route } from '../route-map.ts'
import type { Assert, IsEqual } from '../type-utils.ts'
import { ResourceMethods, createResourceRoutes as resource } from './resource.ts'

describe('resource routes helper', () => {
  it('creates a resource', () => {
    let book = resource('book')

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

    // Key order is important. new must come before show.
    assert.deepEqual(Object.keys(book), ResourceMethods)

    assert.deepEqual(book.show, new Route('GET', '/book'))
    assert.deepEqual(book.new, new Route('GET', '/book/new'))
    assert.deepEqual(book.create, new Route('POST', '/book'))
    assert.deepEqual(book.edit, new Route('GET', '/book/edit'))
    assert.deepEqual(book.update, new Route('PUT', '/book'))
    assert.deepEqual(book.destroy, new Route('DELETE', '/book'))
  })

  it('creates a resource with only option', () => {
    let book = resource('book', { only: ['show', 'update'] })

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

  it('creates a resource with exclude option', () => {
    let book = resource('book', { exclude: ['new', 'create', 'edit', 'destroy'] })

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
    assert.equal((book as any).edit, undefined)
    assert.equal((book as any).destroy, undefined)
  })

  it('creates a resource with custom route names', () => {
    let book = resource('book', {
      names: {
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
    let book = resource('book', {
      names: {
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
    let book = resource('book', {
      only: ['show', 'create'],
      names: {
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

  it('creates a resource with custom route names and exclude option', () => {
    let book = resource('book', {
      exclude: ['new', 'edit', 'destroy'],
      names: {
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
            save: Route<'PUT', '/book'>
          }
        >
      >,
    ]

    assert.deepEqual(book.view, new Route('GET', '/book'))
    assert.deepEqual(book.store, new Route('POST', '/book'))
    assert.deepEqual(book.save, new Route('PUT', '/book'))
    // Other routes are excluded from the type
    assert.equal((book as any).new, undefined)
    assert.equal((book as any).edit, undefined)
    assert.equal((book as any).destroy, undefined)
  })

  it('throws an error if both only and exclude are specified', () => {
    assert.throws(
      () => resource('book', { only: ['show'], exclude: ['destroy'] } as any),
      /Cannot specify both "only" and "exclude" options/,
    )
  })
})
