import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { type FetchProxyOptions, createFetchProxy } from './fetch-proxy.ts'

async function testProxy(
  request: Request,
  target: string | URL,
  options?: FetchProxyOptions,
): Promise<{ request: Request; response: Response }> {
  let capturedRequest: Request
  let proxy = createFetchProxy(target, {
    ...options,
    fetch(input, init) {
      capturedRequest = new Request(input, init)
      return options?.fetch?.(input, init) ?? Promise.resolve(new Response())
    },
  })

  let response = await proxy(request)

  assert.ok(capturedRequest!)

  return { request: capturedRequest, response }
}

describe('fetch proxy', () => {
  it('appends the request URL pathname + search to the target URL', async () => {
    let { request: request1 } = await testProxy(
      new Request('http://shopify.com'),
      'https://remix.run:3000/dest',
    )

    assert.equal(request1.url, 'https://remix.run:3000/dest')

    let { request: request2 } = await testProxy(
      new Request('http://shopify.com/?q=remix'),
      'https://remix.run:3000/dest',
    )

    assert.equal(request2.url, 'https://remix.run:3000/dest?q=remix')

    let { request: request3 } = await testProxy(
      new Request('http://shopify.com/search?q=remix'),
      'https://remix.run:3000/',
    )

    assert.equal(request3.url, 'https://remix.run:3000/search?q=remix')

    let { request: request4 } = await testProxy(
      new Request('http://shopify.com/search?q=remix'),
      'https://remix.run:3000/dest',
    )

    assert.equal(request4.url, 'https://remix.run:3000/dest/search?q=remix')
  })

  it('forwards request method, headers, and body', async () => {
    let { request } = await testProxy(
      new Request('http://shopify.com/search?q=remix', {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
        },
        body: 'hello',
      }),
      'https://remix.run:3000/dest',
    )

    assert.equal(request.method, 'POST')
    assert.equal(request.headers.get('Content-Type'), 'text/plain')
    assert.equal(await request.text(), 'hello')
  })

  it('forwards an empty request body', async () => {
    let { request } = await testProxy(
      new Request('http://shopify.com/search?q=remix', {
        method: 'POST',
      }),
      'https://remix.run:3000/dest',
    )

    assert.equal(request.method, 'POST')
    assert.equal(request.headers.get('Content-Type'), null)
    assert.equal(await request.text(), '')
  })

  it('forwards various HTTP methods correctly', async () => {
    let methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD']

    for (let method of methods) {
      let { request } = await testProxy(
        new Request('http://shopify.com/api/resource', {
          method,
        }),
        'https://remix.run:3000/backend',
      )

      assert.equal(request.method, method, `Method ${method} should be forwarded correctly`)
    }
  })

  it('does not append X-Forwarded-Proto and X-Forwarded-Host headers by default', async () => {
    let { request } = await testProxy(
      new Request('http://shopify.com:8080/search?q=remix'),
      'https://remix.run:3000/dest',
    )

    assert.equal(request.headers.get('X-Forwarded-Proto'), null)
    assert.equal(request.headers.get('X-Forwarded-Host'), null)
  })

  it('appends X-Forwarded-Proto and X-Forwarded-Host headers when desired', async () => {
    let { request } = await testProxy(
      new Request('http://shopify.com:8080/search?q=remix'),
      'https://remix.run:3000/dest',
      {
        xForwardedHeaders: true,
      },
    )

    assert.equal(request.headers.get('X-Forwarded-Proto'), 'http')
    assert.equal(request.headers.get('X-Forwarded-Host'), 'shopify.com:8080')
  })

  it('forwards additional request init options', async () => {
    let { request } = await testProxy(
      new Request('http://shopify.com/search?q=remix', {
        method: 'DELETE',
        cache: 'no-cache',
        credentials: 'include',
        redirect: 'manual',
      }),
      'https://remix.run:3000/dest',
    )

    assert.equal(request.method, 'DELETE')
    assert.equal(request.cache, 'no-cache')
    assert.equal(request.credentials, 'include')
    assert.equal(request.redirect, 'manual')
  })

  it('rewrites cookie domain and path', async () => {
    let { response } = await testProxy(
      new Request('http://shopify.com/search?q=remix'),
      'https://remix.run:3000/dest',
      {
        async fetch() {
          return new Response(null, {
            headers: [
              ['Set-Cookie', 'name=value; Domain=remix.run:3000; Path=/dest/search'],
              ['Set-Cookie', 'name2=value2; Domain=remix.run:3000; Path=/dest'],
            ],
          })
        },
      },
    )

    let setCookie = response.headers.getSetCookie()
    assert.ok(setCookie)
    assert.equal(setCookie.length, 2)
    assert.equal(setCookie[0], 'name=value; Domain=shopify.com; Path=/search')
    assert.equal(setCookie[1], 'name2=value2; Domain=shopify.com; Path=/')
  })

  it('does not rewrite cookie domain and path when opting-out', async () => {
    let { response } = await testProxy(
      new Request('http://shopify.com/?q=remix'),
      'https://remix.run:3000/dest',
      {
        rewriteCookieDomain: false,
        rewriteCookiePath: false,
        async fetch() {
          return new Response(null, {
            headers: [
              ['Set-Cookie', 'name=value; Domain=remix.run:3000; Path=/dest/search'],
              ['Set-Cookie', 'name2=value2; Domain=remix.run:3000; Path=/dest'],
            ],
          })
        },
      },
    )

    let setCookie = response.headers.getSetCookie()
    assert.ok(setCookie)
    assert.equal(setCookie.length, 2)
    assert.equal(setCookie[0], 'name=value; Domain=remix.run:3000; Path=/dest/search')
    assert.equal(setCookie[1], 'name2=value2; Domain=remix.run:3000; Path=/dest')
  })

  it('preserves all request properties when using proxy(request)', async () => {
    let capturedRequest: Request
    let proxy = createFetchProxy('https://remix.run:3000/dest', {
      fetch(input, init) {
        capturedRequest = new Request(input, init)
        return Promise.resolve(new Response())
      },
    })

    let originalRequest = new Request('http://shopify.com/api/resource', {
      method: 'PUT',
      cache: 'no-store',
      credentials: 'omit',
      integrity: 'sha256-BpfBw7ivV8q2jLiT13fxDYAe2tJllusRSZ273h2nFSE=',
      keepalive: true,
      mode: 'cors',
      redirect: 'error',
      referrer: 'http://example.com',
      referrerPolicy: 'no-referrer',
    })

    await proxy(originalRequest)

    assert.ok(capturedRequest!)
    assert.equal(capturedRequest.method, 'PUT')
    assert.equal(capturedRequest.cache, 'no-store')
    assert.equal(capturedRequest.credentials, 'omit')
    assert.equal(capturedRequest.integrity, 'sha256-BpfBw7ivV8q2jLiT13fxDYAe2tJllusRSZ273h2nFSE=')
    assert.equal(capturedRequest.keepalive, true)
    assert.equal(capturedRequest.mode, 'cors')
    assert.equal(capturedRequest.redirect, 'error')
    // Note: The actual referrer value depends on platform-specific behavior in the Request API.
    // On some platforms, cross-origin referrers may be rejected and fall back to "about:client",
    // so we can't reliably test these values.
    // assert.equal(capturedRequest.referrer, 'http://example.com/')
    // assert.equal(capturedRequest.referrerPolicy, 'no-referrer')
  })

  it('allows init to override request properties', async () => {
    let capturedRequest: Request
    let proxy = createFetchProxy('https://remix.run:3000/dest', {
      fetch(input, init) {
        capturedRequest = new Request(input, init)
        return Promise.resolve(new Response())
      },
    })

    let originalRequest = new Request('http://shopify.com/api/resource', {
      method: 'PUT',
      cache: 'no-store',
      credentials: 'omit',
    })

    await proxy(originalRequest, {
      method: 'POST',
      cache: 'default',
      credentials: 'include',
    })

    assert.ok(capturedRequest!)
    assert.equal(capturedRequest.method, 'POST')
    assert.equal(capturedRequest.cache, 'default')
    assert.equal(capturedRequest.credentials, 'include')
  })
})

describe('fetch proxy (double-arg style)', () => {
  it('works with proxy(url, init) style', async () => {
    let capturedRequest: Request
    let proxy = createFetchProxy('https://remix.run:3000/dest', {
      fetch(input, init) {
        capturedRequest = new Request(input, init)
        return Promise.resolve(new Response())
      },
    })

    await proxy('http://shopify.com/api/resource', {
      method: 'PATCH',
      cache: 'reload',
      credentials: 'same-origin',
      headers: {
        'X-Custom': 'value',
      },
    })

    assert.ok(capturedRequest!)
    assert.equal(capturedRequest.method, 'PATCH')
    assert.equal(capturedRequest.cache, 'reload')
    assert.equal(capturedRequest.credentials, 'same-origin')
    assert.equal(capturedRequest.headers.get('X-Custom'), 'value')
    assert.equal(capturedRequest.url, 'https://remix.run:3000/dest/api/resource')
  })

  it('handles proxy(url) with defaults', async () => {
    let capturedRequest: Request
    let proxy = createFetchProxy('https://remix.run:3000/dest', {
      fetch(input, init) {
        capturedRequest = new Request(input, init)
        return Promise.resolve(new Response())
      },
    })

    await proxy('http://shopify.com/api/resource')

    assert.ok(capturedRequest!)
    assert.equal(capturedRequest.method, 'GET')
    assert.equal(capturedRequest.url, 'https://remix.run:3000/dest/api/resource')
  })

  it('forwards headers correctly with proxy(url, init)', async () => {
    let capturedRequest: Request
    let proxy = createFetchProxy('https://remix.run:3000/dest', {
      fetch(input, init) {
        capturedRequest = new Request(input, init)
        return Promise.resolve(new Response())
      },
    })

    await proxy('http://shopify.com/api/resource', {
      headers: {
        Authorization: 'Bearer token123',
        'Content-Type': 'application/json',
      },
    })

    assert.ok(capturedRequest!)
    assert.equal(capturedRequest.headers.get('Authorization'), 'Bearer token123')
    assert.equal(capturedRequest.headers.get('Content-Type'), 'application/json')
  })

  it('handles body with proxy(url, init)', async () => {
    let capturedRequest: Request
    let proxy = createFetchProxy('https://remix.run:3000/dest', {
      fetch(input, init) {
        capturedRequest = new Request(input, init)
        return Promise.resolve(new Response())
      },
    })

    let body = JSON.stringify({ name: 'test', value: 123 })
    await proxy('http://shopify.com/api/resource', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body,
    })

    assert.ok(capturedRequest!)
    assert.equal(capturedRequest.method, 'POST')
    assert.equal(await capturedRequest.text(), body)
  })
})
