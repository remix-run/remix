import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createRoutes as route } from '../route-map.ts'
import { createRouter } from '../router.ts'
import { asyncContext, getContext } from './async-context.ts'

describe('asyncContext', () => {
  it('should store the request context in AsyncLocalStorage', async () => {
    let routes = route({
      home: '/',
    })

    let router = createRouter({
      middleware: [asyncContext()],
    })

    router.map(routes.home, (context) => {
      assert.equal(context, getContext())
      return new Response('Home')
    })

    await router.fetch('https://remix.run')
  })
})
