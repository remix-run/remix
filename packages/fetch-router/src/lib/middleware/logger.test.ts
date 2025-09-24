import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createRoutes } from '@remix-run/route-pattern'

import { createRouter } from '../router.ts'
import { logger } from './logger.ts'

describe('logger', () => {
  it('logs the request', async () => {
    let routes = createRoutes({
      home: '/',
    })

    let messages: string[] = []

    let router = createRouter(routes, {
      home: {
        use: [logger({ log: (message) => messages.push(message) })],
        get() {
          return new Response('Home', {
            headers: {
              'Content-Length': '4',
              'Content-Type': 'text/plain',
            },
          })
        },
      },
    })

    let response = await router.fetch('https://remix.run')

    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Home')

    assert.equal(messages.length, 1)
    let message = messages[0]
    assert.match(message, /\[\d{2}\/\w{3}\/\d{4}:\d{2}:\d{2}:\d{2} [+-]\d{4}\] GET \/ \d+ \d+/)
  })
})
