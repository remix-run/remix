import * as assert from 'node:assert/strict'
import * as http2 from 'node:http2'
import type { TestContext } from 'node:test'
import { describe, it } from 'node:test'

import type { FetchHandler } from './fetch-handler.ts'
import type { RequestListenerOptions } from './request-listener.ts'
import { createRequestListener } from './request-listener.ts'

describe('HTTP/2 request authority', () => {
  it('rejects conflicting Host values before calling a request handler', async (t) => {
    let handlerCalled = false
    let onError = t.mock.fn((_error: unknown) => undefined)
    let response = await sendRequest(
      t,
      (_request) => {
        handlerCalled = true
        return new Response('ok')
      },
      { ':authority': 'example.com', host: 'other.example.com' },
      { onError },
    )

    assert.equal(response.status, 400)
    assert.equal(response.body, 'Bad Request')
    assert.equal(handlerCalled, false)
    assert.equal(onError.mock.callCount(), 1)
    let error = onError.mock.calls[0].arguments[0]
    assert.ok(error instanceof Error)
    assert.equal(error.message, 'Host header does not match :authority')
  })

  it('rejects conflicting Host values before calling a handler without arguments', async (t) => {
    let handlerCalled = false
    let onError = t.mock.fn(async () => new Response('Invalid host', { status: 422 }))
    let response = await sendRequest(
      t,
      () => {
        handlerCalled = true
        return new Response('ok')
      },
      { ':authority': 'example.com', host: 'other.example.com' },
      { onError },
    )

    assert.equal(response.status, 422)
    assert.equal(response.body, 'Invalid host')
    assert.equal(handlerCalled, false)
    assert.equal(onError.mock.callCount(), 1)
  })

  it('rejects conflicting ports before calling a handler with client information', async (t) => {
    let handlerCalled = false
    let onError = t.mock.fn()
    let response = await sendRequest(
      t,
      (_request, _client) => {
        handlerCalled = true
        return new Response('ok')
      },
      { ':authority': 'example.com:8080', host: 'example.com:8081' },
      { host: 'app.example.com', trustProxy: true, onError },
    )

    assert.equal(response.status, 400)
    assert.equal(handlerCalled, false)
    assert.equal(onError.mock.callCount(), 1)
  })

  it('uses a custom error response for conflicting Host values', async (t) => {
    let handler = t.mock.fn((_request: Request) => new Response('ok'))
    let response = await sendRequest(
      t,
      handler,
      { ':authority': 'example.com', host: 'other.example.com' },
      {
        onError() {
          return new Response('Invalid host', { status: 422 })
        },
      },
    )

    assert.equal(response.status, 422)
    assert.equal(response.body, 'Invalid host')
    assert.equal(handler.mock.callCount(), 0)
  })

  it('returns 400 by default for conflicting Host values', async (t) => {
    t.mock.method(console, 'error', () => undefined)
    let response = await sendRequest(t, (_request) => new Response('ok'), {
      ':authority': 'example.com',
      host: 'other.example.com',
    })

    assert.equal(response.status, 400)
    assert.equal(response.body, 'Bad Request')
  })

  it('uses authority when Host is equivalent after HTTP normalization', async (t) => {
    let response = await sendRequest(
      t,
      (request) => new Response(request.url),
      { ':authority': 'example.com:80', host: 'EXAMPLE.COM' },
      { protocol: 'https:' },
    )

    assert.equal(response.status, 200)
    assert.equal(response.body, 'https://example.com:80/')
  })

  it('normalizes default ports using the HTTP/2 scheme', async (t) => {
    let response = await sendRequest(t, (request) => new Response(request.url), {
      ':scheme': 'https',
      ':authority': 'example.com:443',
      host: 'EXAMPLE.COM',
    })

    assert.equal(response.status, 200)
    assert.equal(response.body, 'http://example.com:443/')
  })

  it('accepts equivalent IPv6 hosts with a nondefault port', async (t) => {
    let response = await sendRequest(t, (request) => new Response(request.url), {
      ':authority': '[2001:db8::1]:8080',
      host: '[2001:0DB8:0:0:0:0:0:1]:8080',
    })

    assert.equal(response.status, 200)
    assert.equal(response.body, 'http://[2001:db8::1]:8080/')
  })

  it('uses authority when Host is absent', async (t) => {
    let response = await sendRequest(t, (request) => new Response(request.url), {
      ':authority': 'example.com',
    })

    assert.equal(response.status, 200)
    assert.equal(response.body, 'http://example.com/')
  })

  it('uses Host when authority is absent', async (t) => {
    let response = await sendRequest(t, (request) => new Response(request.url), {
      host: 'example.com',
    })

    assert.equal(response.status, 200)
    assert.equal(response.body, 'http://example.com/')
  })

  it('preserves explicit host and protocol overrides', async (t) => {
    let response = await sendRequest(
      t,
      (request) => new Response(request.url),
      {
        ':authority': 'example.com',
        host: 'example.com',
        forwarded: 'host=proxy.example.com;proto=http',
      },
      { host: 'app.example.com', protocol: 'https:', trustProxy: true },
    )

    assert.equal(response.status, 200)
    assert.equal(response.body, 'https://app.example.com/')
  })

  it('preserves trusted proxy host and protocol overrides', async (t) => {
    let response = await sendRequest(
      t,
      (request) => new Response(request.url),
      {
        ':authority': 'example.com',
        host: 'example.com',
        forwarded: 'host=proxy.example.com;proto=https',
      },
      { trustProxy: true },
    )

    assert.equal(response.status, 200)
    assert.equal(response.body, 'https://proxy.example.com/')
  })
})

async function sendRequest(
  t: TestContext,
  handler: FetchHandler,
  headers: http2.OutgoingHttpHeaders,
  options?: RequestListenerOptions,
): Promise<{ status: number | undefined; body: string }> {
  let server = http2.createServer()
  server.on('request', createRequestListener(handler, options))
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  let address = server.address()
  assert.ok(address && typeof address !== 'string')

  let client = http2.connect(`http://127.0.0.1:${address.port}`)
  t.after(async () => {
    client.destroy()
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()))
    })
  })

  let request = client.request({ ':method': 'GET', ':scheme': 'http', ':path': '/', ...headers })
  let status: number | undefined
  request.on('response', (headers) => {
    status = headers[':status']
  })
  request.setEncoding('utf8')
  request.end()

  let body = ''
  for await (let chunk of request) body += chunk
  return { status, body }
}
