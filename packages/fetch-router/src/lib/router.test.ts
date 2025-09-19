import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createRouter } from './router.ts'

describe('createRouter', () => {
  it('creates a router', () => {
    let router = createRouter({}, {})
    assert.ok(router)
  })

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

      let response = await router.fetch(new Request('https://example.com/'))

      assert.equal(response.status, 200)
      assert.equal(await response.text(), 'Home')
    })
  })
})
