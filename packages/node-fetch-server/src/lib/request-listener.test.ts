import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type * as http from 'node:http'
import * as net from 'node:net'
import * as stream from 'node:stream'

import { type FetchHandler } from './fetch-handler.ts'
import { createRequest, createRequestListener } from './request-listener.ts'
import { createTestServer } from './test-server.ts'

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
})

describe('createRequest body abort behavior', () => {
  it('rejects body reads and aborts the signal when the request errors mid-body', async () => {
    let req = createStreamingMockRequest()
    let res = createMockResponse({ req })
    let request = createRequest(req, res)

    let textPromise = request.text()
    req.push(Buffer.from('partial'))
    let error = new Error('socket hang up')
    req.destroy(error)

    await assert.rejects(textPromise)
    assert.equal(request.signal.aborted, true)
    assert.equal(request.signal.reason, error)
  })

  it('rejects body reads and aborts the signal when the request closes before the body ends', async () => {
    let req = createStreamingMockRequest()
    let res = createMockResponse({ req })
    let request = createRequest(req, res)

    let textPromise = request.text()
    req.push(Buffer.from('partial'))
    req.destroy()

    await assert.rejects(textPromise, /disconnected before the request body/)
    assert.equal(request.signal.aborted, true)
  })

  it('rejects body reads when the legacy aborted event fires', async () => {
    let req = createStreamingMockRequest()
    let res = createMockResponse({ req })
    let request = createRequest(req, res)

    let textPromise = request.text()
    req.emit('aborted')

    await assert.rejects(textPromise, /disconnected before the request body/)
    assert.equal(request.signal.aborted, true)
  })

  it('does not abort the signal when the body ends normally and the request closes afterwards', async () => {
    let req = createMockRequest({ method: 'POST', body: 'Hello, world!' })
    let res = createMockResponse({ req })
    let request = createRequest(req, res)

    assert.equal(await request.text(), 'Hello, world!')

    // Let the mock request emit its trailing 'close' after 'end'
    await new Promise((resolve) => setTimeout(resolve, 0))
    assert.equal(request.signal.aborted, false)
  })

  it('rejects a pending lazy text() read when the client disconnects mid-body', async () => {
    let reportResult!: (value: unknown) => void
    let handlerResult = new Promise<unknown>((resolve) => {
      reportResult = resolve
    })

    let handler: FetchHandler = async (request: Request) => {
      try {
        await request.text()
        reportResult(null)
      } catch (error) {
        reportResult(error)
      }
      return new Response('ok')
    }

    let listener = createRequestListener(handler)
    let req = createStreamingMockRequest()
    let res = createMockResponse({ req })

    listener(req, res)
    req.push(Buffer.from('partial'))
    req.destroy()

    let error = await handlerResult
    assert.ok(error instanceof Error)
    assert.match(error.message, /disconnected before the request body/)
  })

  it('rejects a pending body read when a real client socket is destroyed mid-upload', async () => {
    let reportResult!: (value: unknown) => void
    let handlerResult = new Promise<unknown>((resolve) => {
      reportResult = resolve
    })

    let server = await createTestServer(async (request) => {
      try {
        await request.text()
        reportResult(null)
      } catch (error) {
        reportResult(error)
      }
      return new Response('ok')
    })

    try {
      let port = Number(new URL(server.baseUrl).port)
      let socket = net.connect(port, '127.0.0.1')
      await new Promise<void>((resolve) => socket.once('connect', resolve))

      socket.write(
        'POST / HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Type: text/plain\r\nContent-Length: 1000\r\n\r\npartial body',
      )

      // Give the server a beat to start reading the body, then drop the client
      await new Promise((resolve) => setTimeout(resolve, 50))
      socket.destroy()

      let error = await handlerResult
      assert.ok(error instanceof Error)
    } finally {
      await server.close()
    }
  })
})

function createStreamingMockRequest({
  url = '/',
  method = 'POST',
  headers = {},
}: {
  url?: string
  method?: string
  headers?: Record<string, string>
} = {}): http.IncomingMessage {
  let rawHeaders = Object.entries(headers).flatMap(([key, value]) => [key, value])

  return Object.assign(
    new stream.Readable({
      read() {},
    }),
    {
      url,
      method,
      rawHeaders,
      socket: {},
      headers,
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
