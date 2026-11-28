import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { router } from './router.ts'

async function readFirstEvent(response: Response): Promise<string> {
  assert.ok(response.body)
  let reader = response.body.getReader()
  let decoder = new TextDecoder()
  let text = ''

  try {
    while (!/data:[^]*\n\n/.test(text)) {
      let { done, value } = await reader.read()
      if (done) break
      text += decoder.decode(value, { stream: true })
    }
  } finally {
    await reader.cancel()
  }

  return text
}

describe('router', () => {
  describe('home page', () => {
    it('returns the page without resolving the live frames', async () => {
      let response = await router.fetch(new Request('http://localhost/'))
      let text = await response.text()

      assert.equal(response.status, 200)
      assert.ok(response.headers.get('Content-Type')?.startsWith('text/html'))
      assert.ok(text.includes('Live Frames'))
      assert.ok(text.includes('Connecting…'))
    })
  })

  describe('board stream', () => {
    it('answers with an event stream', async () => {
      let controller = new AbortController()
      let response = await router.fetch(
        new Request('http://localhost/board', { signal: controller.signal }),
      )

      assert.equal(response.headers.get('Content-Type'), 'text/event-stream')
      assert.equal(response.headers.get('Cache-Control'), 'no-cache')
      controller.abort()
    })

    it('sends a whole board as the first event', async () => {
      let controller = new AbortController()
      let response = await router.fetch(
        new Request('http://localhost/board', { signal: controller.signal }),
      )
      let text = await readFirstEvent(response)

      assert.ok(text.startsWith('retry: 1000\n\n'))
      assert.ok(text.includes('\nid: 1\n'))
      assert.ok(text.includes('data: '))
      assert.ok(text.includes('Harbour Gate'))
      assert.ok(text.includes('first connection'))
      controller.abort()
    })

    it('resumes numbering from the last event the browser saw', async () => {
      let controller = new AbortController()
      let response = await router.fetch(
        new Request('http://localhost/board', {
          headers: { 'Last-Event-Id': '41' },
          signal: controller.signal,
        }),
      )
      let text = await readFirstEvent(response)

      assert.ok(text.includes('\nid: 42\n'))
      assert.ok(text.includes('resumed from #41'))
      controller.abort()
    })
  })

  describe('log stream', () => {
    it('sends the history as a snapshot and new lines as appends', async () => {
      let controller = new AbortController()
      let response = await router.fetch(
        new Request('http://localhost/log', { signal: controller.signal }),
      )
      assert.ok(response.body)
      let reader = response.body.getReader()
      let decoder = new TextDecoder()
      let text = ''

      try {
        while (!text.includes('event: rmx-append')) {
          let { done, value } = await reader.read()
          if (done) break
          text += decoder.decode(value, { stream: true })
        }
      } finally {
        await reader.cancel()
      }

      let [snapshot, ...rest] = text.split('event: rmx-append')
      assert.ok(snapshot?.includes('connected'))
      assert.ok(snapshot?.includes('event: rmx-replace'))
      assert.ok(rest[0]?.includes('data: '))
      controller.abort()
    })
  })

  describe('drop endpoint', () => {
    it('ends the streams it is asked to drop', async () => {
      let controller = new AbortController()
      let response = await router.fetch(
        new Request('http://localhost/board', { signal: controller.signal }),
      )
      assert.ok(response.body)
      let reader = response.body.getReader()
      await reader.read()

      let dropped = await router.fetch(new Request('http://localhost/drop', { method: 'POST' }))
      assert.equal(dropped.status, 204)

      // The stream ends on its own, without the request being aborted.
      while (true) {
        let { done } = await reader.read()
        if (done) break
      }
      controller.abort()
    })
  })
})
