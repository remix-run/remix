import * as assert from 'node:assert/strict'
import { describe, it, mock } from 'node:test'

import { createCookie } from '@remix-run/cookie'
import { createRouter, route } from '@remix-run/fetch-router'
import { createCookieSessionStorage } from '@remix-run/session/cookie-storage'
import { session } from '@remix-run/session-middleware'

import { createAuth, STOARGE_KEY } from './auth-middleware.ts'

let sessionCookie = createCookie('__session', {
  secrets: ['s3cr3t'], // session cookies must be signed!
  httpOnly: true,
  secure: true,
  sameSite: 'Lax',
  path: '/',
})

let sessionStorage = createCookieSessionStorage()

describe('createAuth', () => {
  it('getUser throws when no user is authenticated', async () => {
    let auth = createAuth([])

    let routes = route({
      home: '/',
    })

    let router = createRouter({
      middleware: [session(sessionCookie, sessionStorage), auth.load],
    })

    router.map(routes.home, async () => {
      await assert.rejects(async () => auth.getUser(), new Error('User not found'))
      return new Response('Home')
    })

    let response = await router.fetch('https://remix.run')
    assert.equal(response.headers.getSetCookie().length, 0)
  })

  it('getUser(false) returns null when no user is authenticated', async () => {
    let auth = createAuth([])

    let routes = route({
      home: '/',
    })

    let router = createRouter({
      middleware: [session(sessionCookie, sessionStorage), auth.load],
    })

    router.map(routes.home, () => {
      assert.equal(null, auth.getUser(false))
      return new Response('Home')
    })

    let response = await router.fetch('https://remix.run')
    assert.equal(response.headers.getSetCookie().length, 0)
  })

  it('getProfile throws when no user is authenticated', async () => {
    let auth = createAuth([])

    let routes = route({
      home: '/',
    })

    let router = createRouter({
      middleware: [session(sessionCookie, sessionStorage), auth.load],
    })

    router.map(routes.home, async () => {
      await assert.rejects(async () => auth.getProfile(), new Error('Profile not found'))
      return new Response('Home')
    })

    let response = await router.fetch('https://remix.run')
    assert.equal(response.headers.getSetCookie().length, 0)
  })

  it('getProfile(false) returns null when no user is authenticated', async () => {
    let auth = createAuth([])

    let routes = route({
      home: '/',
    })

    let router = createRouter({
      middleware: [session(sessionCookie, sessionStorage), auth.load],
    })

    router.map(routes.home, async () => {
      assert.equal(null, await auth.getProfile(false))
      return new Response('Home')
    })

    let response = await router.fetch('https://remix.run')
    assert.equal(response.headers.getSetCookie().length, 0)
  })

  it('auth method restores session', async () => {
    let restore = mock.fn((userId) => {
      return { type: 'test', userId }
    })

    let auth = createAuth([
      {
        type: 'test',
        profile() {
          return null
        },
        restore,
        authorize() {
          return null
        },
        callback() {
          return null
        },
      },
    ] as const)

    let routes = route({
      home: '/',
    })

    let router = createRouter({
      middleware: [session(sessionCookie, sessionStorage), auth.load],
    })

    router.map(routes.home, async () => {
      assert.deepEqual(auth.getUser(), { type: 'test', id: 'id' })
      return new Response('Home')
    })

    let storage = await sessionStorage.read(null)
    storage.set(STOARGE_KEY, { type: 'test', id: 'id' })

    let response = await router.fetch('https://remix.run', {
      headers: {
        cookie: await sessionCookie.serialize(convertCookies(await sessionStorage.save(storage))),
      },
    })

    assert.equal(restore.mock.callCount(), 1)
    assert.equal(response.headers.getSetCookie().length, 0)
  })

  it('auth method stops session from being restored', async () => {
    let restore = mock.fn(() => {
      return {}
    })

    let auth = createAuth([
      {
        type: 'test',
        profile() {
          return null
        },
        restore,
        authorize() {
          return null
        },
        callback() {
          return null
        },
      },
    ])

    let routes = route({
      home: '/',
    })

    let router = createRouter({
      middleware: [session(sessionCookie, sessionStorage), auth.load],
    })

    router.map(routes.home, async () => {
      await assert.rejects(async () => auth.getUser(), new Error('User not found'))
      return new Response('Home')
    })

    let storage = await sessionStorage.read(null)
    storage.set(STOARGE_KEY, { type: 'test', id: 'id' })

    let response = await router.fetch('https://remix.run', {
      headers: {
        cookie: await sessionCookie.serialize(convertCookies(await sessionStorage.save(storage))),
      },
    })

    assert.equal(restore.mock.callCount(), 1)
    let cookie = convertCookies(response.headers.getSetCookie())
    storage = await sessionStorage.read(cookie)
    assert.equal(storage.get(STOARGE_KEY), undefined)
  })

  it('getProfile is cached', async () => {
    let profileObj = { type: 'test', name: 'name' }
    let ctx = { type: 'test', userId: 'id' }
    let profile = mock.fn((_, __) => profileObj)

    let auth = createAuth([
      {
        type: 'test',
        profile,
        restore() {
          return ctx
        },
        authorize() {
          return null
        },
        callback() {
          return null
        },
      },
    ] as const)

    let routes = route({
      home: '/',
    })

    let router = createRouter({
      middleware: [session(sessionCookie, sessionStorage), auth.load],
    })

    router.map(routes.home, async () => {
      assert.equal(await auth.getProfile(), profileObj)
      assert.equal(await auth.getProfile(), profileObj)
      return new Response('Home')
    })

    let storage = await sessionStorage.read(null)
    storage.set(STOARGE_KEY, { type: 'test', id: 'id' })

    let response = await router.fetch('https://remix.run', {
      headers: {
        cookie: await sessionCookie.serialize(convertCookies(await sessionStorage.save(storage))),
      },
    })

    assert.equal(profile.mock.callCount(), 1)
    assert.equal(profile.mock.calls[0].arguments[1], ctx)
    assert.equal(response.headers.getSetCookie().length, 0)
  })
})

function convertCookies(setCookies: string | string[] | null): string {
  if (!setCookies) {
    return ''
  }

  let cookieArray = Array.isArray(setCookies) ? setCookies : [setCookies]

  let cookies = cookieArray.map((setCookie) => {
    let nameValuePair = setCookie.split(';')[0].trim()
    return nameValuePair
  })

  return cookies.join('; ')
}
