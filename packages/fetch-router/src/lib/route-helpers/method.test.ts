import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { RoutePattern } from '@remix-run/route-pattern'

import type { Assert, IsEqual } from '../type-utils.ts'
import { Route, createRoutes as route } from '../route-map.ts'
import {
  createDeleteRoute as del,
  createGetRoute as get,
  createHeadRoute as head,
  createOptionsRoute as options,
  createPatchRoute as patch,
  createPostRoute as post,
  createPutRoute as put,
} from './method.ts'

describe('route helpers composition', () => {
  it('composes route helpers in a route map', () => {
    let routes = route({
      home: '/',
      posts: {
        index: get('/posts'),
        create: post('/posts'),
        show: get('/posts/:id'),
        update: put('/posts/:id'),
        patch: patch('/posts/:id'),
        destroy: del('/posts/:id'),
      },
      api: {
        health: head('/api/health'),
        options: options('/api/settings'),
      },
    })

    assert.deepEqual(routes.home, new Route('ANY', '/'))
    assert.deepEqual(routes.posts.index, new Route('GET', '/posts'))
    assert.deepEqual(routes.posts.create, new Route('POST', '/posts'))
    assert.deepEqual(routes.posts.show, new Route('GET', '/posts/:id'))
    assert.deepEqual(routes.posts.update, new Route('PUT', '/posts/:id'))
    assert.deepEqual(routes.posts.patch, new Route('PATCH', '/posts/:id'))
    assert.deepEqual(routes.posts.destroy, new Route('DELETE', '/posts/:id'))
    assert.deepEqual(routes.api.health, new Route('HEAD', '/api/health'))
    assert.deepEqual(routes.api.options, new Route('OPTIONS', '/api/settings'))
  })

  it('composes route helpers with base paths', () => {
    let apiRoutes = route('api/v1', {
      users: {
        index: get('/'),
        create: post('/'),
        show: get('/:id'),
        update: put('/:id'),
        destroy: del('/:id'),
      },
    })

    let routes = route({
      home: '/',
      api: apiRoutes,
    })

    assert.deepEqual(routes.api.users.index, new Route('GET', '/api/v1'))
    assert.deepEqual(routes.api.users.create, new Route('POST', '/api/v1'))
    assert.deepEqual(routes.api.users.show, new Route('GET', '/api/v1/:id'))
    assert.deepEqual(routes.api.users.update, new Route('PUT', '/api/v1/:id'))
    assert.deepEqual(routes.api.users.destroy, new Route('DELETE', '/api/v1/:id'))
  })

  it('mixes helper methods with string patterns', () => {
    let routes = route({
      home: '/',
      about: '/about',
      contact: get('/contact'),
      login: post('/auth/login'),
      logout: del('/auth/logout'),
      profile: {
        show: '/profile',
        edit: get('/profile/edit'),
        update: patch('/profile'),
      },
    })

    assert.deepEqual(routes.home, new Route('ANY', '/'))
    assert.deepEqual(routes.about, new Route('ANY', '/about'))
    assert.deepEqual(routes.contact, new Route('GET', '/contact'))
    assert.deepEqual(routes.login, new Route('POST', '/auth/login'))
    assert.deepEqual(routes.logout, new Route('DELETE', '/auth/logout'))
    assert.deepEqual(routes.profile.show, new Route('ANY', '/profile'))
    assert.deepEqual(routes.profile.edit, new Route('GET', '/profile/edit'))
    assert.deepEqual(routes.profile.update, new Route('PATCH', '/profile'))
  })

  it('uses helper methods with complex patterns', () => {
    let routes = route({
      api: {
        posts: get('/api/posts(/:lang)'),
        createPost: post('/api/posts'),
        updatePost: put('/api/posts/:id'),
        deletePost: del('/api/posts/:id'),
      },
      healthCheck: head('/health'),
    })

    assert.deepEqual(routes.api.posts, new Route('GET', '/api/posts(/:lang)'))
    assert.deepEqual(routes.api.createPost, new Route('POST', '/api/posts'))
    assert.deepEqual(routes.api.updatePost, new Route('PUT', '/api/posts/:id'))
    assert.deepEqual(routes.api.deletePost, new Route('DELETE', '/api/posts/:id'))
    assert.deepEqual(routes.healthCheck, new Route('HEAD', '/health'))
  })
})

let composedRoutes = route({
  home: '/',
  ...route('posts', {
    posts: get('/'),
    createPost: post('/'),
    showPost: get(':id'),
    updatePost: put(':id'),
    deletePost: del(':id'),
  }),
  api: {
    health: head('/api/health'),
    options: options('/api/settings'),
  },
  patch: patch(new RoutePattern('/patch')),
  put: put(new RoutePattern('/misc/put')),
})

type Tests = [
  Assert<IsEqual<typeof composedRoutes.posts, Route<'GET', '/posts'>>>,
  Assert<IsEqual<typeof composedRoutes.createPost, Route<'POST', '/posts'>>>,
  Assert<IsEqual<typeof composedRoutes.showPost, Route<'GET', '/posts/:id'>>>,
  Assert<IsEqual<typeof composedRoutes.updatePost, Route<'PUT', '/posts/:id'>>>,
  Assert<IsEqual<typeof composedRoutes.deletePost, Route<'DELETE', '/posts/:id'>>>,
  Assert<IsEqual<typeof composedRoutes.api.health, Route<'HEAD', '/api/health'>>>,
  Assert<IsEqual<typeof composedRoutes.api.options, Route<'OPTIONS', '/api/settings'>>>,
  Assert<IsEqual<typeof composedRoutes.patch, Route<'PATCH', '/patch'>>>,
  Assert<IsEqual<typeof composedRoutes.put, Route<'PUT', '/misc/put'>>>,
]
