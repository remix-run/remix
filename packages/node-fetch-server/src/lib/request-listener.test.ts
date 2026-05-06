import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type * as http from 'node:http'
import * as stream from 'node:stream'

import { type FetchHandler } from './fetch-handler.ts'
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
})

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
