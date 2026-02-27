import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createRouter } from '@remix-run/fetch-router'
import { Vary } from '@remix-run/headers'

import { cors } from './cors.ts'

describe('cors middleware', () => {
  it('adds wildcard CORS response headers by default', async () => {
    let router = createRouter({
      middleware: [cors()],
    })

    router.get('/', () => new Response('ok'))

    let response = await router.fetch('https://remix.run/', {
      headers: {
        Origin: 'https://example.com',
      },
    })

    assert.equal(response.status, 200)
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*')
    assert.equal(response.headers.get('Vary'), null)
  })

  it('reflects origin and adds Vary when credentials are enabled', async () => {
    let router = createRouter({
      middleware: [cors({ credentials: true })],
    })

    router.get('/', () => new Response('ok'))

    let response = await router.fetch('https://remix.run/', {
      headers: {
        Origin: 'https://example.com',
      },
    })

    assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://example.com')
    assert.equal(response.headers.get('Access-Control-Allow-Credentials'), 'true')

    let vary = Vary.from(response.headers.get('Vary'))
    assert.ok(vary.has('Origin'))
  })

  it('short-circuits preflight requests', async () => {
    let router = createRouter({
      middleware: [cors()],
    })

    router.get('/', () => new Response('ok'))

    let response = await router.fetch('https://remix.run/', {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://example.com',
        'Access-Control-Request-Method': 'PATCH',
        'Access-Control-Request-Headers': 'x-api-key,content-type',
      },
    })

    assert.equal(response.status, 204)
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*')
    assert.equal(
      response.headers.get('Access-Control-Allow-Methods'),
      'GET, HEAD, PUT, PATCH, POST, DELETE',
    )
    assert.equal(response.headers.get('Access-Control-Allow-Headers'), 'x-api-key,content-type')

    let vary = Vary.from(response.headers.get('Vary'))
    assert.ok(vary.has('Access-Control-Request-Method'))
    assert.ok(vary.has('Access-Control-Request-Headers'))
  })

  it('continues preflight requests when preflightContinue is true', async () => {
    let router = createRouter({
      middleware: [cors({ preflightContinue: true })],
    })

    router.options('/', () => new Response('continued'))

    let response = await router.fetch('https://remix.run/', {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://example.com',
        'Access-Control-Request-Method': 'POST',
      },
    })

    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'continued')
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*')
    assert.equal(
      response.headers.get('Access-Control-Allow-Methods'),
      'GET, HEAD, PUT, PATCH, POST, DELETE',
    )
  })

  it('blocks disallowed origins in preflight requests', async () => {
    let router = createRouter({
      middleware: [cors({ origin: 'https://allowed.example' })],
    })

    router.get('/', () => new Response('ok'))

    let response = await router.fetch('https://remix.run/', {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://blocked.example',
        'Access-Control-Request-Method': 'POST',
      },
    })

    assert.equal(response.status, 403)
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), null)
  })

  it('supports function-based dynamic origin checks', async () => {
    let router = createRouter({
      middleware: [
        cors({
          origin: (origin) => origin.endsWith('.trusted.example'),
        }),
      ],
    })

    router.get('/', () => new Response('ok'))

    let allowedResponse = await router.fetch('https://remix.run/', {
      headers: {
        Origin: 'https://api.trusted.example',
      },
    })

    let blockedResponse = await router.fetch('https://remix.run/', {
      headers: {
        Origin: 'https://evil.example',
      },
    })

    assert.equal(
      allowedResponse.headers.get('Access-Control-Allow-Origin'),
      'https://api.trusted.example',
    )
    assert.equal(blockedResponse.headers.get('Access-Control-Allow-Origin'), null)
  })

  it('supports explicit allowed headers and max-age for preflight requests', async () => {
    let router = createRouter({
      middleware: [
        cors({
          allowedHeaders: ['Authorization', 'Content-Type'],
          maxAge: 600,
        }),
      ],
    })

    router.get('/', () => new Response('ok'))

    let response = await router.fetch('https://remix.run/', {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://example.com',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'x-custom-header',
      },
    })

    assert.equal(response.status, 204)
    assert.equal(response.headers.get('Access-Control-Allow-Headers'), 'Authorization, Content-Type')
    assert.equal(response.headers.get('Access-Control-Max-Age'), '600')

    let vary = Vary.from(response.headers.get('Vary'))
    assert.ok(!vary.has('Access-Control-Request-Headers'))
  })

  it('sets Access-Control-Allow-Private-Network when requested', async () => {
    let router = createRouter({
      middleware: [cors({ allowPrivateNetwork: true })],
    })

    router.get('/', () => new Response('ok'))

    let response = await router.fetch('https://remix.run/', {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://example.com',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Private-Network': 'true',
      },
    })

    assert.equal(response.status, 204)
    assert.equal(response.headers.get('Access-Control-Allow-Private-Network'), 'true')
  })

  it('sets Access-Control-Expose-Headers for actual requests', async () => {
    let router = createRouter({
      middleware: [cors({ exposedHeaders: ['X-Request-Id', 'X-Trace-Id'] })],
    })

    router.get('/', () => new Response('ok'))

    let response = await router.fetch('https://remix.run/', {
      headers: {
        Origin: 'https://example.com',
      },
    })

    assert.equal(response.status, 200)
    assert.equal(response.headers.get('Access-Control-Expose-Headers'), 'X-Request-Id, X-Trace-Id')
  })
})
