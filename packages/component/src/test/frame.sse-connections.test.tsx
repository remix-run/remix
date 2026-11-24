import { expect } from '@remix-run/assert'
import { afterEach, describe, it, type TestContext } from '@remix-run/test'

import { clientEntry } from '../runtime/client-entries.ts'
import type { Handle } from '../runtime/component.ts'
import { Frame } from '../runtime/frame.ts'
import { invariant } from '../runtime/vnode.ts'
import { run } from '../runtime/run.ts'
import { renderToStream } from '../server/stream.ts'
import { drain } from './utils.ts'

type EventStream = {
  response: Response
  write(chunk: string): void
  send(html: string): void
  close(): void
  cancelled(): boolean
}

function createEventStream(): EventStream {
  let encoder = new TextEncoder()
  let source: ReadableStreamDefaultController<Uint8Array> | undefined
  let cancelled = false
  let stream = new ReadableStream<Uint8Array>({
    start(controller) {
      source = controller
    },
    cancel() {
      cancelled = true
    },
  })

  function write(chunk: string): void {
    try {
      source?.enqueue(encoder.encode(chunk))
    } catch {
      // The reader went away, which the test asserts through `cancelled()`.
    }
  }

  return {
    response: new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } }),
    write,
    send: (html) => write(`data: ${html}\n\n`),
    close: () => source?.close(),
    cancelled: () => cancelled,
  }
}

async function waitFor<T>(read: () => T | null | undefined): Promise<T> {
  for (let attempt = 0; attempt < 200; attempt++) {
    let value = read()
    if (value != null) return value
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
  throw new Error('Timed out waiting for live frames')
}

// Frames created in the browser go through the runtime's default resolver, which is where
// connections are shared and reconnected. The entry starts empty so the frames mount after
// hydration, the way a client-rendered frame appears in a real app.
async function mountFrames(t: TestContext, sources: string[]) {
  let show: (() => void) | undefined
  let Frames = clientEntry('/js/frames.js#Frames', function Frames(handle: Handle) {
    let visible = false
    show = () => {
      visible = true
      handle.update()
    }
    return () =>
      visible ? sources.map((src) => <Frame src={src} fallback={<p>Loading…</p>} />) : null
  })

  document.body.innerHTML = await drain(renderToStream(<Frames />))
  let app = run({ loadModule: () => Frames })
  t.after(() => {
    app.dispose()
    document.body.innerHTML = ''
  })
  await app.ready()
  invariant(show, 'Expected the entry to hydrate')

  return { app, show }
}

describe('live frame connections', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('opens one connection for frames reading the same source', async (t) => {
    let events = createEventStream()
    let requests: string[] = []
    t.mock.method(globalThis, 'fetch', async (input: RequestInfo | URL) => {
      requests.push(new URL(String(input), document.baseURI).pathname)
      return events.response
    })

    let { show } = await mountFrames(t, ['/live', '/live'])
    show()
    events.send('<p class="status">Queued</p>')

    await waitFor(() => (document.querySelectorAll('.status').length === 2 ? true : null))
    expect(requests).toEqual(['/live'])
  })

  it('opens a connection per source', async (t) => {
    let first = createEventStream()
    let second = createEventStream()
    let requests: string[] = []
    t.mock.method(globalThis, 'fetch', async (input: RequestInfo | URL) => {
      requests.push(new URL(String(input), document.baseURI).pathname)
      return requests.length === 1 ? first.response : second.response
    })

    let { show } = await mountFrames(t, ['/live/one', '/live/two'])
    show()
    first.send('<p id="one">One</p>')
    second.send('<p id="two">Two</p>')

    await waitFor(() => document.getElementById('one'))
    await waitFor(() => document.getElementById('two'))
    expect(requests).toEqual(['/live/one', '/live/two'])
  })

  it('replays the last event to a frame that joins an open connection', async (t) => {
    let events = createEventStream()
    let requests = 0
    t.mock.method(globalThis, 'fetch', async () => {
      requests += 1
      return events.response
    })

    let { show } = await mountFrames(t, ['/live'])
    show()
    events.send('<p class="status">Shipped</p>')
    await waitFor(() => document.querySelector('.status'))

    // A second frame mounts after the event went out, so only the replay can render it.
    let joined = await mountFrames(t, ['/live'])
    joined.show()

    let late = await waitFor(() => document.querySelector('.status'))
    expect(late.textContent).toBe('Shipped')
    expect(requests).toBe(1)
  })

  it('catches up a joining frame with the snapshot and the appends since', async (t) => {
    let events = createEventStream()
    let requests = 0
    t.mock.method(globalThis, 'fetch', async () => {
      requests += 1
      return events.response
    })

    let { show } = await mountFrames(t, ['/live'])
    show()
    events.send('<ul class="log"><li>Started</li></ul>')
    events.write('event: append\ndata: <p class="line">One</p>\n\n')
    events.write('event: append\ndata: <p class="line">Two</p>\n\n')
    await waitFor(() => (document.querySelectorAll('.line').length === 2 ? true : null))

    let joined = await mountFrames(t, ['/live'])
    joined.show()

    await waitFor(() => (document.querySelectorAll('.line').length === 2 ? true : null))
    expect(document.querySelectorAll('.log').length).toBe(1)
    expect([...document.querySelectorAll('.line')].map((line) => line.textContent)).toEqual([
      'One',
      'Two',
    ])
    expect(requests).toBe(1)
  })

  it('closes the connection when the last frame goes away', async (t) => {
    let events = createEventStream()
    t.mock.method(globalThis, 'fetch', async () => events.response)

    let { app, show } = await mountFrames(t, ['/live', '/live'])
    show()
    events.send('<p class="status">Queued</p>')
    await waitFor(() => (document.querySelectorAll('.status').length === 2 ? true : null))

    app.dispose()
    await waitFor(() => (events.cancelled() ? true : null))
  })

  it('reconnects when the stream ends and reports the last event id', async (t) => {
    let streams = [createEventStream(), createEventStream()]
    let lastEventIds: Array<string | null> = []
    t.mock.method(globalThis, 'fetch', async (_input: RequestInfo | URL, init?: RequestInit) => {
      lastEventIds.push(new Headers(init?.headers).get('Last-Event-Id'))
      let stream = streams[lastEventIds.length - 1]
      invariant(stream, 'Expected a stream for every request')
      return stream.response
    })

    let { show } = await mountFrames(t, ['/live'])
    show()
    streams[0]!.write('retry: 10\n\n')
    streams[0]!.write('id: 7\ndata: <p class="status">Queued</p>\n\n')
    await waitFor(() => (document.querySelector('.status')?.textContent === 'Queued' ? true : null))

    streams[0]!.close()

    streams[1]!.send('<p class="status">Shipped</p>')
    await waitFor(() =>
      document.querySelector('.status')?.textContent === 'Shipped' ? true : null,
    )
    expect(lastEventIds).toEqual([null, '7'])
  })

  it('keeps the rendered content when a reconnection is refused', async (t) => {
    let events = createEventStream()
    let requests = 0
    t.mock.method(globalThis, 'fetch', async () => {
      requests += 1
      if (requests === 1) return events.response
      return new Response('<p>Gone</p>', { status: 404, headers: { 'Content-Type': 'text/html' } })
    })

    let { show } = await mountFrames(t, ['/live'])
    show()
    events.write('retry: 10\n\n')
    events.send('<p class="status">Queued</p>')
    await waitFor(() => document.querySelector('.status'))

    events.close()
    await waitFor(() => (requests === 2 ? true : null))

    // The refused reconnection ends the connection without disturbing what the frame shows.
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(document.querySelector('.status')?.textContent).toBe('Queued')
    expect(requests).toBe(2)
  })
})
