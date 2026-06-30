import * as assert from '@remix-run/assert'
import { createRouter } from '@remix-run/fetch-router'
import { describe, it } from '@remix-run/test'

import { eventStream, streamText } from './event-stream.ts'

describe('eventStream', () => {
  it('returns a text/event-stream response and sends framed messages', async () => {
    let events = eventStream()

    events.send({ event: 'ready', id: '1', retry: 5000, data: 'hello\nworld' })
    events.close()

    assert.equal(events.response.headers.get('Content-Type'), 'text/event-stream')
    assert.equal(events.response.headers.get('Cache-Control'), 'no-cache')
    assert.equal(events.response.headers.get('Connection'), 'keep-alive')
    assert.equal(
      await events.response.text(),
      'id: 1\nevent: ready\nretry: 5000\ndata: hello\ndata: world\n\n',
    )
  })

  it('works as a plain Response from fetch-router', async () => {
    let router = createRouter()

    router.get('/events', () => {
      let events = eventStream()
      events.send({ data: 'from router' })
      events.close()
      return events.response
    })

    let response = await router.fetch('https://remix.run/events')

    assert.equal(response.status, 200)
    assert.equal(response.headers.get('Content-Type'), 'text/event-stream')
    assert.equal(await response.text(), 'data: from router\n\n')
  })

  it('sends heartbeat comments', async () => {
    let events = eventStream({ keepAlive: 1 })
    let body = events.response.body

    assert.ok(body)

    let reader = body.getReader()
    let result = await reader.read()
    events.close()
    reader.releaseLock()

    if (result.done) {
      assert.fail('Expected a heartbeat chunk')
    }

    assert.equal(new TextDecoder().decode(result.value), ': ping\n\n')
  })

  it('closes when the request signal aborts', async () => {
    let controller = new AbortController()
    let request = new Request('https://remix.run/events', {
      signal: controller.signal,
    })
    let events = eventStream({ request })
    let body = events.response.body

    assert.ok(body)

    let reader = body.getReader()
    controller.abort('disconnect')
    let result = await reader.read()
    reader.releaseLock()

    assert.equal(result.done, true)
    assert.equal(events.signal.aborted, true)
    assert.equal(events.signal.reason, 'disconnect')
  })

  it('exposes Last-Event-ID from the request header', async () => {
    let router = createRouter()

    router.get('/events', (context) => {
      let events = eventStream({ request: context.request })
      events.send({ data: events.lastEventId ?? 'missing' })
      events.close()
      return events.response
    })

    let response = await router.fetch('https://remix.run/events', {
      headers: {
        'Last-Event-ID': 'event-7',
      },
    })

    assert.equal(await response.text(), 'data: event-7\n\n')
  })

  it('streams text from iterable token sources', async () => {
    let events = eventStream()

    await streamText(events, ['Hello', ', ', 'world'], {
      event: 'token',
      id: 'tokens',
    })

    let expected = [
      'id: tokens\nevent: token\ndata: Hello\n\n',
      'id: tokens\nevent: token\ndata: , \n\n',
      'id: tokens\nevent: token\ndata: world\n\n',
    ].join('')

    assert.equal(
      await events.response.text(),
      expected,
    )
  })
})
