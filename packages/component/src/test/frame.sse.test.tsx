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

  it('adds an append event after the content already rendered', async () => {
    let events = createEventStream()
    let root = renderLiveFrame(events)

    try {
      events.send('<ul id="log"><li>Started</li></ul>')
      let log = await waitFor(() => container!.querySelector('#log'))

      events.write('event: rmx-append\ndata: <li>Second</li>\n\n')
      events.write('event: rmx-append\ndata: <li>Third</li>\n\n')

      let appended = await waitFor(() =>
        container!.querySelectorAll('li').length === 3 ? container!.querySelectorAll('li') : null,
      )
      expect([...appended].map((item) => item.textContent)).toEqual(['Started', 'Second', 'Third'])
      // The appended items land beside the list, not inside it, because they are added to the
      // frame rather than to any element in it.
      expect(log.children.length).toBe(1)
    } finally {
      root.dispose()
    }
  })

  it('replaces appended content on the next snapshot', async () => {
    let events = createEventStream()
    let root = renderLiveFrame(events)

    try {
      events.write('event: rmx-append\ndata: <p class="line">One</p>\n\n')
      events.write('event: rmx-append\ndata: <p class="line">Two</p>\n\n')
      await waitFor(() => (container!.querySelectorAll('.line').length === 2 ? true : null))

      events.send('<p class="line">Only</p>')

      await waitFor(() => (container!.querySelectorAll('.line').length === 1 ? true : null))
      expect(container!.querySelector('.line')?.textContent).toBe('Only')
    } finally {
      root.dispose()
    }
  })

  it('switches between appending and replacing as the stream asks', async () => {
    let events = createEventStream()
    let root = renderLiveFrame(events)

    try {
      events.write('event: rmx-append\ndata: <p class="line">One</p>\n\n')
      events.write('event: rmx-append\ndata: <p class="line">Two</p>\n\n')
      await waitFor(() => (container!.querySelectorAll('.line').length === 2 ? true : null))

      // A snapshot resets the frame, appended lines included.
      events.send('<p class="line">Fresh</p>')
      await waitFor(() => (container!.querySelectorAll('.line').length === 1 ? true : null))

      // Appending carries on from the snapshot.
      events.write('event: rmx-append\ndata: <p class="line">Next</p>\n\n')
      await waitFor(() => (container!.querySelectorAll('.line').length === 2 ? true : null))

      expect([...container!.querySelectorAll('.line')].map((line) => line.textContent)).toEqual([
        'Fresh',
        'Next',
      ])
    } finally {
      root.dispose()
    }
  })

  it('replaces on an rmx-replace event as well as an unnamed one', async () => {
    let events = createEventStream()
    let root = renderLiveFrame(events)

    try {
      events.write('event: rmx-replace\ndata: <p id="status">Named</p>\n\n')
      let status = await waitFor(() => container!.querySelector('#status'))
      expect(status.textContent).toBe('Named')

      events.send('<p id="status">Unnamed</p>')
      await waitFor(() =>
        container!.querySelector('#status')?.textContent === 'Unnamed' ? true : null,
      )
    } finally {
      root.dispose()
    }
  })

  it('ignores events addressed to something other than the frame', async () => {
    let events = createEventStream()
    let root = renderLiveFrame(events)

    try {
      events.send('<p id="status">Queued</p>')
      await waitFor(() => container!.querySelector('#status'))

      // A connection shared with the app's own events must not render them as frame content.
      events.write('event: notification\ndata: {"unread":3}\n\n')
      events.write('event: append\ndata: <p class="line">Unnamespaced</p>\n\n')
      events.write('event: rmx-append\ndata: <p class="line">Appended</p>\n\n')

      await waitFor(() => container!.querySelector('.line'))
      expect([...container!.querySelectorAll('.line')].map((line) => line.textContent)).toEqual([
        'Appended',
      ])
      expect(container!.textContent).not.toContain('unread')
    } finally {
      root.dispose()
    }
  })

  it('dispatches a bubbling rmx:update event for every event it renders', async () => {
    let events = createEventStream()
    let root = renderLiveFrame(events)
    let pushes: string[] = []
    container!.addEventListener('rmx:update', (event) => pushes.push(event.detail.kind))

    try {
      events.send('<p id="status">Queued</p>')
      await waitFor(() => container!.querySelector('#status'))
      events.write('event: rmx-append\ndata: <p class="line">One</p>\n\n')
      await waitFor(() => container!.querySelector('.line'))

      expect(pushes).toEqual(['replace', 'append'])
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
