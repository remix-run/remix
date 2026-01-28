import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createRouter, route } from '@remix-run/fetch-router'

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

    router.map(routes.home, () => {
      return new Response('Home', {
        headers: {
          'Content-Length': '4',
          'Content-Type': 'text/plain',
        },
      })
    })

    let response = await router.fetch('https://remix.run')

    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Home')

    assert.equal(messages.length, 1)
    let message = messages[0]
    assert.match(message, /\[\d{2}\/\w{3}\/\d{4}:\d{2}:\d{2}:\d{2} [+-]\d{4}\] GET \/ 200 4/)
  })

  it('logs with pretty formatters', async () => {
    let messages: string[] = []
    let router = createRouter({
      middleware: [
        logger({
          log: (message) => messages.push(message),
          format: '%durationPretty %contentLengthPretty',
        }),
      ],
    })

    router.map('/', () => new Response('Home', { headers: { 'Content-Length': '1234' } }))

    await router.fetch('https://remix.run')

    assert.equal(messages.length, 1)
    // Assert that the output matches the new format, e.g., "12ms 1.2 kB"
    assert.match(messages[0], /\d+ms 1.2 kB/)
  })

  it('logs with colors when enabled', async () => {
    let messages: string[] = []
    let router = createRouter({
      middleware: [
        logger({
          log: (message) => messages.push(message),
          colors: true,
          format: '%status',
        }),
      ],
    })

    router.map('/', () => new Response('OK'))

    await router.fetch('https://remix.run')

    assert.equal(messages.length, 1)

    // This checks if the output for a 200 status is either "200" (if no TTY)
    // or the green-colored version of "200".
    let green200 = '\x1b[32m200\x1b[0m'
    assert.ok(messages[0] === '200' || messages[0] === green200)
  })
})
