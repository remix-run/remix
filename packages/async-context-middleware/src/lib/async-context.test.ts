import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createRouter } from '@remix-run/fetch-router'
import { route } from '@remix-run/fetch-router/routes'

import { asyncContext, getContext } from './async-context.ts'

describe('asyncContext', () => {
  it('stores the request context in AsyncLocalStorage', async () => {
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
