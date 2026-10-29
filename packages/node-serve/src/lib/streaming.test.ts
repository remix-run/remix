import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import type { HttpRequest, HttpResponse, RecognizedString } from '@remix-run/uwebsockets-js'
import { setTimeout } from 'node:timers/promises'

import { createUwsRequestHandler } from './server.ts'

describe('createUwsRequestHandler streams', () => {
  it('writes the first response chunk without waiting for another chunk', async () => {
    let fixture = createTransport()
    let controller: ReadableStreamDefaultController<Uint8Array> | undefined
    let body = new ReadableStream<Uint8Array>({
      start(value) {
        controller = value
        value.enqueue(new TextEncoder().encode('first'))
      },
    })

    try {
      createUwsRequestHandler(() => new Response(body))(fixture.response, fixture.request)
      await setTimeout(0)
      assert.deepEqual(fixture.chunks, ['first'])
    } finally {
      controller?.close()
      await fixture.ended
    }
  })

  it('routes request construction failures through onError for request-only handlers', async () => {
    let fixture = createTransport('TRACE')
    let called = false
    let error: unknown
    createUwsRequestHandler(
      (_request) => {
        called = true
        return new Response('unexpected')
      },
      {
        onError(value) {
          error = value
          return new Response('invalid request', { status: 400 })
        },
      },
    )(fixture.response, fixture.request)

    await fixture.ended
    assert.equal(called, false)
    assert.ok(error instanceof TypeError)
    assert.equal(fixture.status, '400 Bad Request')
    assert.equal(fixture.chunks.join(''), 'invalid request')
  })

  it('routes request construction failures through onError for client-aware handlers', async () => {
    let fixture = createTransport('TRACE')
    let called = false
    createUwsRequestHandler(
      (_request, _client) => {
        called = true
        return new Response('unexpected')
      },
      { onError: () => new Response('invalid request', { status: 400 }) },
    )(fixture.response, fixture.request)

    await fixture.ended
    assert.equal(called, false)
    assert.equal(fixture.status, '400 Bad Request')
  })

  it('recovers response stream failures before headers through onError', async () => {
    let fixture = createTransport()
    let failure = new Error('stream failed')
    let caught: unknown
    let body = new ReadableStream({
      start(controller) {
        controller.error(failure)
      },
    })
    createUwsRequestHandler(() => new Response(body), {
      onError(error) {
        caught = error
        return new Response('recovered', { status: 502 })
      },
    })(fixture.response, fixture.request)

    await fixture.ended
    assert.equal(caught, failure)
    assert.equal(fixture.status, '502 Bad Gateway')
    assert.equal(fixture.chunks.join(''), 'recovered')
  })

  it('closes committed responses without waiting for an error handler', async () => {
    let fixture = createTransport()
    let controller: ReadableStreamDefaultController<Uint8Array> | undefined
    let errorHandlerCalled = false
    let body = new ReadableStream<Uint8Array>({
      start(value) {
        controller = value
        value.enqueue(new TextEncoder().encode('first'))
      },
    })
    createUwsRequestHandler(() => new Response(body), {
      onError() {
        errorHandlerCalled = true
        return new Promise<Response>(() => {})
      },
    })(fixture.response, fixture.request)

    await fixture.written
    controller?.error(new Error('stream failed after headers'))
    await fixture.closed
    assert.equal(errorHandlerCalled, false)
    assert.deepEqual(fixture.chunks, ['first'])
  })

  it('cancels a pending response read when the client disconnects', async () => {
    let fixture = createTransport()
    let cancelled = Promise.withResolvers<void>()
    let body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('first'))
      },
      cancel() {
        cancelled.resolve()
      },
    })
    createUwsRequestHandler(() => new Response(body))(fixture.response, fixture.request)

    await fixture.written
    fixture.abort()
    await cancelled.promise
    await setTimeout(0)
    assert.equal(body.locked, false)
  })

  it('cancels the response and releases a writable wait when the client disconnects', async () => {
    let fixture = createTransport()
    fixture.writable = false
    let cancelled = Promise.withResolvers<void>()
    let body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('first'))
      },
      cancel() {
        cancelled.resolve()
      },
    })
    createUwsRequestHandler(() => new Response(body))(fixture.response, fixture.request)

    await fixture.written
    await setTimeout(0)
    fixture.abort()
    await cancelled.promise
    await setTimeout(0)
    assert.equal(body.locked, false)
  })

  it('streams request chunks before the upload finishes and copies native buffers', async () => {
    let fixture = createTransport('POST')
    let captured = Promise.withResolvers<Request>()
    let finished = Promise.withResolvers<Response>()
    createUwsRequestHandler((request) => {
      captured.resolve(request)
      return finished.promise
    })(fixture.response, fixture.request)

    let request = await captured.promise
    assert.ok(request.body)
    let reader = request.body.getReader()
    let chunk = new TextEncoder().encode('first')
    fixture.data(chunk.buffer, false)
    chunk.fill(0)
    let received: ReadableStreamReadResult<Uint8Array> | undefined
    let read = reader.read().then((value) => {
      received = value
    })
    try {
      await setTimeout(0)
      assert.ok(received)
      assert.equal(received.done, false)
      assert.equal(new TextDecoder().decode(received.value), 'first')
    } finally {
      fixture.data(new ArrayBuffer(0), true)
      await read
      reader.releaseLock()
      finished.resolve(new Response('ok'))
      await fixture.ended
    }
  })

  it('pauses unread uploads and resumes when the application reads', async () => {
    let fixture = createTransport('POST')
    let captured = Promise.withResolvers<Request>()
    let finished = Promise.withResolvers<Response>()
    createUwsRequestHandler((request) => {
      captured.resolve(request)
      return finished.promise
    })(fixture.response, fixture.request)
    let request = await captured.promise
    assert.ok(request.body)
    assert.equal(fixture.resumes, 0)

    fixture.data(new ArrayBuffer(64 * 1024), false)
    await setTimeout(0)
    let resumes = fixture.resumes
    let reader = request.body.getReader()
    try {
      assert.ok(fixture.pauses > 0)
      let chunk = await reader.read()
      assert.equal(chunk.value?.byteLength, 64 * 1024)
      await setTimeout(0)
      assert.ok(fixture.resumes > resumes)
    } finally {
      fixture.data(new ArrayBuffer(0), true)
      reader.releaseLock()
      finished.resolve(new Response('ok'))
      await fixture.ended
    }
  })

  it('drains an unused paused upload before sending a response', async () => {
    let fixture = createTransport('POST')
    let captured = Promise.withResolvers<Request>()
    let finished = Promise.withResolvers<Response>()
    createUwsRequestHandler((request) => {
      captured.resolve(request)
      return finished.promise
    })(fixture.response, fixture.request)
    let request = await captured.promise
    fixture.data(new ArrayBuffer(64 * 1024), false)
    assert.equal(fixture.pauses, 1)
    finished.resolve(new Response('rejected', { status: 413 }))
    await fixture.ended
    assert.equal(fixture.resumes, 1)
    assert.equal(fixture.status, '413 Payload Too Large')
    await assert.rejects(request.text(), /Request aborted/)
  })

  it('cancels a response returned after the client already disconnected', async () => {
    let fixture = createTransport()
    let finished = Promise.withResolvers<Response>()
    let cancelled = Promise.withResolvers<void>()
    createUwsRequestHandler(() => finished.promise)(fixture.response, fixture.request)
    fixture.abort()
    finished.resolve(
      new Response(
        new ReadableStream({
          cancel() {
            cancelled.resolve()
          },
        }),
      ),
    )
    await cancelled.promise
    assert.deepEqual(fixture.chunks, [])
  })

  it('closes the connection if the custom error response also fails', async () => {
    let fixture = createTransport()
    let calls = 0
    function failingResponse() {
      return new Response(
        new ReadableStream({
          start(controller) {
            controller.error(new Error('body failed'))
          },
        }),
      )
    }
    createUwsRequestHandler(failingResponse, {
      onError() {
        calls++
        return failingResponse()
      },
    })(fixture.response, fixture.request)
    await fixture.closed
    assert.equal(calls, 1)
  })

  it('cancels the body if a native write fails', async () => {
    let failure = new Error('native write failed')
    let fixture = createTransport('GET', failure)
    let cancelled = Promise.withResolvers<unknown>()
    let body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('first'))
      },
      cancel(reason) {
        cancelled.resolve(reason)
      },
    })
    createUwsRequestHandler(() => new Response(body))(fixture.response, fixture.request)
    assert.equal(await cancelled.promise, failure)
    await fixture.closed
  })

  it('rejects pending request body reads when the client disconnects', async () => {
    let fixture = createTransport('POST')
    let captured = Promise.withResolvers<Request>()
    let finished = Promise.withResolvers<Response>()
    createUwsRequestHandler((request) => {
      captured.resolve(request)
      return finished.promise
    })(fixture.response, fixture.request)
    let request = await captured.promise
    assert.ok(request.body)
    let reader = request.body.getReader()
    let read = reader.read()
    fixture.abort()
    await assert.rejects(read, /Request aborted/)
    reader.releaseLock()
    finished.resolve(new Response('ignored'))
    await setTimeout(0)
    assert.equal(request.signal.aborted, true)
  })
})

function createTransport(method = 'GET', writeError?: Error) {
  let ended = Promise.withResolvers<void>()
  let closed = Promise.withResolvers<void>()
  let written = Promise.withResolvers<void>()
  let onData: (chunk: ArrayBuffer, isLast: boolean) => void = () => {}
  let onAborted = () => {}
  let chunks: string[] = []
  let fixture = {
    status: '200 OK',
    chunks,
    pauses: 0,
    resumes: 0,
    writable: true,
    writeError,
    ended: ended.promise,
    closed: closed.promise,
    written: written.promise,
    data(chunk: ArrayBuffer, isLast: boolean) {
      onData(chunk, isLast)
    },
    abort() {
      onAborted()
    },
  }
  let request: HttpRequest = {
    getHeader: () => 'example.com',
    getParameter: () => undefined,
    getUrl: () => '/upload',
    getMethod: () => method.toLowerCase(),
    getCaseSensitiveMethod: () => method,
    getQuery: () => '',
    forEach(callback) {
      callback('host', 'example.com')
    },
    setYield() {
      return this
    },
  }
  let response: HttpResponse = {
    writeStatus(status) {
      fixture.status = decode(status)
      return this
    },
    writeHeader() {
      return this
    },
    write(chunk) {
      if (fixture.writeError) throw fixture.writeError
      fixture.chunks.push(decode(chunk))
      written.resolve()
      return fixture.writable
    },
    end(body) {
      if (body !== undefined) fixture.chunks.push(decode(body))
      ended.resolve()
      return this
    },
    endWithoutBody() {
      ended.resolve()
      return this
    },
    close() {
      onAborted()
      closed.resolve()
      return this
    },
    onData(callback) {
      onData = callback
      return this
    },
    onAborted(callback) {
      onAborted = callback
      return this
    },
    onWritable() {
      return this
    },
    pause() {
      fixture.pauses++
    },
    resume() {
      fixture.resumes++
    },
    cork(callback) {
      callback()
      return this
    },
    getRemoteAddressAsText: () => new TextEncoder().encode('127.0.0.1').buffer,
    getRemotePort: () => 1234,
    tryEnd: unexpectedNativeCall,
    getWriteOffset: unexpectedNativeCall,
    collectBody: unexpectedNativeCall,
    onDataV2: unexpectedNativeCall,
    getRemoteAddress: unexpectedNativeCall,
    getProxiedRemoteAddress: unexpectedNativeCall,
    getProxiedRemoteAddressAsText: unexpectedNativeCall,
    getProxiedRemotePort: unexpectedNativeCall,
    upgrade: unexpectedNativeCall,
  }
  return Object.assign(fixture, { request, response })
}

function decode(value: RecognizedString): string {
  return typeof value === 'string' ? value : new TextDecoder().decode(value)
}

function unexpectedNativeCall(): never {
  throw new Error('Unexpected native API call')
}
