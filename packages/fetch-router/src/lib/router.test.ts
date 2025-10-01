import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

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

  it.todo('delegates to another router')
  // , async () => {
  //   let adminRouter = createRouter()
  //   adminRouter.get('/', () => new Response('Admin'))
  //   adminRouter.get('/users', () => new Response('Admin Users'))

  //   let router = createRouter()
  //   router.get('/', () => new Response('Home'))

  //   // TODO: This is a hack to get the admin router to work. What we
  //   // really want here is a mount(prefix, router) method that strips
  //   // the pathname prefix from the request URL and delegates to the
  //   // admin router.
  //   router.all('/admin/*', async (context) => {
  //     let response = await adminRouter.dispatch(context)
  //     return response ?? new Response('Not Found', { status: 404 })
  //   })

  //   let response = await router.fetch('https://remix.run')
  //   assert.equal(response.status, 200)
  //   assert.equal(await response.text(), 'Home')

  //   response = await router.fetch('https://remix.run/admin')
  //   assert.equal(response.status, 200)
  //   assert.equal(await response.text(), 'Admin')

  //   response = await router.fetch('https://remix.run/admin/users')
  //   assert.equal(response.status, 200)
  //   assert.equal(await response.text(), 'Admin Users')
  // })
})
