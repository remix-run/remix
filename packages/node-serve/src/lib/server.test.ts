import * as https from 'node:https'
import * as net from 'node:net'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { serve } from '../index.ts'

const describeUws = process.platform === 'win32' ? describe.skip : describe
const fixturesDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../node-fetch-server/demos/http2',
)

describeUws('serve', () => {
  it('runs setup before listening and exposes the configured app', async () => {
    let events: string[] = []
    let setupApp: unknown

    let server = serve(
      () => {
        events.push('handler')
        return new Response('ok')
      },
      {
        port: 0,
        setup(app) {
          events.push('setup')
          setupApp = app
          assert.deepEqual(events, ['setup'])
        },
      },
    )

    events.push('returned')
    assert.equal(setupApp, server.app)
    assert.deepEqual(events, ['setup', 'returned'])

    await server.ready

    try {
      let response = await fetch(`http://127.0.0.1:${server.port}/test`)

      assert.equal(response.status, 200)
      assert.equal(await response.text(), 'ok')
      assert.deepEqual(events, ['setup', 'returned', 'handler'])
    } finally {
      server.close()
    }
  })

  it('handles fetch requests with the uWebSockets.js transport', async () => {
    let server = serve(
      async (request) => {
        assert.equal(request.method, 'POST')
        assert.equal(request.headers.get('Content-Type'), 'text/plain')
        assert.equal(await request.text(), 'hello')

        return new Response('ok', {
          status: 201,
          headers: {
            'Content-Type': 'text/plain',
            'X-Test': 'yes',
          },
        })
      },
      { port: 0 },
    )

    await server.ready

    try {
      let response = await fetch(`http://127.0.0.1:${server.port}/test?value=1`, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
        },
        body: 'hello',
      })

      assert.equal(response.status, 201)
      assert.equal(response.headers.get('X-Test'), 'yes')
      assert.equal(await response.text(), 'ok')
    } finally {
      server.close()
    }
  })

  it('uses the host option to override the incoming Host header', async () => {
    let server = serve(
      async (request) => {
        assert.equal(request.url, 'http://remix.run/test?value=1')
        return new Response('ok')
      },
      { host: 'remix.run', port: 0 },
    )

    await server.ready

    try {
      let response = await fetch(`http://127.0.0.1:${server.port}/test?value=1`)

      assert.equal(response.status, 200)
      assert.equal(await response.text(), 'ok')
    } finally {
      server.close()
    }
  })

  it('lets setup register a WebSocket route before the Fetch fallback', async () => {
    let server = serve(
      (request) => {
        assert.equal(new URL(request.url).pathname, '/fetch')
        return new Response('fetch ok')
      },
      {
        port: 0,
        setup(app) {
          app.ws('/ws/echo', {
            message(ws, message, isBinary) {
              ws.send(message, isBinary)
            },
          })
        },
      },
    )

    await server.ready

    let socket = await connectWebSocket(`ws://127.0.0.1:${server.port}/ws/echo`)

    try {
      let message = receiveWebSocketMessage(socket)
      socket.send('hello')

      assert.equal(await message, 'hello')

      let response = await fetch(`http://127.0.0.1:${server.port}/fetch`)

      assert.equal(response.status, 200)
      assert.equal(await response.text(), 'fetch ok')
    } finally {
      socket.close()
      server.close()
    }
  })

  it('lets setup register a connection filter', async () => {
    let connectionCounts: number[] = []
    let server = serve(() => new Response('ok'), {
      port: 0,
      setup(app) {
        app.filter((_res, count) => {
          connectionCounts.push(Number(count))
        })
      },
    })

    await server.ready

    try {
      let response = await fetch(`http://127.0.0.1:${server.port}/test`)

      assert.equal(response.status, 200)
      assert.equal(await response.text(), 'ok')

      await waitFor(
        () => connectionCounts.some((count) => count > 0),
        'Timed out waiting for a connection filter callback',
      )
    } finally {
      server.close()
    }
  })

  it('throws synchronously and does not listen when setup throws', async () => {
    let port = await getAvailablePort()

    assert.throws(() => {
      serve(() => new Response('ok'), {
        port,
        setup() {
          throw new Error('setup failed')
        },
      })
    }, /setup failed/)

    let server = serve(() => new Response('ok'), { port })

    await server.ready

    try {
      let response = await fetch(`http://127.0.0.1:${server.port}/test`)

      assert.equal(response.status, 200)
      assert.equal(await response.text(), 'ok')
    } finally {
      server.close()
    }
  })

  it('serves HTTPS requests when TLS options are provided', async () => {
    let server = serve(
      (request) => {
        assert.equal(request.url, 'https://remix.run/secure?value=1')
        return new Response('secure')
      },
      {
        host: 'remix.run',
        port: 0,
        tls: {
          keyFile: path.join(fixturesDir, 'server.key'),
          certFile: path.join(fixturesDir, 'server.crt'),
        },
      },
    )

    await server.ready

    try {
      let response = await requestHttps(server.port, '/secure?value=1')

      assert.equal(response.statusCode, 200)
      assert.equal(response.body, 'secure')
    } finally {
      server.close()
    }
  })
})

function getAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    let server = net.createServer()

    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      let address = server.address()

      if (address == null || typeof address === 'string') {
        server.close()
        reject(new Error('Unable to determine the test server port'))
        return
      }

      server.close((error) => {
        if (error != null) {
          reject(error)
        } else {
          resolve(address.port)
        }
      })
    })
  })
}

async function connectWebSocket(url: string): Promise<WebSocket> {
  let socket = new WebSocket(url)

  try {
    await withTimeout(
      new Promise<void>((resolve, reject) => {
        socket.addEventListener('open', () => resolve(), { once: true })
        socket.addEventListener('error', () => reject(new Error('Unable to open WebSocket')), {
          once: true,
        })
      }),
      'Timed out opening WebSocket',
    )
  } catch (error: unknown) {
    socket.close()
    throw error
  }

  return socket
}

function receiveWebSocketMessage(socket: WebSocket): Promise<string> {
  return withTimeout(
    new Promise((resolve, reject) => {
      socket.addEventListener(
        'message',
        (event) => {
          let data: unknown = event.data

          if (typeof data === 'string') {
            resolve(data)
            return
          }

          if (data instanceof ArrayBuffer) {
            resolve(Buffer.from(data).toString())
            return
          }

          if (data instanceof Blob) {
            void data.text().then(resolve, reject)
            return
          }

          reject(new Error('Received an unsupported WebSocket message type'))
        },
        { once: true },
      )
      socket.addEventListener('error', () => reject(new Error('WebSocket error')), { once: true })
    }),
    'Timed out receiving WebSocket message',
  )
}

async function waitFor(predicate: () => boolean, message: string): Promise<void> {
  let deadline = Date.now() + 5_000

  while (Date.now() < deadline) {
    if (predicate()) return
    await new Promise((resolve) => setTimeout(resolve, 10))
  }

  throw new Error(message)
}

async function withTimeout<value>(promise: Promise<value>, message: string): Promise<value> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined

  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(message)), 5_000)
      }),
    ])
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId)
  }
}

function requestHttps(
  port: number,
  requestPath: string,
): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    let request = https.request(
      {
        hostname: '127.0.0.1',
        port,
        path: requestPath,
        rejectUnauthorized: false,
      },
      (response) => {
        let chunks: Buffer[] = []

        response.on('data', (chunk: Buffer | string) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
        })

        response.on('end', () => {
          resolve({
            statusCode: response.statusCode ?? 0,
            body: Buffer.concat(chunks).toString(),
          })
        })
      },
    )

    request.on('error', reject)
    request.end()
  })
}
