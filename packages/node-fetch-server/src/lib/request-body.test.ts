import * as assert from 'node:assert/strict'
import * as http from 'node:http'
import * as http2 from 'node:http2'
import * as net from 'node:net'
import type { TestContext } from 'node:test'
import { describe, it } from 'node:test'

import { createRequestListener } from './request-listener.ts'

const largeBodySize = 32 * 1024 * 1024
const smallBodySize = 300 * 1024

describe('abandoned request bodies over HTTP/1.1', () => {
  it('stops reading a large body the handler cancels and still sends the response', async (t) => {
    let server = await startHttp1Server(t, async (request) => {
      await readOneChunkAndCancel(request)
      // Give a request that is still being read time to keep reading
      await sleep(100)
      return new Response('Payload Too Large', { status: 413 })
    })

    let response = await upload(server.port, new http.Agent(), largeBodySize)

    assert.equal(response.status, 413)
    assert.equal(response.body, 'Payload Too Large')
    assert.equal(response.connection, 'close')
    assert.ok(
      server.bytesRead() < largeBodySize / 4,
      `Expected the server to stop reading the body, but it read ${server.bytesRead()} bytes`,
    )
  })

  it('reuses the connection after the handler cancels a body with a small rest', async (t) => {
    let server = await startHttp1Server(t, async (request) => {
      if (request.method === 'GET') return new Response('ok')
      await readOneChunkAndCancel(request)
      return new Response('Payload Too Large', { status: 413 })
    })
    let agent = new http.Agent({ keepAlive: true, maxSockets: 1 })
    t.after(() => agent.destroy())

    let first = await upload(server.port, agent, smallBodySize)
    let second = await get(server.port, agent)

    assert.equal(first.status, 413)
    assert.equal(first.connection, 'keep-alive')
    assert.equal(second.status, 200)
    assert.equal(second.reusedSocket, true)
  })

  it('reuses the connection after responding without reading a small body', async (t) => {
    let server = await startHttp1Server(t, async (request) => {
      if (request.method === 'GET') return new Response('ok')
      return new Response('Payload Too Large', { status: 413 })
    })
    let agent = new http.Agent({ keepAlive: true, maxSockets: 1 })
    t.after(() => agent.destroy())

    let first = await upload(server.port, agent, smallBodySize)
    let second = await get(server.port, agent)

    assert.equal(first.status, 413)
    assert.equal(second.status, 200)
    assert.equal(second.reusedSocket, true)
  })

  it('closes the connection after responding without reading a large body', async (t) => {
    let server = await startHttp1Server(t, async (request) => {
      if (request.method === 'GET') return new Response('ok')
      return new Response('Payload Too Large', { status: 413 })
    })
    let agent = new http.Agent({ keepAlive: true })
    t.after(() => agent.destroy())

    let first = await upload(server.port, agent, largeBodySize)
    let second = await get(server.port, agent)

    assert.equal(first.status, 413)
    // Without this, the connection stays open until the keep-alive timeout
    await withTimeout(first.ended, 1000, 'Expected the server to end the connection')
    assert.equal(second.status, 200)
    assert.equal(second.reusedSocket, false)
    assert.ok(
      server.bytesRead() < largeBodySize / 4,
      `Expected the server to stop reading the body, but it read ${server.bytesRead()} bytes`,
    )
  })

  it('aborts request.signal when the client disconnects after the body is cancelled', async (t) => {
    let aborted = Promise.withResolvers<void>()
    let server = await startHttp1Server(t, async (request) => {
      request.signal.addEventListener('abort', () => aborted.resolve())
      await readOneChunkAndCancel(request)
      await aborted.promise
      return new Response('Too late')
    })

    let request = http.request({
      host: '127.0.0.1',
      port: server.port,
      method: 'POST',
      headers: { 'Content-Length': String(largeBodySize) },
    })
    request.on('error', () => {})
    // More than the socket buffers hold, so the disconnect is only seen by reading past it
    request.write(Buffer.alloc(512 * 1024))
    await sleep(100)
    request.destroy()

    await withTimeout(aborted.promise, 1000, 'Expected request.signal to abort')
  })
})

describe('abandoned request bodies over HTTP/2', () => {
  it('resets an unfinished upload with NO_ERROR after the handler cancels the body', async (t) => {
    let server = await startHttp2Server(t, async (request) => {
      await readOneChunkAndCancel(request)
      return new Response('Payload Too Large', { status: 413 })
    })

    let result = await upload2(server.client, largeBodySize)

    assert.equal(result.status, 413)
    assert.equal(result.body, 'Payload Too Large')
    assert.equal(result.rstCode, http2.constants.NGHTTP2_NO_ERROR)
    assert.ok(
      result.written < largeBodySize / 4,
      `Expected the upload to stop early, but it sent ${result.written} bytes`,
    )
    await server.close()
  })

  it('resets an unfinished upload with NO_ERROR after responding without reading it', async (t) => {
    // Taking the request matters: handlers without parameters never get a request body
    let server = await startHttp2Server(
      t,
      async (_request) => new Response('Payload Too Large', { status: 413 }),
    )

    let result = await upload2(server.client, largeBodySize)

    assert.equal(result.status, 413)
    assert.equal(result.rstCode, http2.constants.NGHTTP2_NO_ERROR)
    await server.close()
  })

  it('sends the end of the response before resetting an unfinished upload', async (t) => {
    let server = await startHttp2Server(t, async (request) => {
      await readOneChunkAndCancel(request)
      return new Response('Payload Too Large', { status: 413 })
    })
    let frames = await recordServerFrames(t, server.port)

    let result = await upload2(frames.client, largeBodySize)
    let streamFrames = frames.forStream(result.id)
    frames.close()

    assert.equal(result.status, 413)
    // RFC 9113, section 8.1: a server can reset with NO_ERROR only after a complete response
    let endOfResponse = streamFrames.findIndex((frame) => frame.endStream)
    let reset = streamFrames.findIndex((frame) => frame.type === 'RST_STREAM')
    assert.notEqual(endOfResponse, -1, 'Expected the response to end')
    assert.notEqual(reset, -1, 'Expected the upload to be reset')
    assert.ok(
      endOfResponse < reset,
      `Expected END_STREAM before RST_STREAM, got ${JSON.stringify(streamFrames)}`,
    )
  })

  it('aborts request.signal when the client disconnects', async (t) => {
    let aborted = Promise.withResolvers<void>()
    let handled = Promise.withResolvers<void>()
    let server = await startHttp2Server(t, async (request) => {
      request.signal.addEventListener('abort', () => aborted.resolve())
      handled.resolve()
      await aborted.promise
      return new Response('Too late')
    })

    let stream = server.client.request({ ':method': 'GET', ':path': '/' })
    stream.on('error', () => {})
    stream.end()
    await handled.promise
    server.client.destroy()

    await withTimeout(aborted.promise, 1000, 'Expected request.signal to abort')
  })
})

async function readOneChunkAndCancel(request: Request): Promise<void> {
  let reader = request.body!.getReader()
  await reader.read()
  await reader.cancel()
}

async function startHttp1Server(t: TestContext, handler: (request: Request) => Promise<Response>) {
  let server = http.createServer(createRequestListener(handler))
  let sockets: net.Socket[] = []
  server.on('connection', (socket) => sockets.push(socket))
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  t.after(() => {
    server.closeAllConnections()
    server.close()
  })

  return {
    port: (server.address() as net.AddressInfo).port,
    bytesRead: () => sockets.reduce((total, socket) => total + socket.bytesRead, 0),
  }
}

// Sends a body of `size` bytes with backpressure and resolves with the response
function upload(port: number, agent: http.Agent, size: number) {
  type Result = { status?: number; body: string; connection?: string; ended: Promise<void> }
  return new Promise<Result>((resolve, reject) => {
    let ended = Promise.withResolvers<void>()
    let request = http.request({
      host: '127.0.0.1',
      port,
      method: 'POST',
      agent,
      headers: { 'Content-Length': String(size) },
    })
    request.on('socket', (socket) => socket.once('end', () => ended.resolve()))
    request.on('response', (response) => {
      let body = ''
      response.setEncoding('utf8')
      response.on('data', (chunk) => (body += chunk))
      response.on('end', () => {
        let connection = response.headers.connection
        resolve({ status: response.statusCode, body, connection, ended: ended.promise })
      })
    })
    // Writing fails once the server closes the connection after the response
    request.on('error', reject)

    let chunk = Buffer.alloc(64 * 1024)
    let written = 0
    function write() {
      while (written < size) {
        let length = Math.min(chunk.length, size - written)
        written += length
        if (!request.write(chunk.subarray(0, length))) {
          request.once('drain', write)
          return
        }
      }
      request.end()
    }
    write()
  })
}

function get(port: number, agent: http.Agent) {
  return new Promise<{ status?: number; reusedSocket: boolean }>((resolve, reject) => {
    let request = http.request({ host: '127.0.0.1', port, agent }, (response) => {
      response.resume()
      response.on('end', () => {
        resolve({ status: response.statusCode, reusedSocket: request.reusedSocket })
      })
    })
    request.on('error', reject)
    request.end()
  })
}

async function startHttp2Server(t: TestContext, handler: (request: Request) => Promise<Response>) {
  let server = http2.createServer()
  server.on('request', createRequestListener(handler))
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  let port = (server.address() as net.AddressInfo).port
  let client = http2.connect(`http://127.0.0.1:${port}`)
  client.on('error', () => {})
  let closed: Promise<void> | undefined
  function close() {
    client.destroy()
    closed ??= new Promise<void>((resolve) => server.close(() => resolve()))
    return withTimeout(closed, 1000, 'Expected the server to close once the client disconnected')
  }
  t.after(close)

  return { port, client, close }
}

// Connects an HTTP/2 client through a TCP proxy that records the frames the server sends
async function recordServerFrames(t: TestContext, port: number) {
  let frameTypes: Record<number, string> = { 0: 'DATA', 1: 'HEADERS', 3: 'RST_STREAM' }
  let frames: { stream: number; type: string; endStream: boolean }[] = []
  let sockets: net.Socket[] = []
  let proxy = net.createServer((socket) => {
    let upstream = net.connect(port, '127.0.0.1')
    sockets.push(socket, upstream)
    socket.pipe(upstream)
    let pending = Buffer.alloc(0)
    upstream.on('data', (chunk: Buffer) => {
      socket.write(chunk)
      pending = Buffer.concat([pending, chunk])
      while (pending.length >= 9 && pending.length >= 9 + pending.readUIntBE(0, 3)) {
        let type = frameTypes[pending[3]]
        // END_STREAM is flag 0x1 on DATA and HEADERS frames
        if (type)
          frames.push({
            stream: pending.readUInt32BE(5) & 0x7fffffff,
            type,
            endStream: type !== 'RST_STREAM' && (pending[4] & 1) === 1,
          })
        pending = pending.subarray(9 + pending.readUIntBE(0, 3))
      }
    })
    socket.on('error', () => {})
    upstream.on('error', () => {})
  })
  await new Promise<void>((resolve) => proxy.listen(0, '127.0.0.1', resolve))
  let client = http2.connect(`http://127.0.0.1:${(proxy.address() as net.AddressInfo).port}`)
  client.on('error', () => {})
  function close() {
    client.destroy()
    for (let socket of sockets) socket.destroy()
    proxy.close()
  }
  t.after(close)

  return {
    client,
    close,
    forStream: (stream: number) =>
      frames
        .filter((frame) => frame.stream === stream)
        .map(({ type, endStream }) => ({ type, endStream })),
  }
}

// Sends a body of `size` bytes with backpressure and resolves once the stream closes
function upload2(client: http2.ClientHttp2Session, size: number) {
  return withTimeout(
    new Promise<{ id: number; status?: number; body: string; rstCode?: number; written: number }>(
      (resolve) => {
        let stream = client.request({ ':method': 'POST', ':path': '/' })
        let status: number | undefined
        let body = ''
        stream.on('response', (headers) => (status = headers[':status']))
        stream.setEncoding('utf8')
        stream.on('data', (chunk) => (body += chunk))
        stream.on('error', () => {})
        let written = 0
        stream.on('close', () => {
          resolve({ id: stream.id!, status, body, rstCode: stream.rstCode, written })
        })

        let chunk = Buffer.alloc(64 * 1024)
        function write() {
          while (written < size && !stream.destroyed) {
            written += chunk.length
            if (!stream.write(chunk)) {
              stream.once('drain', write)
              return
            }
          }
          if (!stream.destroyed) stream.end()
        }
        write()
      },
    ),
    2000,
    'Expected the upload stream to close',
  )
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function withTimeout<value>(promise: Promise<value>, ms: number, message: string) {
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(message)), ms)
      }),
    ])
  } finally {
    clearTimeout(timeout)
  }
}
