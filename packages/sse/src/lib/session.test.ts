import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createSseSession } from './session.ts'

describe('SSE Session', async () => {
  it('create a new session', () => {
    let request = new Request(`https://remix-run/sse`)
    let session = createSseSession(request)
    assert.ok(!session.connected)
    assert.equal(session.lastEventId, null)
  })

  it('handle last-event-id from request', () => {
    let request = new Request(`https://remix-run/sse`, {
      headers: {
        'last-event-id': 'remix-200',
      },
    })
    let session = createSseSession(request)
    assert.equal(session.lastEventId, 'remix-200')
  })

  describe('an opened session', async () => {
    it('is connected', () => {
      let request = new Request(`https://remix-run/sse`)
      let session = createSseSession(request)
      session.stream

      assert.ok(session.connected)
    })

    it('send the default retry', async () => {
      let controller = new AbortController()
      let request = new Request(`https://remix-run/sse`, {
        signal: controller.signal,
      })
      let session = createSseSession(request, {
        retry: 2_000,
      })

      let response = new Response(session.stream)
      assert.ok(session.connected)
      setTimeout(() => controller.abort(), 1)
      let body = await response.text()
      assert.equal(body, 'retry: 2000\n\n')
    })

    it('send data on message event', async () => {
      let controller = new AbortController()
      let request = new Request(`https://remix-run/sse`, {
        signal: controller.signal,
      })
      let session = createSseSession(request)

      setTimeout(() => controller.abort(), 1)
      let response = new Response(session.stream)
      session.send('remix-run:1234')
      let body = await response.text()
      assert.equal(body, 'data: remix-run:1234\n\n')
    })

    it('send data on custom event', async () => {
      let controller = new AbortController()
      let request = new Request(`https://remix-run/sse`, {
        signal: controller.signal,
      })
      let session = createSseSession(request)

      setTimeout(() => controller.abort(), 1)
      let response = new Response(session.stream)
      session.send('remix-run:1234', 'custom')
      let body = await response.text()
      assert.equal(body, 'event: custom\ndata: remix-run:1234\n\n')
    })

    it('send multi-line data on same event', async () => {
      let controller = new AbortController()
      let request = new Request(`https://remix-run/sse`, {
        signal: controller.signal,
      })
      let session = createSseSession(request)

      setTimeout(() => controller.abort(), 1)
      let response = new Response(session.stream)
      session.send('remix-run:1234\nremix-run:5678', 'custom')
      let body = await response.text()
      assert.equal(body, 'event: custom\ndata: remix-run:1234\ndata: remix-run:5678\n\n')
    })

    it('comment', async () => {
      let controller = new AbortController()
      let request = new Request(`https://remix-run/sse`, {
        signal: controller.signal,
      })
      let session = createSseSession(request)

      setTimeout(() => controller.abort(), 1)
      let response = new Response(session.stream)
      session.comment('comment1')
      let body = await response.text()
      assert.equal(body, ': comment1\n\n')
    })

    it('manually change retry between data', async () => {
      let controller = new AbortController()
      let request = new Request(`https://remix-run/sse`, {
        signal: controller.signal,
      })
      let session = createSseSession(request)

      setTimeout(() => controller.abort(), 1)
      let response = new Response(session.stream)
      session.comment('comment1')
      session.retry(2_000)
      session.comment('comment2')

      let body = await response.text()
      assert.equal(body, ': comment1\n\nretry: 2000\n\n: comment2\n\n')
    })

    // TODO: find a better way to handle this test
    it('keep alive with specified value', async () => {
      let controller = new AbortController()
      let request = new Request(`https://remix-run/sse`, {
        signal: controller.signal,
      })
      let session = createSseSession(request, {
        keepAlive: 1,
      })

      setTimeout(() => controller.abort(), 6)

      let response = new Response(session.stream)
      session.send('before-keep-alive#')
      let body = await response.text()
      let [_, keepAliveData] = body.split('#')

      // ho ! node ?!? sometimes 3 ticks sometime 4 ?!?
      assert.ok(keepAliveData.startsWith('\n\n: \n\n: \n\n')) // aborted - 1?
    })

    it('disconnect properly', async () => {
      let request = new Request(`https://remix-run/sse`)
      let session = createSseSession(request)
      assert.ok(!session.connected)
      let response = new Response(session.stream)
      assert.ok(session.connected)
      session.disconnect()
      assert.ok(!session.connected)
      await response.text() // without session.disconnect, this test will long forever
    })

    it('update the last-event-id', async () => {
      let controller = new AbortController()
      let request = new Request(`https://remix-run/sse`, {
        headers: {
          'last-event-id': 'remix-200',
        },
        signal: controller.signal,
      })
      let session = createSseSession(request)
      assert.equal(session.lastEventId, 'remix-200')
      setTimeout(() => controller.abort(), 1)
      let response = new Response(session.stream)
      session.send('first', 'message', 'remix-201')
      let body = await response.text()
      assert.equal(body, 'id: remix-201\ndata: first\n\n')
      assert.equal(session.lastEventId, 'remix-201')
    })

    it('throw if request aborted', () => {
      let controller = new AbortController()
      let request = new Request(`https://remix-run/sse`, {
        signal: controller.signal,
      })
      let session = createSseSession(request)
      controller.abort()

      assert.throws(() => {
        new Response(session.stream)
      })
    })
    it('throw if already consumed', () => {
      let controller = new AbortController()
      let request = new Request(`https://remix-run/sse`, {
        signal: controller.signal,
      })
      let session = createSseSession(request)

      session.stream // comsume stream
      assert.throws(() => {
        // go to jail
        new Response(session.stream)
      })
    })
  })
  describe('a closed session', () => {
    it('throw if closed', () => {
      let request = new Request(`https://remix-run/sse`)
      let session = createSseSession(request)
      assert.throws(() => {
        session.comment('ooops')
      })
    })
  })
})
