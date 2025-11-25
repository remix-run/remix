import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createRouter, route } from '@remix-run/fetch-router'

import { logger } from './logger.ts'
import { formatDuration } from './logger.ts'

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
    assert.match(message, /\[\d{2}\/\w{3}\/\d{4}:\d{2}:\d{2}:\d{2} [+-]\d{4}\] GET \/ \d+ \d+/)
  })

  it('logs the request with pretty formatters', async () => {
    let routes = route({
      home: '/',
    })

    let messages: string[] = []

    let router = createRouter({
      middleware: [
        logger({
          log: (message) => messages.push(message),
          format: '%method %path %status %durationPretty %contentLengthPretty',
        }),
      ],
    })

    router.map(routes.home, () => {
      return new Response('Home', {
        headers: {
          'Content-Length': '1234',
          'Content-Type': 'text/plain',
        },
      })
    })

    let response = await router.fetch('https://remix.run')

    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Home')

    assert.equal(messages.length, 1)
    let message = messages[0]
    assert.match(message, /GET \/ 200 \d+ms 1.2 kB/)
  })

  it('logs the request with colors', async () => {
    let routes = route({
      home: '/',
    })

    let messages: string[] = []

    let router = createRouter({
      middleware: [
        logger({
          log: (message) => messages.push(message),
          format: '%method %path %status',
          colors: true,
        }),
      ],
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
    assert.match(message, /\x1b\[32mGET\x1b\[0m \/ \x1b\[32m200\x1b\[0m/)
  })
})

describe('formatDuration', () => {
  it('formats milliseconds correctly', () => {
    assert.equal(formatDuration(0), '0ms')
    assert.equal(formatDuration(999), '999ms')
    assert.equal(formatDuration(100), '100ms')
  })

  it('formats seconds correctly', () => {
    assert.equal(formatDuration(1000), '1.00s')
    assert.equal(formatDuration(1500), '1.50s')
    assert.equal(formatDuration(59999), '60.00s') // Just under a minute
    assert.equal(formatDuration(12345), '12.35s') // Rounded
  })

  it('formats minutes correctly', () => {
    assert.equal(formatDuration(60 * 1000), '1.00m') // Exactly one minute
    assert.equal(formatDuration(90 * 1000), '1.50m') // One and a half minutes
    assert.equal(formatDuration(120 * 1000 + 345), '2.01m') // Two minutes and some ms
    assert.equal(formatDuration(3599 * 1000), '59.98m') // Just under an hour
  })

  it('formats hours correctly', () => {
    assert.equal(formatDuration(60 * 60 * 1000), '1.00h') // Exactly one hour
    assert.equal(formatDuration(90 * 60 * 1000), '1.50h') // One and a half hours
    assert.equal(formatDuration(7200 * 1000 + 12345), '2.00h') // Two hours and some s
    assert.equal(formatDuration(7200 * 1000 * 1000), '2000.00h') // Large hours value
  })
})
