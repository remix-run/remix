import * as assert from 'node:assert/strict'
import { describe, it, mock } from 'node:test'

import { createRoutes } from './route-map.ts'
import { createRouter } from './router.ts'

describe('Router', () => {
  it('fetches a route', async () => {
    let router = createRouter()
    router.get('/', () => new Response('Home'))

    let response = await router.fetch('https://remix.run')

    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Home')
  })

  it('fetches a route with middleware', async () => {
    let routes = createRoutes({
      home: '/',
    })

    let router = createRouter()

    let requestLog: string[] = []

    router.use(() => {
      requestLog.push('middleware')
    })

    router.get(routes.home, () => new Response('Home'))

    let response = await router.fetch('https://remix.run')

    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Home')

    assert.equal(requestLog.length, 1)
    assert.deepEqual(requestLog, ['middleware'])
  })

  it('delegates to another router and runs all middleware from both', async () => {
    let requestLog: string[] = []

    let adminRouter = createRouter()
    adminRouter.use(({ url }) => {
      requestLog.push(url.href)
    })
    adminRouter.get('/', () => new Response('Admin'))
    adminRouter.get('/users', () => new Response('Admin Users'))

    let router = createRouter()
    router.use(({ url }) => {
      requestLog.push(url.href)
    })
    router.get('/', () => new Response('Home'))

    router.mount('/admin', adminRouter)

    let response = await router.fetch('https://remix.run')
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Home')
    assert.deepEqual(requestLog, ['https://remix.run/'])

    requestLog = []

    response = await router.fetch('https://remix.run/admin')
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Admin')
    assert.deepEqual(requestLog, ['https://remix.run/', 'https://remix.run/'])

    requestLog = []

    response = await router.fetch('https://remix.run/admin/users')
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Admin Users')
    assert.deepEqual(requestLog, ['https://remix.run/users', 'https://remix.run/users'])
  })

  it('continues matching routes registered after a mount', async () => {
    let router = createRouter()
    router.get('/', () => new Response('Home'))

    let adminRouter = createRouter()
    adminRouter.get('/profile', () => new Response('Admin Profile'))

    let dispatchSpy = mock.method(adminRouter, 'dispatch')

    // This is a miss
    router.mount('/admin', adminRouter)

    router.get('/admin', () => new Response('Admin'))

    let response = await router.fetch('https://remix.run/admin')

    // The dispatch method should have been called
    assert.equal(dispatchSpy.mock.calls.length, 1)

    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Admin')
  })
})
