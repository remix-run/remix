import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createRouter } from './router.ts'

describe('router.fetch()', () => {
  it('handles a simple route', async () => {
    let routes = {
      home: '/',
    } as const

    let router = createRouter(routes, {
      home() {
        return new Response('Home')
      },
    })

    let response = await router.fetch(new URL('https://remix.run'))

    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Home')
  })

  it('handles a route with a method', async () => {
    let routes = {
      comments: {
        create: { method: 'POST', pattern: '/post/:id/comments' },
      },
    } as const

    // function logger(context: any, next: any) {
    //   console.log(`[${new Date()}] ${context.request.method} ${context.url}`)
    //   return next()
    // }

    let commentsRoutes = (await import('./comments-routes.ts')).default

    let router = createRouter(routes, {
      // use: [logger],
      // comments: {
      //   create({ params }) {
      //     return new Response(`Created comment ${params.id}`)
      //   },
      // },
      comments: commentsRoutes,
    })

    let response = await router.fetch(
      new Request('https://remix.run/post/1/comments', { method: 'POST' }),
    )

    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Created comment 1')
  })
})
