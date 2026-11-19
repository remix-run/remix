import * as assert from 'node:assert/strict'
import * as http from 'node:http'
import type { TestContext } from 'node:test'
import { describe, it } from 'node:test'

import type { FetchHandler } from './fetch-handler.ts'
import type { RequestListenerOptions } from './request-listener.ts'
import { createRequestListener } from './request-listener.ts'

describe('HTTP request authority', () => {
  it('rejects invalid Host authorities before calling a request handler', async (t) => {
    let handler = t.mock.fn((request: Request) => new Response(request.url))
    let onError = t.mock.fn((_error: unknown) => undefined)
    let response = await sendRequest(t, handler, { host: 'example.test/../admin' }, { onError })

    assert.equal(response.status, 400)
    assert.equal(response.body, 'Bad Request')
    assert.equal(handler.mock.callCount(), 0)
    assert.equal(onError.mock.callCount(), 1)
    let error = onError.mock.calls[0].arguments[0]
    assert.ok(error instanceof Error)
    assert.equal(error.message, 'Invalid request authority')
  })

  it('rejects Host userinfo before calling a handler without arguments', async (t) => {
    let handler = t.mock.fn(() => new Response('ok'))
    let response = await sendRequest(t, handler, { host: 'user@example.test' }, { onError() {} })

    assert.equal(response.status, 400)
    assert.equal(handler.mock.callCount(), 0)
  })

  it('rejects invalid trusted X-Forwarded-Host values without falling back to Host', async (t) => {
    let handler = t.mock.fn((request: Request) => new Response(request.url))
    let response = await sendRequest(
      t,
      handler,
      { host: 'example.test', 'x-forwarded-host': 'example.test/../admin, proxy.test' },
      { trustProxy: true, onError() {} },
    )

    assert.equal(response.status, 400)
    assert.equal(handler.mock.callCount(), 0)
  })

  it('validates a fixed host even for a handler without arguments', async (t) => {
    let handler = t.mock.fn(() => new Response('ok'))
    let response = await sendRequest(
      t,
      handler,
      { host: 'example.test' },
      { host: 'example.test?admin', onError() {} },
    )

    assert.equal(response.status, 400)
    assert.equal(handler.mock.callCount(), 0)
  })
})

async function sendRequest(
  t: TestContext,
  handler: FetchHandler,
  headers: http.OutgoingHttpHeaders,
  options?: RequestListenerOptions,
): Promise<{ status: number | undefined; body: string }> {
  let server = http.createServer(createRequestListener(handler, options))
  t.after(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()))
    })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  let address = server.address()
  assert.ok(address && typeof address !== 'string')

  let response = await new Promise<http.IncomingMessage>((resolve, reject) => {
    http
      .get(
        {
          hostname: '127.0.0.1',
          port: address.port,
          path: '/secret?value=%2F',
          headers,
        },
        resolve,
      )
      .on('error', reject)
  })
  response.setEncoding('utf8')
  let body = ''
  for await (let chunk of response) body += chunk
  return { status: response.statusCode, body }
}
