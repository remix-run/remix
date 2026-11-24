import { expect } from '@remix-run/assert'
import { afterEach, describe, it } from '@remix-run/test'

import { Frame } from '../runtime/frame.ts'
import { createRoot } from '../runtime/vdom.ts'

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
    source?.enqueue(encoder.encode(chunk))
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
  for (let attempt = 0; attempt < 100; attempt++) {
    let value = read()
    if (value != null) return value
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
  throw new Error('Timed out waiting for frame content')
}

describe('frames connected to an event stream', () => {
  let container: HTMLElement | undefined

  afterEach(() => {
    container?.remove()
    container = undefined
  })

  function renderLiveFrame(events: EventStream) {
    container = document.createElement('div')
    document.body.append(container)
    let root = createRoot(container, {
      frameInit: { resolveFrame: async () => events.response },
    })
    root.render(<Frame src="/live" fallback={<p id="fallback">Loading…</p>} />)
    root.flush()
    return root
  }

  it('renders each event as frame content', async () => {
    let events = createEventStream()
    let root = renderLiveFrame(events)

    try {
      expect(container!.querySelector('#fallback')?.textContent).toBe('Loading…')

      events.send('<p id="status">Queued</p>')
      let status = await waitFor(() => container!.querySelector('#status'))
      expect(status.textContent).toBe('Queued')
      expect(container!.querySelector('#fallback')).toBeNull()

      events.send('<p id="status">Shipped</p>')
      await waitFor(() =>
        container!.querySelector('#status')?.textContent === 'Shipped' ? true : null,
      )
    } finally {
      root.dispose()
    }
  })

  it('keeps the connection open after the first event renders', async () => {
    let events = createEventStream()
    let root = renderLiveFrame(events)

    try {
      events.send('<p id="status">Queued</p>')
      await waitFor(() => container!.querySelector('#status'))

      expect(events.cancelled()).toBe(false)
    } finally {
      root.dispose()
    }
  })

  it('diffs updates into the existing DOM instead of replacing it', async () => {
    let events = createEventStream()
    let root = renderLiveFrame(events)

    try {
      events.send('<ul id="feed"><li>First</li></ul>')
      let feed = await waitFor(() => container!.querySelector('#feed'))

      events.send('<ul id="feed"><li>First</li><li>Second</li></ul>')
      await waitFor(() => (feed.children.length === 2 ? true : null))

      expect(container!.querySelector('#feed')).toBe(feed)
      expect(feed.children[1]?.textContent).toBe('Second')
    } finally {
      root.dispose()
    }
  })

  it('renders events split across chunks and ignores comment keepalives', async () => {
    let events = createEventStream()
    let root = renderLiveFrame(events)

    try {
      events.write(': ping\r\n\r\n')
      events.write('data: <p id="split">Half')
      events.write(' written</p>\r\n')
      events.write('\r\n')

      let split = await waitFor(() => container!.querySelector('#split'))
      expect(split.textContent).toBe('Half written')
    } finally {
      root.dispose()
    }
  })

  it('joins multi-line data fields with newlines', async () => {
    let events = createEventStream()
    let root = renderLiveFrame(events)

    try {
      events.write('data: <p id="multi">\ndata: Line one\ndata: </p>\n\n')

      let multi = await waitFor(() => container!.querySelector('#multi'))
      expect(multi.textContent).toBe('\nLine one\n')
    } finally {
      root.dispose()
    }
  })

  it('closes the connection when the frame is disposed', async () => {
    let events = createEventStream()
    let root = renderLiveFrame(events)

    events.send('<p id="status">Queued</p>')
    await waitFor(() => container!.querySelector('#status'))

    root.dispose()

    await waitFor(() => (events.cancelled() ? true : null))
  })

  it('closes the connection when the frame renders other content', async () => {
    let events = createEventStream()
    container = document.createElement('div')
    document.body.append(container)
    let src = '/live'
    let root = createRoot(container, {
      frameInit: {
        resolveFrame: async () => (src === '/live' ? events.response : '<p id="static">Static</p>'),
      },
    })

    try {
      root.render(<Frame src={src} fallback={<p id="fallback">Loading…</p>} />)
      root.flush()
      events.send('<p id="status">Queued</p>')
      await waitFor(() => container!.querySelector('#status'))

      src = '/static'
      root.render(<Frame src={src} fallback={<p id="fallback">Loading…</p>} />)
      root.flush()

      await waitFor(() => container!.querySelector('#static'))
      await waitFor(() => (events.cancelled() ? true : null))
    } finally {
      root.dispose()
    }
  })
})
