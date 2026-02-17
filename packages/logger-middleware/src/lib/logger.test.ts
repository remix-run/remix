import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createRouter } from '@remix-run/fetch-router'
import { route } from '@remix-run/fetch-router/routes'

import { logger } from './logger.ts'

describe('logger', () => {
  it('logs the request', async () => {
    let routes = route({
      home: '/',
    })

    let messages: string[] = []

    let router = createRouter({
      middleware: [logger({ log: (message) => messages.push(message) })],
    })

    router.map(
      routes.home,
      () =>
        new Response('Home', {
          headers: {
            'Content-Length': '4',
            'Content-Type': 'text/plain',
          },
        }),
    )

    let response = await router.fetch('https://remix.run')

    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Home')

    assert.equal(messages.length, 1)
    let message = messages[0]
    assert.match(message, /\[\d{2}\/\w{3}\/\d{4}:\d{2}:\d{2}:\d{2} [+-]\d{4}\] GET \/ \d+ \d+/)
  })
})
