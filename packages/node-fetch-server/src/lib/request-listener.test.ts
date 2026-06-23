import * as assert from 'node:assert/strict'
import type { TestContext } from 'node:test'
import { describe, it } from 'node:test'
import type * as http from 'node:http'
import * as stream from 'node:stream'

import { type ClientAddress, type FetchHandler } from './fetch-handler.ts'
import { createRequest, createRequestListener } from './request-listener.ts'

describe('createRequestListener', () => {
  it('returns a request listener', async (t) => {
    await new Promise<void>((resolve) => {
      let handler: FetchHandler = async () => new Response('Hello, world!')

      let listener = createRequestListener(handler)
      assert.ok(listener)

      let req = createMockRequest()
      let res = createMockResponse({ req })

      let chunks: Uint8Array[] = []
      t.mock.method(res, 'write', (chunk: Uint8Array) => {
        chunks.push(chunk)
      })

      t.mock.method(res, 'end', (chunk?: Uint8Array) => {
        if (chunk != null) chunks.push(chunk)
        let body = Buffer.concat(chunks).toString()
        assert.equal(body, 'Hello, world!')
        resolve()
      })

      listener(req, res)
    })
  })

  it('returns custom status, statusText, and header values (HTTP/1)', async (t) => {
    await new Promise<void>((resolve) => {
      let handler: FetchHandler = async () =>
        new Response('Hello, world!', {
          status: 201,
          statusText: 'Created!',
          headers: {
            'X-A': 'A',
            'X-B': 'B',
          },
        })

      let listener = createRequestListener(handler)
      assert.ok(listener)

      let req = createMockRequest()
      req.httpVersionMajor = 1
      let res = createMockResponse({ req })

      t.mock.method(
        res,
        'writeHead',
        (status: number, statusText: string, headers: Record<string, string | string[]>) => {
          assert.equal(status, 201)
          assert.equal(statusText, 'Created!')
          assert.equal(headers['x-a'], 'A')
          assert.equal(headers['x-b'], 'B')
        },
      )

      t.mock.method(res, 'end', () => resolve())

      listener(req, res)
    })
  })

  it('returns custom status, statusText, and header values (HTTP/2)', async (t) => {
    await new Promise<void>((resolve) => {
      let handler: FetchHandler = async () =>
        new Response('Hello, world!', {
          status: 201,
          statusText: 'Created!',
          headers: {
            'X-A': 'A',
            'X-B': 'B',
          },
        })

      let listener = createRequestListener(handler)
      assert.ok(listener)

      let req = createMockRequest()
      req.httpVersionMajor = 2
      let res = createMockResponse({ req })

      t.mock.method(
        res,
        'writeHead',
        (status: number, headers: Record<string, string | string[]>) => {
          assert.equal(status, 201)
          assert.equal(headers['x-a'], 'A')
          assert.equal(headers['x-b'], 'B')
        },
      )

      t.mock.method(res, 'end', () => resolve())

      listener(req, res)
    })
  })

  it('calls onError when an error is thrown in the request handler', async (t) => {
    await new Promise<void>((resolve) => {
      let handler: FetchHandler = async () => {
        throw new Error('boom!')
      }
      let errorHandler = t.mock.fn()

      let listener = createRequestListener(handler, { onError: errorHandler })
      assert.ok(listener)

      let req = createMockRequest()
      let res = createMockResponse({ req })

      t.mock.method(res, 'end', () => {
        assert.equal(errorHandler.mock.calls.length, 1)
        resolve()
      })

      listener(req, res)
    })
  })

  it('returns a 500 "Internal Server Error" response when an error is thrown in the request handler', async (t) => {
    await new Promise<void>((resolve) => {
      let handler: FetchHandler = async () => {
        throw new Error('boom!')
      }
      let errorHandler = async () => {
        // ignore
      }

      let listener = createRequestListener(handler, { onError: errorHandler })
      assert.ok(listener)

      let req = createMockRequest()
      let res = createMockResponse({ req })

      let status: number | undefined
      t.mock.method(res, 'writeHead', (statusCode: number) => {
        status = statusCode
      })

      let chunks: Uint8Array[] = []
      t.mock.method(res, 'write', (chunk: Uint8Array) => {
        chunks.push(chunk)
      })

      t.mock.method(res, 'end', (chunk?: Uint8Array) => {
        if (chunk != null) chunks.push(chunk)
        assert.equal(status, 500)
        let body = Buffer.concat(chunks).toString()
        assert.equal(body, 'Internal Server Error')
        resolve()
      })

      listener(req, res)
    })
  })

  it('does not forward request abort errors to onError when the response closes before the handler returns', async (t) => {
    let handler: FetchHandler = async (request) =>
      await new Promise<Response>((_resolve, reject) => {
        request.signal.addEventListener('abort', () => reject(request.signal.reason), {
          once: true,
        })
      })
    let errorHandler = t.mock.fn()

    let listener = createRequestListener(handler, { onError: errorHandler })
    assert.ok(listener)

    let req = createMockRequest()
    let res = createMockResponse({ req })
    let writeHead = t.mock.method(res, 'writeHead')
    let end = t.mock.method(res, 'end')

    listener(req, res)
    res.emit('close')

    await new Promise((resolve) => setTimeout(resolve, 0))

    assert.equal(errorHandler.mock.calls.length, 0)
    assert.equal(writeHead.mock.calls.length, 0)
    assert.equal(end.mock.calls.length, 0)
  })

  it('drops the response without writing when the request was aborted before send', async (t) => {
    let errorHandler = t.mock.fn()

    let handler: FetchHandler = (request) =>
      new Promise<Response>((resolve) => {
        request.signal.addEventListener(
          'abort',
          () => {
            // Resolve with a normal-looking response after the abort fires, as
            // a consumer's outer try/catch would do.
            resolve(new Response('Internal Server Error', { status: 500 }))
          },
          { once: true },
        )
      })

    let listener = createRequestListener(handler, { onError: errorHandler })
    assert.ok(listener)

    let req = createMockRequest()
    let res = createMockResponse({ req })
    let writeHead = t.mock.method(res, 'writeHead')
    let write = t.mock.method(res, 'write')
    let end = t.mock.method(res, 'end')

    listener(req, res)
    res.emit('close')

    await new Promise((resolve) => setTimeout(resolve, 0))

    assert.equal(errorHandler.mock.calls.length, 0)
    assert.equal(writeHead.mock.calls.length, 0)
    assert.equal(write.mock.calls.length, 0)
    assert.equal(end.mock.calls.length, 0)
  })

  it('drops a late response after close when the handler does not read the request signal', async (t) => {
    let resolveResponse!: (response: Response) => void
    let handlerResponse = new Promise<Response>((resolve) => {
      resolveResponse = resolve
    })
    let handler: FetchHandler = (_request) => handlerResponse
    let errorHandler = t.mock.fn()

    let listener = createRequestListener(handler, { onError: errorHandler })
    assert.ok(listener)

    let req = createMockRequest()
    let res = createMockResponse({ req })
    let writeHead = t.mock.method(res, 'writeHead')
    let write = t.mock.method(res, 'write')
    let end = t.mock.method(res, 'end')

    listener(req, res)
    res.emit('close')
    resolveResponse(new Response('late'))

    await new Promise((resolve) => setTimeout(resolve, 0))

    assert.equal(errorHandler.mock.calls.length, 0)
    assert.equal(writeHead.mock.calls.length, 0)
    assert.equal(write.mock.calls.length, 0)
    assert.equal(end.mock.calls.length, 0)
  })

  it('drops a late zero-argument handler response after close', async (t) => {
    let resolveResponse!: (response: Response) => void
    let handlerResponse = new Promise<Response>((resolve) => {
      resolveResponse = resolve
    })
    let handler: FetchHandler = () => handlerResponse
    let errorHandler = t.mock.fn()

    let listener = createRequestListener(handler, { onError: errorHandler })
    assert.ok(listener)

    let req = createMockRequest()
    let res = createMockResponse({ req })
    let writeHead = t.mock.method(res, 'writeHead')
    let write = t.mock.method(res, 'write')
    let end = t.mock.method(res, 'end')

    listener(req, res)
    res.emit('close')
    resolveResponse(new Response('late'))

    await new Promise((resolve) => setTimeout(resolve, 0))

    assert.equal(errorHandler.mock.calls.length, 0)
    assert.equal(writeHead.mock.calls.length, 0)
    assert.equal(write.mock.calls.length, 0)
    assert.equal(end.mock.calls.length, 0)
  })

  it('does not forward request abort errors to onError while streaming the response body', async (t) => {
    let encoder = new TextEncoder()
    let errorHandler = t.mock.fn()

    let handler: FetchHandler = (request) =>
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode('first'))
            request.signal.addEventListener(
              'abort',
              () => {
                controller.error(request.signal.reason)
              },
              { once: true },
            )
          },
        }),
      )

    let listener = createRequestListener(handler, { onError: errorHandler })
    assert.ok(listener)

    let req = createMockRequest()
    let res = createMockResponse({ req })
    let writeHead = t.mock.method(res, 'writeHead')
    let end = t.mock.method(res, 'end')

    t.mock.method(res, 'write', () => {
      res.emit('close')
      return true
    })

    listener(req, res)

    await new Promise((resolve) => setTimeout(resolve, 0))

    assert.equal(errorHandler.mock.calls.length, 0)
    assert.equal(writeHead.mock.calls.length, 1)
    assert.equal(end.mock.calls.length, 0)
  })

  it('does not send an error response when a response stream errors after headers are sent', async (t) => {
    let encoder = new TextEncoder()
    let streamError = new Error('boom after commit')
    let errorHandler = t.mock.fn(() => new Response('fallback', { status: 500 }))
    let handler: FetchHandler = (_request) =>
      new Response(
        new ReadableStream({
          pull(controller) {
            if (chunks.length === 0) {
              controller.enqueue(encoder.encode('partial'))
            } else {
              controller.error(streamError)
            }
          },
        }),
      )

    let listener = createRequestListener(handler, { onError: errorHandler })
    assert.ok(listener)

    let req = createMockRequest()
    req.httpVersionMajor = 1

    let writeHeadCalls = 0
    let endCalls = 0
    let destroyedError: Error | undefined
    let chunks: Uint8Array[] = []

    let responseFinished = new Promise<void>((resolve) => {
      let res = Object.assign(new stream.Writable(), {
        req,
        writeHead() {
          writeHeadCalls++
        },
        write(chunk: Uint8Array) {
          chunks.push(chunk)
          return true
        },
        end() {
          endCalls++
          resolve()
        },
        destroy(error?: Error) {
          destroyedError = error
          res.emit('close')
          resolve()
          return res
        },
      }) as unknown as http.ServerResponse

      Object.defineProperty(res, 'headersSent', {
        get() {
          return writeHeadCalls > 0
        },
      })

      listener(req, res)
    })

    await waitFor(
      responseFinished,
      100,
      'Expected the response to end or close after the stream error',
    )

    assert.equal(writeHeadCalls, 1)
    assert.equal(errorHandler.mock.calls.length, 1)
    assert.equal(endCalls, 0)
    assert.equal(destroyedError, streamError)
    assert.equal(Buffer.concat(chunks).toString(), 'partial')
  })

  it('destroys the response without waiting for a slow error handler for committed stream errors', async (t) => {
    let encoder = new TextEncoder()
    let streamError = new Error('boom after commit')
    let resolveErrorHandler!: () => void
    let errorHandlerStarted = false
    let errorHandlerFinished = false
    let errorHandler = t.mock.fn(async () => {
      errorHandlerStarted = true
      await new Promise<void>((resolve) => {
        resolveErrorHandler = resolve
      })
      errorHandlerFinished = true
      return new Response('fallback', { status: 500 })
    })
    let handler: FetchHandler = (_request) =>
      new Response(
        new ReadableStream({
          pull(controller) {
            if (chunks.length === 0) {
              controller.enqueue(encoder.encode('partial'))
            } else {
              controller.error(streamError)
            }
          },
        }),
      )

    let listener = createRequestListener(handler, { onError: errorHandler })
    assert.ok(listener)

    let req = createMockRequest()
    req.httpVersionMajor = 1

    let writeHeadCalls = 0
    let destroyedError: Error | undefined
    let chunks: Uint8Array[] = []

    let responseDestroyed = new Promise<void>((resolve) => {
      let res = Object.assign(new stream.Writable(), {
        req,
        writeHead() {
          writeHeadCalls++
        },
        write(chunk: Uint8Array) {
          chunks.push(chunk)
          return true
        },
        end() {},
        destroy(error?: Error) {
          destroyedError = error
          res.emit('close')
          resolve()
          return res
        },
      }) as unknown as http.ServerResponse

      Object.defineProperty(res, 'headersSent', {
        get() {
          return writeHeadCalls > 0
        },
      })

      listener(req, res)
    })

    await waitFor(
      responseDestroyed,
      100,
      'Expected the response to be destroyed before the slow error handler resolved',
    )

    assert.equal(writeHeadCalls, 1)
    assert.equal(errorHandler.mock.calls.length, 1)
    assert.equal(errorHandlerStarted, true)
    assert.equal(errorHandlerFinished, false)
    assert.equal(destroyedError, streamError)
    assert.equal(Buffer.concat(chunks).toString(), 'partial')

    resolveErrorHandler()
    await new Promise((resolve) => setTimeout(resolve, 0))
    assert.equal(errorHandlerFinished, true)
  })

  it('rejects lazy request body reads when the request aborts before ending', async (t) => {
    await assertLazyRequestBodyReadRejects(
      t,
      (request) => request.text(),
      (req) => {
        req.emit('aborted')
        req.emit('error', new Error('late socket error'))
      },
      (error, signalReason) => {
        assert.equal(error, signalReason)
        assert.equal((error as DOMException).name, 'AbortError')
      },
    )
  })

  it('rejects lazy buffered request body reads when the request closes before ending', async (t) => {
    await assertLazyRequestBodyReadRejects(
      t,
      (request) => request.arrayBuffer(),
      (req) => {
        req.emit('close')
      },
      (error, signalReason) => {
        assert.equal(error, signalReason)
        assert.equal((error as DOMException).name, 'AbortError')
      },
    )
  })

  it('treats lazy request body errors as request abort errors', async (t) => {
    let bodyError = new Error('client upload failed')

    await assertLazyRequestBodyReadRejects(
      t,
      (request) => request.bytes(),
      (req) => {
        req.emit('error', bodyError)
      },
      (error, signalReason) => {
        assert.equal(error, bodyError)
        assert.equal(signalReason, bodyError)
      },
    )
  })

  it('treats materialized request body errors as request abort errors after response close', async (t) => {
    let bodyError = new Error('client upload failed')
    let handlerFinished!: () => void
    let handlerDone = new Promise<void>((resolve) => {
      handlerFinished = resolve
    })
    let handler: FetchHandler = async (request) => {
      try {
        assert.equal(request.url, 'http://localhost/')
        await request.text()
        return new Response('ok')
      } finally {
        handlerFinished()
      }
    }
    let errorHandler = t.mock.fn()

    let listener = createRequestListener(handler, { onError: errorHandler })
    assert.ok(listener)

    let req = createPendingMockRequest()
    let res = createMockResponse({ req })
    let writeHead = t.mock.method(res, 'writeHead')
    let write = t.mock.method(res, 'write')
    let end = t.mock.method(res, 'end')

    listener(req, res)
    res.emit('close')
    req.emit('error', bodyError)

    await waitFor(
      handlerDone,
      100,
      'Expected the materialized request body read to settle when the request failed',
    )
    await new Promise((resolve) => setTimeout(resolve, 0))

    assert.equal(errorHandler.mock.calls.length, 0)
    assert.equal(writeHead.mock.calls.length, 0)
    assert.equal(write.mock.calls.length, 0)
    assert.equal(end.mock.calls.length, 0)
  })

  it('rejects lazy request body reads when the request already aborted', async (t) => {
    let continueHandler!: () => void
    let handlerCanContinue = new Promise<void>((resolve) => {
      continueHandler = resolve
    })

    await assertLazyRequestBodyReadRejects(
      t,
      async (request) => {
        await handlerCanContinue
        return await request.text()
      },
      (req) => {
        markMockRequestAborted(req)
        req.emit('aborted')
        continueHandler()
      },
      (error, signalReason) => {
        assert.equal(error, signalReason)
        assert.equal((error as DOMException).name, 'AbortError')
      },
    )
  })

  it('keeps an error listener after already-aborted lazy request body reads', async (t) => {
    let continueHandler!: () => void
    let handlerCanContinue = new Promise<void>((resolve) => {
      continueHandler = resolve
    })
    let handlerFinished!: () => void
    let handlerDone = new Promise<void>((resolve) => {
      handlerFinished = resolve
    })
    let handler: FetchHandler = async (request) => {
      await handlerCanContinue

      await assert.rejects(request.text(), (error) => {
        assert.equal(error, request.signal.reason)
        assert.equal((error as DOMException).name, 'AbortError')
        return true
      })

      handlerFinished()
      return new Response('ok')
    }
    let errorHandler = t.mock.fn()

    let listener = createRequestListener(handler, { onError: errorHandler })
    assert.ok(listener)

    let req = createPendingMockRequest()
    let res = createMockResponse({ req })
    let writeHead = t.mock.method(res, 'writeHead')
    let write = t.mock.method(res, 'write')
    let end = t.mock.method(res, 'end')

    listener(req, res)
    markMockRequestAborted(req)
    req.emit('aborted')
    continueHandler()

    await waitFor(
      handlerDone,
      100,
      'Expected the lazy request body read to reject when the request had already aborted',
    )

    assert.doesNotThrow(() => req.emit('error', new Error('late socket error')))
    assert.equal(errorHandler.mock.calls.length, 0)
    assert.equal(writeHead.mock.calls.length, 0)
    assert.equal(write.mock.calls.length, 0)
    assert.equal(end.mock.calls.length, 0)
  })

  it('returns a stable signal after materializing lazy requests', async (t) => {
    await new Promise<void>((resolve) => {
      let handler: FetchHandler = async (request) => {
        let signal = request.signal
        assert.equal(request.url, 'http://localhost/')
        assert.equal(request.signal, signal)
        return new Response('ok')
      }

      let listener = createRequestListener(handler)
      assert.ok(listener)

      let req = createMockRequest()
      let res = createMockResponse({ req })
      t.mock.method(res, 'end', () => resolve())

      listener(req, res)
    })
  })

  it('uses the `Host` header to construct the URL by default', async () => {
    await new Promise<void>((resolve) => {
      let handler: FetchHandler = async (request) => {
        assert.ok(request instanceof Request)
        assert.equal(request.url, 'http://example.com/')
        return new Response('Hello, world!')
      }

      let listener = createRequestListener(handler)
      assert.ok(listener)

      let req = createMockRequest({ headers: { Host: 'example.com' } })
      let res = createMockResponse({ req })

      listener(req, res)
      resolve()
    })
  })

  it('uses the `:authority` header to construct the URL for http/2 requests', async () => {
    await new Promise<void>((resolve) => {
      let handler: FetchHandler = async (request) => {
        assert.equal(request.url, 'http://example.com/')
        return new Response('Hello, world!')
      }

      let listener = createRequestListener(handler)
      assert.ok(listener)

      let req = createMockRequest({ headers: { ':authority': 'example.com' } })
      let res = createMockResponse({ req })

      listener(req, res)
      resolve()
    })
  })

  it('uses the `host` option to override the `Host` header', async () => {
    await new Promise<void>((resolve) => {
      let handler: FetchHandler = async (request) => {
        assert.equal(request.url, 'http://remix.run/')
        return new Response('Hello, world!')
      }

      let listener = createRequestListener(handler, { host: 'remix.run' })
      assert.ok(listener)

      let req = createMockRequest({ headers: { Host: 'example.com' } })
      let res = createMockResponse({ req })

      listener(req, res)
      resolve()
    })
  })

  it('uses the `protocol` option to construct the URL', async () => {
    await new Promise<void>((resolve) => {
      let handler: FetchHandler = async (request) => {
        assert.equal(request.url, 'https://example.com/')
        return new Response('Hello, world!')
      }

      let listener = createRequestListener(handler, { protocol: 'https:' })
      assert.ok(listener)

      let req = createMockRequest({ headers: { Host: 'example.com' } })
      let res = createMockResponse({ req })

      listener(req, res)
      resolve()
    })
  })

  it('ignores proxy headers by default', async (t) => {
    let requestUrl = await captureRequestUrl(t, {
      headers: {
        Host: 'example.com',
        Forwarded: 'for=203.0.113.43; proto=https; host=remix.run',
        'X-Forwarded-Host': 'remix.run',
        'X-Forwarded-Proto': 'https',
      },
    })
    assert.equal(requestUrl, 'http://example.com/')
  })

  it('uses the `Forwarded` proto and host parameters when proxies are trusted', async (t) => {
    let requestUrl = await captureRequestUrl(
      t,
      {
        headers: {
          Host: 'example.com',
          Forwarded: 'for=203.0.113.43; proto=https; host=remix.run',
        },
      },
      { trustProxy: true },
    )
    assert.equal(requestUrl, 'https://remix.run/')
  })

  it('uses quoted `Forwarded` proto and host values when proxies are trusted', async (t) => {
    let requestUrl = await captureRequestUrl(
      t,
      {
        headers: {
          Host: 'example.com',
          Forwarded: 'for="[2001:db8:cafe::17]"; proto="https"; host="remix.run"',
        },
      },
      { trustProxy: true },
    )
    assert.equal(requestUrl, 'https://remix.run/')
  })

  it('uses `X-Forwarded-Host` and `X-Forwarded-Proto` when proxies are trusted', async (t) => {
    let requestUrl = await captureRequestUrl(
      t,
      {
        headers: {
          Host: 'example.com',
          'X-Forwarded-Host': 'remix.run',
          'X-Forwarded-Proto': 'https',
        },
      },
      { trustProxy: true },
    )
    assert.equal(requestUrl, 'https://remix.run/')
  })

  it('uses the first `X-Forwarded-Host` and `X-Forwarded-Proto` values when proxies are trusted', async (t) => {
    let requestUrl = await captureRequestUrl(
      t,
      {
        headers: {
          Host: 'example.com',
          'X-Forwarded-Host': 'remix.run, example.com',
          'X-Forwarded-Proto': 'https, http',
        },
      },
      { trustProxy: true },
    )
    assert.equal(requestUrl, 'https://remix.run/')
  })

  it('uses the host option before trusted proxy host headers', async (t) => {
    let requestUrl = await captureRequestUrl(
      t,
      {
        headers: {
          Host: 'example.com',
          Forwarded: 'host=remix.run',
          'X-Forwarded-Host': 'remix.run',
        },
      },
      {
        host: 'app.example.com',
        trustProxy: true,
      },
    )
    assert.equal(requestUrl, 'http://app.example.com/')
  })

  it('ignores invalid forwarded protocol header values when proxies are trusted', async (t) => {
    let requestUrl = await captureRequestUrl(
      t,
      {
        headers: {
          Host: 'example.com',
          Forwarded: 'proto=javascript',
          'X-Forwarded-Proto': 'file',
        },
      },
      { trustProxy: true },
    )
    assert.equal(requestUrl, 'http://example.com/')
  })

  it('uses the `protocol` option before trusted proxy protocol headers', async (t) => {
    let requestUrl = await captureRequestUrl(
      t,
      {
        headers: {
          Host: 'example.com',
          Forwarded: 'proto=https',
        },
      },
      {
        protocol: 'http:',
        trustProxy: true,
      },
    )
    assert.equal(requestUrl, 'http://example.com/')
  })

  it('uses `X-Forwarded-For` for client address when proxies are trusted', async (t) => {
    let client = await captureClientAddress(
      t,
      {
        headers: {
          'X-Forwarded-For': '203.0.113.43, 10.0.0.1',
        },
        socket: {
          remoteAddress: '10.0.0.1',
          remoteFamily: 'IPv4',
          remotePort: 12345,
        },
      },
      { trustProxy: true },
    )

    assert.deepEqual(client, {
      address: '203.0.113.43',
      family: 'IPv4',
      port: 12345,
    })
  })

  it('uses the `Forwarded` for parameter for client address when proxies are trusted', async (t) => {
    let client = await captureClientAddress(
      t,
      {
        headers: {
          Forwarded: 'for="[2001:db8:cafe::17]:4711"',
          'X-Forwarded-For': '203.0.113.43',
        },
        socket: {
          remoteAddress: '10.0.0.1',
          remoteFamily: 'IPv4',
          remotePort: 12345,
        },
      },
      { trustProxy: true },
    )

    assert.deepEqual(client, {
      address: '2001:db8:cafe::17',
      family: 'IPv6',
      port: 4711,
    })
  })

  it('ignores proxy client address headers by default', async (t) => {
    let client = await captureClientAddress(t, {
      headers: {
        Forwarded: 'for=203.0.113.43',
        'X-Forwarded-For': '203.0.113.43',
      },
      socket: {
        remoteAddress: '10.0.0.1',
        remoteFamily: 'IPv4',
        remotePort: 12345,
      },
    })

    assert.deepEqual(client, {
      address: '10.0.0.1',
      family: 'IPv4',
      port: 12345,
    })
  })

  it('reads request method, headers, and body text', async (t) => {
    await new Promise<void>((resolve) => {
      let handler: FetchHandler = async (request) => {
        assert.ok(request instanceof Request)
        assert.equal(request.method, 'POST')
        assert.equal(request.headers.get('X-Test'), 'yes')
        assert.equal(request.bodyUsed, false)

        assert.equal(await request.text(), 'Hello, world!')
        assert.equal(request.bodyUsed, true)

        await assert.rejects(() => request.text(), {
          name: 'TypeError',
          message: 'Body is unusable: Body has already been read',
        })

        return new Response('ok')
      }

      let listener = createRequestListener(handler)
      assert.ok(listener)

      let req = createMockRequest({
        method: 'POST',
        headers: { 'X-Test': 'yes' },
        body: 'Hello, world!',
      })
      let res = createMockResponse({ req })

      let chunks: Uint8Array[] = []
      t.mock.method(res, 'write', (chunk: Uint8Array) => {
        chunks.push(chunk)
      })

      t.mock.method(res, 'end', (chunk?: Uint8Array) => {
        if (chunk != null) chunks.push(chunk)
        assert.equal(Buffer.concat(chunks).toString(), 'ok')
        resolve()
      })

      listener(req, res)
    })
  })

  it('sets multiple Set-Cookie headers', async (t) => {
    await new Promise<void>((resolve) => {
      let handler: FetchHandler = async () => {
        let headers = new Headers()
        headers.set('Content-Type', 'text/plain')
        headers.append('Set-Cookie', 'a=1')
        headers.append('Set-Cookie', 'b=2')
        return new Response('Hello, world!', { headers })
      }

      let listener = createRequestListener(handler)
      assert.ok(listener)

      let req = createMockRequest()
      req.httpVersionMajor = 1
      let res = createMockResponse({ req })

      let headers: Record<string, string | string[]>
      t.mock.method(
        res,
        'writeHead',
        (_status: number, _statusText: string, headersObj: Record<string, string | string[]>) => {
          headers = headersObj
        },
      )

      t.mock.method(res, 'end', () => {
        assert.deepEqual(headers, {
          'content-type': 'text/plain',
          'set-cookie': ['a=1', 'b=2'],
        })
        resolve()
      })

      listener(req, res)
    })
  })

  it('truncates the response body when the request method is HEAD', async (t) => {
    await new Promise<void>((resolve) => {
      let handler: FetchHandler = async () => new Response('Hello, world!')

      let listener = createRequestListener(handler)
      assert.ok(listener)

      let req = createMockRequest({ method: 'HEAD' })
      let res = createMockResponse({ req })

      let chunks: Uint8Array[] = []
      t.mock.method(res, 'write', (chunk: Uint8Array) => {
        chunks.push(chunk)
      })

      t.mock.method(res, 'end', () => {
        assert.equal(chunks.length, 0)
        resolve()
      })

      listener(req, res)
    })
  })

  it('handles backpressure when writing response chunks', async () => {
    await new Promise<void>((resolve) => {
      let handler: FetchHandler = async () => {
        let chunks = ['chunk1', 'chunk2', 'chunk3', 'chunk4', 'chunk5']
        let body = new ReadableStream({
          async start(controller) {
            for (let chunk of chunks) {
              controller.enqueue(new TextEncoder().encode(chunk))
            }
            controller.close()
          },
        })

        return new Response(body)
      }

      let listener = createRequestListener(handler)
      assert.ok(listener)

      let req = createMockRequest()

      let writtenChunks: Uint8Array[] = []
      let writeCallCount = 0
      let drainListenerCalled = false

      let writable = new stream.Writable()
      let res = Object.assign(writable, {
        req,
        writeHead() {},
        write(chunk: Uint8Array) {
          writtenChunks.push(chunk)
          writeCallCount++

          // Simulate backpressure on chunks 2 and 4
          if (writeCallCount === 2 || writeCallCount === 4) {
            setTimeout(() => {
              writable.emit('drain')
            }, 0)
            return false // Buffer is full
          }
          return true // Buffer has space
        },
        end() {
          assert.equal(writtenChunks.length, 5)
          assert.equal(writeCallCount, 5)

          assert.ok(drainListenerCalled, 'drain listener should have been registered')

          let receivedText = writtenChunks.map((chunk) => new TextDecoder().decode(chunk)).join('')
          assert.equal(receivedText, 'chunk1chunk2chunk3chunk4chunk5')

          resolve()
        },
        once(event: string, callback: () => void) {
          if (event === 'drain') {
            drainListenerCalled = true
          }
          stream.Writable.prototype.once.call(writable, event, callback)
        },
      }) as unknown as http.ServerResponse

      listener(req, res)
    })
  })

  it('writes the first response stream chunk before waiting for the second chunk', async () => {
    let encoder = new TextEncoder()
    let resolveSecondChunk!: () => void
    let secondChunkReady = new Promise<void>((resolve) => {
      resolveSecondChunk = resolve
    })

    let handler: FetchHandler = async () =>
      new Response(
        new ReadableStream({
          async start(controller) {
            controller.enqueue(encoder.encode('first'))
            await secondChunkReady
            controller.enqueue(encoder.encode('second'))
            controller.close()
          },
        }),
      )

    let listener = createRequestListener(handler)
    assert.ok(listener)

    let req = createMockRequest()
    let writtenChunks: Uint8Array[] = []
    let resolveFirstWrite!: () => void
    let firstWrite = new Promise<void>((resolve) => {
      resolveFirstWrite = resolve
    })
    let end = new Promise<void>((resolve) => {
      let res = Object.assign(new stream.Writable(), {
        req,
        writeHead() {},
        write(chunk: Uint8Array) {
          writtenChunks.push(chunk)
          if (writtenChunks.length === 1) resolveFirstWrite()
          return true
        },
        end() {
          resolve()
        },
      }) as unknown as http.ServerResponse

      listener(req, res)
    })

    await firstWrite
    assert.equal(Buffer.concat(writtenChunks).toString(), 'first')

    resolveSecondChunk()
    await end
    assert.equal(Buffer.concat(writtenChunks).toString(), 'firstsecond')
  })

  it('cancels a streaming response body when the response closes before it finishes', async () => {
    let requestAborted = false
    let resolveBodyCancelled!: () => void
    let bodyCancelled = new Promise<void>((resolve) => {
      resolveBodyCancelled = resolve
    })

    let handler: FetchHandler = async (request) => {
      request.signal.addEventListener('abort', () => {
        requestAborted = true
      })

      return new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('first'))
          },
          cancel() {
            resolveBodyCancelled()
          },
        }),
      )
    }

    let listener = createRequestListener(handler)
    assert.ok(listener)

    let req = createMockRequest()
    req.httpVersionMajor = 1

    let resolveFirstWrite!: () => void
    let firstWrite = new Promise<void>((resolve) => {
      resolveFirstWrite = resolve
    })

    let res = Object.assign(new stream.Writable(), {
      req,
      writeHead() {},
      write(chunk: Uint8Array) {
        assert.equal(new TextDecoder().decode(chunk), 'first')
        resolveFirstWrite()
        return true
      },
      end() {},
    }) as unknown as http.ServerResponse

    listener(req, res)
    await firstWrite

    res.emit('close')

    assert.equal(requestAborted, true)
    await waitFor(
      bodyCancelled,
      100,
      'Expected the streaming response body to be cancelled when the response closed',
    )
  })
})

describe('createRequest abort behavior', () => {
  it('aborts the request.signal when response closes before finishing', () => {
    let req = createMockRequest()
    let res = createMockResponse({ req })
    let request = createRequest(req, res)

    assert.equal(request.signal.aborted, false)
    res.emit('close')
    assert.equal(request.signal.aborted, true)
  })

  it('does not abort after finish even if close occurs later', () => {
    let req = createMockRequest()
    let res = createMockResponse({ req })
    let request = createRequest(req, res)

    res.emit('finish')
    res.emit('close')
    assert.equal(request.signal.aborted, false)
  })

  it('aborts the request.signal and rejects body reads when the request aborts before ending', async () => {
    let req = createPendingMockRequest()
    let res = createMockResponse({ req })
    let request = createRequest(req, res)
    let body = request.text()

    req.emit('data', Buffer.from('partial'))
    req.emit('aborted')

    await waitFor(
      assert.rejects(body, (error) => {
        assert.equal(error, request.signal.reason)
        assert.equal((error as DOMException).name, 'AbortError')
        return true
      }),
      100,
      'Expected the request body read to reject when the request aborted',
    )

    assert.equal(request.signal.aborted, true)
  })

  it('aborts the request.signal and rejects body reads when the request errors before ending', async () => {
    let req = createPendingMockRequest()
    let res = createMockResponse({ req })
    let request = createRequest(req, res)
    let bodyError = new Error('client upload failed')
    let body = request.text()

    req.emit('data', Buffer.from('partial'))
    req.emit('error', bodyError)

    await waitFor(
      assert.rejects(body, (error) => {
        assert.equal(error, bodyError)
        return true
      }),
      100,
      'Expected the request body read to reject when the request errored',
    )

    assert.equal(request.signal.aborted, true)
    assert.equal(request.signal.reason, bodyError)
  })

  it('aborts the request.signal and rejects body reads when the request closes before ending', async () => {
    let req = createPendingMockRequest()
    let res = createMockResponse({ req })
    let request = createRequest(req, res)
    let body = request.text()

    req.emit('data', Buffer.from('partial'))
    req.emit('close')

    await waitFor(
      assert.rejects(body, (error) => {
        assert.equal(error, request.signal.reason)
        assert.equal((error as DOMException).name, 'AbortError')
        return true
      }),
      100,
      'Expected the request body read to reject when the request closed',
    )

    assert.equal(request.signal.aborted, true)
  })

  it('ignores request errors after an abort has already rejected the body', async () => {
    let req = createPendingMockRequest()
    let res = createMockResponse({ req })
    let request = createRequest(req, res)
    let body = request.text()

    req.emit('aborted')
    req.emit('error', new Error('late socket error'))

    await assert.rejects(body, (error) => {
      assert.equal(error, request.signal.reason)
      assert.equal((error as DOMException).name, 'AbortError')
      return true
    })
  })

  it('aborts the request.signal and rejects body reads when the request already aborted', async () => {
    let req = createPendingMockRequest()
    let res = createMockResponse({ req })

    markMockRequestAborted(req)

    let request = createRequest(req, res)
    let body = request.text()

    await waitFor(
      assert.rejects(body, (error) => {
        assert.equal(error, request.signal.reason)
        assert.equal((error as DOMException).name, 'AbortError')
        return true
      }),
      100,
      'Expected the request body read to reject when the request had already aborted',
    )

    assert.equal(request.signal.aborted, true)
    assert.doesNotThrow(() => req.emit('error', new Error('late socket error')))
  })
})

async function assertLazyRequestBodyReadRejects(
  t: TestContext,
  readBody: (request: Request) => Promise<unknown>,
  failRequest: (req: http.IncomingMessage) => void,
  assertError: (error: unknown, signalReason: unknown) => void,
): Promise<void> {
  let bodyReadRejected = false
  let bodyError: unknown
  let signalReason: unknown
  let resolveHandlerFinished!: () => void
  let handlerFinished = new Promise<void>((resolve) => {
    resolveHandlerFinished = resolve
  })
  let handler: FetchHandler = async (request) => {
    try {
      await readBody(request)
      return new Response('ok')
    } catch (error) {
      bodyReadRejected = true
      bodyError = error
      signalReason = request.signal.reason
      throw error
    } finally {
      assert.equal(request.signal.aborted, true)
      resolveHandlerFinished()
    }
  }
  let errorHandler = t.mock.fn()

  let listener = createRequestListener(handler, { onError: errorHandler })
  assert.ok(listener)

  let req = createPendingMockRequest()
  let res = createMockResponse({ req })
  let writeHead = t.mock.method(res, 'writeHead')
  let write = t.mock.method(res, 'write')
  let end = t.mock.method(res, 'end')

  listener(req, res)
  req.emit('data', Buffer.from('partial'))
  failRequest(req)

  await waitFor(
    handlerFinished,
    100,
    'Expected the lazy request body read to settle when the request failed',
  )
  await new Promise((resolve) => setTimeout(resolve, 0))

  assert.equal(bodyReadRejected, true)
  assertError(bodyError, signalReason)
  assert.equal(errorHandler.mock.calls.length, 0)
  assert.equal(writeHead.mock.calls.length, 0)
  assert.equal(write.mock.calls.length, 0)
  assert.equal(end.mock.calls.length, 0)
}

async function captureRequestUrl(
  t: TestContext,
  requestInit: Parameters<typeof createMockRequest>[0],
  options?: Parameters<typeof createRequestListener>[1],
): Promise<string | undefined> {
  let requestUrl: string | undefined

  await new Promise<void>((resolve) => {
    let handler: FetchHandler = async (request) => {
      requestUrl = request.url
      return new Response('Hello, world!')
    }

    let listener = createRequestListener(handler, options)
    assert.ok(listener)

    let req = createMockRequest(requestInit)
    let res = createMockResponse({ req })
    t.mock.method(res, 'end', () => resolve())

    listener(req, res)
  })

  return requestUrl
}

async function captureClientAddress(
  t: TestContext,
  requestInit: Parameters<typeof createMockRequest>[0],
  options?: Parameters<typeof createRequestListener>[1],
): Promise<ClientAddress | undefined> {
  let clientAddress: ClientAddress | undefined

  await new Promise<void>((resolve) => {
    let handler: FetchHandler = async (_request, client) => {
      clientAddress = client
      return new Response('Hello, world!')
    }

    let listener = createRequestListener(handler, options)
    assert.ok(listener)

    let req = createMockRequest(requestInit)
    let res = createMockResponse({ req })
    t.mock.method(res, 'end', () => resolve())

    listener(req, res)
  })

  return clientAddress
}

function markMockRequestAborted(req: http.IncomingMessage): void {
  Object.defineProperties(req, {
    aborted: {
      value: true,
      configurable: true,
    },
    readableAborted: {
      value: true,
      configurable: true,
    },
  })
}

function createPendingMockRequest(): http.IncomingMessage {
  return Object.assign(
    new stream.Readable({
      read() {
        // Keep the request open until the test emits data/end/error events.
      },
    }),
    {
      url: '/',
      method: 'POST',
      rawHeaders: [] as string[],
      socket: {},
      headers: {},
    },
  ) as http.IncomingMessage
}

function createMockRequest({
  url = '/',
  method = 'GET',
  headers = {},
  socket = {},
  body,
}: {
  method?: string
  url?: string
  headers?: Record<string, string>
  socket?: {
    encrypted?: boolean
    remoteAddress?: string
    remoteFamily?: string
    remotePort?: number
  }
  body?: string | Buffer
} = {}): http.IncomingMessage {
  let rawHeaders = Object.entries(headers).flatMap(([key, value]) => [key, value])

  return Object.assign(
    new stream.Readable({
      read() {
        if (body != null) this.push(Buffer.from(body))
        this.push(null)
      },
    }),
    {
      url,
      method,
      rawHeaders,
      socket,
      headers,
    },
  ) as http.IncomingMessage
}

function createMockResponse({
  req = createMockRequest(),
}: {
  req: http.IncomingMessage
}): http.ServerResponse {
  return Object.assign(new stream.Writable(), {
    req,
    writeHead() {},
    write() {},
    end() {},
  }) as unknown as http.ServerResponse
}

async function waitFor(promise: Promise<void>, ms: number, message: string): Promise<void> {
  let timeout: ReturnType<typeof setTimeout> | undefined

  try {
    await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(message)), ms)
      }),
    ])
  } finally {
    if (timeout != null) clearTimeout(timeout)
  }
}
