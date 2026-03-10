import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createRouter } from '@remix-run/fetch-router'

import { cop, CrossOriginProtection } from './cop.ts'

function createRequest(pathname: string, init?: RequestInit): Request {
  return new Request(`https://example.com${pathname}`, init)
}

function createTestRouter(middleware: ReturnType<typeof cop>[]): ReturnType<typeof createRouter> {
  let router = createRouter({ middleware })

  router.get('/', () => new Response('ok'))
  router.head('/', () => new Response(null, { status: 200 }))
  router.options('/', () => new Response('ok'))
  router.post('/', () => new Response('ok'))
  router.put('/', () => new Response('ok'))
  router.post('/bypass/', () => new Response('ok'))
  router.post('/bypass/*path', () => new Response('ok'))
  router.post('/only/:foo', () => new Response('ok'))
  router.post('/no-trailing', () => new Response('ok'))
  router.post('/yes-trailing/', () => new Response('ok'))
  router.post('/post-only/', () => new Response('ok'))
  router.post('/put-only/', () => new Response('ok'))
  router.post('/get-only/', () => new Response('ok'))

  return router
}

describe('cop middleware', () => {
  it('allows same-origin requests for unsafe methods', async () => {
    let router = createTestRouter([cop()])

    let response = await router.fetch(
      createRequest('/', {
        method: 'POST',
        headers: {
          'Sec-Fetch-Site': 'same-origin',
        },
      }),
    )

    assert.equal(response.status, 200)
  })

  it('allows browser initiated top-level requests with Sec-Fetch-Site none', async () => {
    let router = createTestRouter([cop()])

    let response = await router.fetch(
      createRequest('/', {
        method: 'POST',
        headers: {
          'Sec-Fetch-Site': 'none',
        },
      }),
    )

    assert.equal(response.status, 200)
  })

  it('rejects unsafe cross-site requests from Sec-Fetch-Site', async () => {
    let router = createTestRouter([cop()])

    let response = await router.fetch(
      createRequest('/', {
        method: 'POST',
        headers: {
          'Sec-Fetch-Site': 'cross-site',
        },
      }),
    )

    assert.equal(response.status, 403)
    assert.equal(
      await response.text(),
      'Forbidden: cross-origin request detected from Sec-Fetch-Site header',
    )
  })

  it('rejects same-site requests to preserve origin-level guarantees', async () => {
    let router = createTestRouter([cop()])

    let response = await router.fetch(
      createRequest('/', {
        method: 'POST',
        headers: {
          'Sec-Fetch-Site': 'same-site',
        },
      }),
    )

    assert.equal(response.status, 403)
  })

  it('falls back to Origin when Sec-Fetch-Site is missing', async () => {
    let router = createTestRouter([cop()])

    let allowedResponse = await router.fetch(
      createRequest('/', {
        method: 'POST',
        headers: {
          Origin: 'https://example.com',
        },
      }),
    )

    let deniedResponse = await router.fetch(
      createRequest('/', {
        method: 'POST',
        headers: {
          Origin: 'https://attacker.example',
        },
      }),
    )

    assert.equal(allowedResponse.status, 200)
    assert.equal(deniedResponse.status, 403)
    assert.equal(
      await deniedResponse.text(),
      'Forbidden: cross-origin request detected, and/or browser is out of date: Sec-Fetch-Site is missing, and Origin does not match Host',
    )
  })

  it('allows requests with no browser provenance headers', async () => {
    let router = createTestRouter([cop()])

    let response = await router.fetch(
      createRequest('/', {
        method: 'POST',
      }),
    )

    assert.equal(response.status, 200)
  })

  it('allows safe methods even for cross-site requests', async () => {
    let router = createTestRouter([cop()])

    let response = await router.fetch(
      createRequest('/', {
        method: 'GET',
        headers: {
          'Sec-Fetch-Site': 'cross-site',
        },
      }),
    )

    assert.equal(response.status, 200)
  })

  it('supports trusted origins', async () => {
    let protection = new CrossOriginProtection({
      trustedOrigins: ['https://trusted.example'],
    })
    let router = createTestRouter([protection.middleware()])

    let response = await router.fetch(
      createRequest('/', {
        method: 'POST',
        headers: {
          Origin: 'https://trusted.example',
          'Sec-Fetch-Site': 'cross-site',
        },
      }),
    )

    assert.equal(response.status, 200)
  })

  it('supports insecure bypass patterns', async () => {
    let protection = new CrossOriginProtection({
      insecureBypassPatterns: ['/bypass/', '/only/{foo}', 'POST /post-only/'],
    })
    let router = createTestRouter([protection.middleware()])

    let bypassResponse = await router.fetch(
      createRequest('/bypass/', {
        method: 'POST',
        headers: {
          Origin: 'https://attacker.example',
          'Sec-Fetch-Site': 'cross-site',
        },
      }),
    )

    let wildcardResponse = await router.fetch(
      createRequest('/only/123', {
        method: 'POST',
        headers: {
          Origin: 'https://attacker.example',
        },
      }),
    )

    let methodSpecificResponse = await router.fetch(
      createRequest('/post-only/', {
        method: 'POST',
        headers: {
          Origin: 'https://attacker.example',
        },
      }),
    )

    assert.equal(bypassResponse.status, 200)
    assert.equal(wildcardResponse.status, 200)
    assert.equal(methodSpecificResponse.status, 200)
  })

  it('does not bypass paths that only differ by trailing slash or method', async () => {
    let protection = new CrossOriginProtection({
      insecureBypassPatterns: [
        '/no-trailing',
        '/yes-trailing/',
        'PUT /put-only/',
        'GET /get-only/',
      ],
    })
    let router = createTestRouter([protection.middleware()])

    let noTrailingResponse = await router.fetch(
      createRequest('/no-trailing/', {
        method: 'POST',
        headers: {
          Origin: 'https://attacker.example',
        },
      }),
    )

    let yesTrailingResponse = await router.fetch(
      createRequest('/yes-trailing', {
        method: 'POST',
        headers: {
          Origin: 'https://attacker.example',
        },
      }),
    )

    let putOnlyResponse = await router.fetch(
      createRequest('/put-only/', {
        method: 'POST',
        headers: {
          Origin: 'https://attacker.example',
        },
      }),
    )

    let getOnlyResponse = await router.fetch(
      createRequest('/get-only/', {
        method: 'POST',
        headers: {
          Origin: 'https://attacker.example',
        },
      }),
    )

    assert.equal(noTrailingResponse.status, 403)
    assert.equal(yesTrailingResponse.status, 403)
    assert.equal(putOnlyResponse.status, 403)
    assert.equal(getOnlyResponse.status, 403)
  })

  it('supports custom deny handlers', async () => {
    let router = createTestRouter([
      cop({
        onDeny() {
          return new Response('custom deny', { status: 418 })
        },
      }),
    ])

    let response = await router.fetch(
      createRequest('/', {
        method: 'POST',
        headers: {
          'Sec-Fetch-Site': 'cross-site',
        },
      }),
    )

    assert.equal(response.status, 418)
    assert.equal(await response.text(), 'custom deny')
  })

  it('validates trusted origins and bypass patterns', async () => {
    assert.throws(() => new CrossOriginProtection({ trustedOrigins: ['https://example.com/'] }))
    assert.throws(() => new CrossOriginProtection({ trustedOrigins: ['null'] }))
    assert.throws(() => new CrossOriginProtection({ insecureBypassPatterns: ['POST foo'] }))
    assert.throws(() => new CrossOriginProtection({ insecureBypassPatterns: ['/foo/{...}/bar'] }))
  })
})
