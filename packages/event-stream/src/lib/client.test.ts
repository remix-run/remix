import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { connectEventStream, createEventStreamParser, parseEventStream } from './client.ts'
import { formatEventStreamMessage } from './message.ts'

describe('parseEventStream', () => {
  it('round-trips formatted server messages', () => {
    let wire = formatEventStreamMessage({
      id: '1',
      event: 'update',
      retry: 1000,
      data: 'hello\nworld',
    })
    let messages = parseEventStream(wire)

    assert.deepEqual(messages, [
      {
        event: 'update',
        id: '1',
        retry: 1000,
        data: 'hello\nworld',
      },
    ])
  })

  it('ignores heartbeat comments', () => {
    let messages = parseEventStream(': ping\n\ndata: hello\n\n')

    assert.deepEqual(messages, [
      {
        event: 'message',
        data: 'hello',
      },
    ])
  })

  it('parses split chunks and mixed line endings', () => {
    let parser = createEventStreamParser()
    let messages = parser.feed('event: token\r\ndata: hel')

    assert.deepEqual(messages, [])

    messages = parser.feed('lo\rid: 2\r\n\r\n')

    assert.deepEqual(messages, [
      {
        event: 'token',
        id: '2',
        data: 'hello',
      },
    ])
  })

  it('persists last event id across messages', () => {
    let messages = parseEventStream('id: 1\ndata: first\n\ndata: second\n\n')

    assert.deepEqual(messages, [
      {
        event: 'message',
        id: '1',
        data: 'first',
      },
      {
        event: 'message',
        id: '1',
        data: 'second',
      },
    ])
  })
})

describe('connectEventStream', () => {
  it('uses the fetch fallback when custom headers are provided', async () => {
    let opened = false
    let messages: ReturnType<typeof parseEventStream> = []
    let complete = new Promise<void>((resolve, reject) => {
      let connection = connectEventStream('https://remix.run/events', {
        headers: {
          'X-Test': 'yes',
        },
        fetch(input, init) {
          assert.equal(input, 'https://remix.run/events')
          assert.ok(init?.signal)
          assert.deepEqual(init.headers, {
            'X-Test': 'yes',
          })

          return Promise.resolve(new Response(formatEventStreamMessage({ data: 'hello' })))
        },
        onOpen(response) {
          opened = true
          assert.equal(response?.status, 200)
        },
        onMessage(message) {
          messages.push(message)
          resolve()
        },
        onError(error) {
          reject(error)
        },
      })

      assert.equal(connection.signal.aborted, false)
    })

    await complete

    assert.equal(opened, true)
    assert.deepEqual(messages, [
      {
        event: 'message',
        data: 'hello',
      },
    ])
  })
})
