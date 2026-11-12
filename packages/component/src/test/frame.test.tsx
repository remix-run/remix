import { expect } from '@remix-run/assert'
import { afterEach, beforeEach, describe, it, mock, type TestContext } from '@remix-run/test'
import type { FrameHandle, Handle, RemixNode } from '../runtime/component.ts'
import type { FrameReloadStartEvent } from '../runtime/reload-start-event.ts'
import type { FormSubmissionEvent } from '../runtime/form-submission-event.ts'
import { Fragment } from '../runtime/component.ts'
import { clientEntry, type EntryComponent } from '../runtime/client-entries.ts'
import { Frame, getNamedFrame, reloadFrameForNavigation } from '../runtime/frame.ts'
import { run } from '../runtime/run.ts'
import { createRangeRoot, createRoot } from '../runtime/vdom.ts'
import type { ResolveFrame } from '../runtime/frame-runtime.ts'
import { invariant } from '../runtime/invariant.ts'
import { appendFlushMarker, FRAME_TEMPLATE_END_MARKER } from '../runtime/stream-protocol.ts'
import { renderToStream } from '../server/stream.ts'
import { css, navigate, on } from '../index.ts'
import { jsx } from '../runtime/core/vnode.ts'
import {
  drain,
  nextDomMutation,
  readChunks,
  trackUnhandledRejections,
  waitForDom,
  withResolvers,
} from './utils.ts'

async function setupReloadBodyTest(t: TestContext) {
  document.body.innerHTML = '<main>Initial</main>'
  let requests: Request[] = []
  t.mock.method(globalThis, 'fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push(
      new Request(typeof input === 'string' ? new URL(input, document.baseURI) : input, init),
    )
    return new Response(
      '<!DOCTYPE html><html><head></head><body><main>Saved</main></body></html><!-- rmx:flush document -->',
    )
  })
  let app = run({ loadModule: mock.fn() })
  t.after(() => app.dispose())
  await app.ready()
  return { app, requests }
}

async function setupInheritedReloadFinished(t: TestContext) {
  document.body.innerHTML = '<main>Initial</main>'
  let app = run({
    loadModule: mock.fn(),
    resolveFrame(src) {
      return src === '/child' || src === '/outer' ? (
        <p>{src}</p>
      ) : (
        <main>
          <Frame name="child" src="/child" />
        </main>
      )
    },
  })
  t.after(() => app.dispose())
  await app.ready()
  await app.frames.top.reload()
  let child = app.frames.get('child')
  invariant(child)
  let events: FrameReloadStartEvent[] = []
  child.addEventListener('reloadStart', (event) => events.push(event))
  await app.frames.top.reload()
  let event = events[0]
  invariant(event)
  let signal = await event.finished
  expect(signal.aborted).toBe(false)
  return { app, child, events, signal }
}

function getCommentMarkerId(html: string, prefix: 'rmx:f:' | 'rmx:h:'): string {
  let re = prefix === 'rmx:f:' ? /<!--\s*rmx:f:([^ ]+)\s*-->/ : /<!--\s*rmx:h:([^ ]+)\s*-->/
  let match = html.match(re)
  invariant(match, `Expected comment marker "${prefix}"`)
  return match[1]!
}

function streamFromChunks(chunks: Array<string | Promise<string>>): ReadableStream<Uint8Array> {
  let encoder = new TextEncoder()
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      for (let chunk of chunks) {
        let value = typeof chunk === 'string' ? chunk : await chunk
        controller.enqueue(encoder.encode(value))
      }
      controller.close()
    },
  })
}

async function hydrateDataProps(t: TestContext, props: Record<string, unknown>) {
  let received: Record<string, unknown> | undefined
  let Entry = clientEntry('/data.js#Entry', function Entry(handle: Handle) {
    received = handle.props
    return () => <p>Data</p>
  })
  document.body.innerHTML = await drain(renderToStream(jsx(Entry, props)))
  received = undefined
  let errors: unknown[] = []
  let app = run({ loadModule: () => Entry })
  app.addEventListener('error', (event) => errors.push(event.error))
  t.after(() => app.dispose())
  await app.ready()
  expect(errors).toEqual([])
  invariant(received, 'Expected hydrated props')
  return received
}

async function drainWithProtocol(stream: ReadableStream<Uint8Array>): Promise<string> {
  let chunks = readChunks(stream)
  let html = ''

  while (true) {
    let chunk = await chunks.next()
    if (chunk.done) break
    html += chunk.value
  }

  return html
}

async function renderDocumentContent(content: RemixNode): Promise<string> {
  return await drainWithProtocol(
    renderToStream(
      <html>
        <head />
        <body>
          <main>{content}</main>
        </body>
      </html>,
    ),
  )
}

async function renderFrameContent(content: RemixNode): Promise<string> {
  return await drain(renderToStream(content))
}

async function renderSplitFrameTemplate(
  t: TestContext,
  scenario: 'observer' | 'hydrate',
  beforeCompletion?: () => Promise<void>,
): Promise<void> {
  let chunks = readChunks(
    renderToStream(
      <html>
        <head />
        <body>
          <Frame src="/items" fallback={<p id="fallback">Loading...</p>} />
        </body>
      </html>,
      { resolveFrame: () => '<p data-item="1">First</p><p data-item="2">Second</p>' },
    ),
  )
  let shell = await chunks.next()
  let template = await chunks.next()
  invariant(!shell.done && !template.done)
  let templateHtml = template.value
  let split = templateHtml.indexOf('<p data-item="2"')
  invariant(split !== -1)

  document.open()
  document.write(shell.value)
  if (scenario === 'hydrate') document.write(templateHtml.slice(0, split))

  let app = run({ loadModule: mock.fn() })
  t.after(() => {
    app.dispose()
    document.close()
  })
  await app.ready()

  if (scenario === 'observer') {
    let observed = nextDomMutation()
    document.write(templateHtml.slice(0, split))
    await observed
  }
  // Publishing a template removes it from the document, so it's still here until it completes.
  expect(document.querySelector('template')).not.toBe(null)
  expect(document.querySelector('#fallback')?.textContent).toBe('Loading...')
  expect(document.querySelectorAll('[data-item]').length).toBe(0)
  await beforeCompletion?.()
  document.write(templateHtml.slice(split))
  await waitForDom(() => document.querySelector('#fallback') === null)
  expect(document.readyState).toBe('loading')
}

async function setupDefaultFrameRequestTest(t: TestContext, name?: string) {
  let frame: FrameHandle | undefined
  let Probe = clientEntry('/js/probe.js#Probe', function Probe(handle: Handle) {
    frame = handle.frame
    return () => <p id="frame-content">Frame content</p>
  })
  let frameHtml = await renderFrameContent(<Probe />)
  document.body.innerHTML = await drain(
    renderToStream(<Frame name={name} src="/frame" />, { resolveFrame: () => frameHtml }),
  )
  let fetchMock = t.mock.method(globalThis, 'fetch', async () => new Response(frameHtml))
  let app = run({ loadModule: () => Probe })
  t.after(() => app.dispose())
  await app.ready()
  invariant(frame, 'Expected frame content to hydrate')
  return { frame, fetchMock }
}

async function waitForElement(
  selector: string,
  predicate: (element: Element) => boolean = () => true,
): Promise<void> {
  await waitForDom(() => {
    let element = document.querySelector(selector)
    return element !== null && predicate(element)
  })
}

async function waitForText(selector: string, text: string, root: ParentNode = document) {
  await waitForDom(() => root.querySelector(selector)?.textContent === text, root)
}

async function waitForTexts(selector: string, texts: string[]) {
  await waitForDom(() => {
    let actual = Array.from(document.querySelectorAll(selector), (node) => node.textContent)
    return actual.length === texts.length && actual.every((text, index) => text === texts[index])
  })
}

// Resolves once the frame start marker from a streamed chunk is reconciled into the document.
async function waitForFrameMarker(chunk: string) {
  let marker = new RegExp(`<!--\\s*rmx:f:${getCommentMarkerId(chunk, 'rmx:f:')}\\s*-->`)
  await waitForDom(() => marker.test(document.documentElement.innerHTML))
}

// Records every text the DOM displays from now on, including text that a later mutation replaced
// before anyone could look at it, so tests can prove stale content never rendered.
function recordRenderedText(root: Node = document): { stop(): string[] } {
  let texts: string[] = []
  let collect = (records: MutationRecord[]) => {
    for (let record of records) {
      if (record.type === 'characterData') texts.push(record.oldValue ?? '')
      for (let node of record.addedNodes) texts.push(node.textContent ?? '')
    }
  }
  let observer = new MutationObserver(collect)
  observer.observe(root, {
    characterData: true,
    characterDataOldValue: true,
    childList: true,
    subtree: true,
  })
  return {
    stop() {
      collect(observer.takeRecords())
      observer.disconnect()
      return texts
    },
  }
}

function waitForIntersection(element: Element): Promise<void> {
  return new Promise((resolve) => {
    let observer = new IntersectionObserver(() => {
      observer.disconnect()
      // Other observers in this notification batch can run after this callback.
      requestAnimationFrame(() => resolve())
    })
    observer.observe(element)
  })
}

type LazyFrameRendering = 'client' | 'hydrated' | 'server'

async function setupLazyFrame(
  t: TestContext,
  resolveFrame: ResolveFrame,
  options: {
    mode?: LazyFrameRendering
    resolvePage?: (renderPage: () => Promise<string>) => Promise<string>
  } = {},
) {
  let reveal: (() => Promise<AbortSignal>) | undefined
  let version = 0
  function renderContent(version: number, visible = true) {
    return (
      <section
        id="lazy-host"
        data-version={version}
        mix={css({ position: 'fixed', top: '100000px', left: 0 })}
      >
        {visible ? (
          <Frame name="lazy" src="/lazy" loading="lazy" fallback={<p id="waiting">Waiting</p>} />
        ) : null}
      </section>
    )
  }
  let Entry = clientEntry(
    '/lazy-entry.js#Entry',
    function Entry(handle: Handle<{ version: number }>) {
      let visible = options.mode === 'hydrated'
      reveal = () => {
        visible = true
        return handle.update()
      }
      return () => renderContent(handle.props.version, visible)
    },
  )
  let renderPage = () =>
    renderDocumentContent(
      options.mode === 'server' ? renderContent(version++) : <Entry version={version++} />,
    )
  document.documentElement.innerHTML = await renderPage()
  let app = run({
    loadModule: () => Entry,
    resolveFrame(src, resolveOptions) {
      return src === '/page'
        ? (options.resolvePage?.(renderPage) ?? renderPage())
        : resolveFrame(src, resolveOptions)
    },
  })
  t.after(() => app.dispose())
  await app.ready()
  if (options.mode !== 'server') {
    invariant(reveal)
    await reveal()
  }
  let host = document.getElementById('lazy-host')
  let frame = app.frames.get('lazy')
  invariant(host && frame)
  await waitForIntersection(host)
  return { app, frame, host, renderPage }
}

async function assertPendingLazyFrameRestart(t: TestContext, mode: LazyFrameRendering = 'client') {
  let requests: Array<{
    signal: AbortSignal
    response: ReturnType<typeof Promise.withResolvers<string>>
  }> = []
  let { app, frame, host } = await setupLazyFrame(
    t,
    (_src, options) => {
      invariant(options?.signal)
      let response = Promise.withResolvers<string>()
      requests.push({ signal: options.signal, response })
      return response.promise
    },
    { mode },
  )
  let events: string[] = []
  frame.addEventListener('reloadStart', () => events.push('start'))
  frame.addEventListener('reloadComplete', () => events.push('complete'))
  await app.frames.top.reload({ src: '/page' })
  expect(requests).toEqual([])
  expect(document.getElementById('waiting')?.textContent).toBe('Waiting')
  expect(events).toEqual(['start', 'complete'])

  host.style.top = '0'
  await waitForIntersection(host)
  expect(requests.length).toBe(1)
  expect(events).toEqual(['start', 'complete'])

  await app.frames.top.reload({ src: '/page' })
  expect(requests.length).toBe(2)
  expect(requests[0]?.signal.aborted).toBe(true)
  expect(requests[1]?.signal.aborted).toBe(false)
  requests[0]?.response.resolve('<p id="stale-lazy-content">Stale</p>')
  await waitForIntersection(host)
  expect(document.getElementById('stale-lazy-content')).toBe(null)
  expect(document.getElementById('waiting')?.textContent).toBe('Waiting')

  let completed = new Promise<void>((resolve) => {
    frame.addEventListener('reloadComplete', () => resolve(), { once: true })
  })
  requests[1]?.response.resolve('<p id="fresh-lazy-content">Fresh</p>')
  await completed
  expect(document.getElementById('fresh-lazy-content')?.textContent).toBe('Fresh')
  expect(events).toEqual(['start', 'complete', 'start', 'complete'])
}

async function assertEagerSsrTakeover(t: TestContext, streaming: boolean, explicitReload = false) {
  let loading: 'lazy' | 'eager' = 'lazy'
  let renderPage = () =>
    renderToStream(
      <html>
        <head />
        <body>
          <section id="lazy-host" mix={css({ position: 'fixed', top: 0, left: 0 })}>
            <Frame
              name="lazy"
              src="/lazy"
              loading={loading}
              fallback={loading === 'lazy' || streaming ? <p>Waiting</p> : undefined}
            />
          </section>
        </body>
      </html>,
      { resolveFrame: () => '<p id="fresh-content">Fresh</p>' },
    )
  document.documentElement.innerHTML = await drain(renderPage())
  let response = Promise.withResolvers<string>()
  let requestSignal: AbortSignal | undefined
  let app = run({
    loadModule: mock.fn(),
    resolveFrame(src, options) {
      if (src === '/page') return renderPage()
      requestSignal = options?.signal
      return response.promise
    },
  })
  t.after(() => app.dispose())
  await app.ready()
  let host = document.getElementById('lazy-host')
  let frame = app.frames.get('lazy')
  invariant(host && frame)
  await waitForIntersection(host)
  invariant(requestSignal)
  expect(requestSignal.aborted).toBe(false)
  let events: string[] = []
  let started: FrameReloadStartEvent[] = []
  frame.addEventListener('reloadStart', (event) => {
    events.push('start')
    started.push(event)
  })
  frame.addEventListener('reloadComplete', () => events.push('complete'))
  let reloaded = explicitReload ? frame.reload() : undefined

  loading = 'eager'
  await app.frames.top.reload({ src: '/page' })
  expect(app.frames.get('lazy')).toBe(frame)
  expect(document.getElementById('fresh-content')?.textContent).toBe('Fresh')
  response.resolve('<p id="stale-content">Stale</p>')
  await reloaded
  await waitForIntersection(host)
  expect(host.textContent).toBe('Fresh')
  expect(requestSignal.aborted).toBe(true)
  expect(events).toEqual(['start', 'complete'])
  expect((await started[0]!.finished).aborted).toBe(explicitReload)
}

async function assertSettledLazyFrameRestart(
  t: TestContext,
  mode: LazyFrameRendering,
  options: { failAncestor?: boolean } = {},
) {
  let requests: Array<{
    signal: AbortSignal
    response: ReturnType<typeof Promise.withResolvers<string>>
  }> = []
  let holdPage = false
  let pageResponse = Promise.withResolvers<string>()
  let { app, frame, host, renderPage } = await setupLazyFrame(
    t,
    (_src, options) => {
      invariant(options?.signal)
      let { signal } = options
      let response = Promise.withResolvers<string>()
      signal.addEventListener('abort', () => response.reject(signal.reason), { once: true })
      requests.push({ signal, response })
      return response.promise
    },
    { mode, resolvePage: (renderPage) => (holdPage ? pageResponse.promise : renderPage()) },
  )
  host.style.top = '0'
  await waitForIntersection(host)
  expect(requests.length).toBe(1)
  await app.frames.top.reload({ src: '/page' })
  expect(requests.length).toBe(2)

  host.style.top = '100000px'
  await waitForIntersection(host)
  let canceled = new Promise<void>((resolve) => {
    frame.addEventListener('reloadComplete', () => resolve(), { once: true })
  })
  holdPage = true
  let reloaded = app.frames.top.reload()
  await canceled
  expect(requests[1]?.signal.aborted).toBe(true)
  if (options.failAncestor) {
    let failure = new Error('Ancestor reload failed')
    let errors: unknown[] = []
    app.addEventListener('error', (event) => errors.push(event.error))
    let rejected = expect(reloaded).rejects.toThrow(failure.message)
    pageResponse.reject(failure)
    await rejected
    expect(errors).toEqual([failure])
    host.style.top = '0'
    await waitForIntersection(host)
  } else {
    pageResponse.resolve(await renderPage())
    await reloaded
  }
  expect(requests.length).toBe(3)
  expect(requests[2]?.signal.aborted).toBe(false)
  let loaded = waitForElement('#fresh-lazy-content')
  requests[2]?.response.resolve('<p id="fresh-lazy-content">Fresh</p>')
  await loaded
  expect(document.getElementById('fresh-lazy-content')?.textContent).toBe('Fresh')
}

async function assertLazyReloadPreemption(
  t: TestContext,
  mode: LazyFrameRendering,
  options: { ancestorReload?: boolean } = {},
) {
  let requests: Array<{
    src: string
    signal: AbortSignal
    response: ReturnType<typeof Promise.withResolvers<string>>
  }> = []
  let { app, frame, host } = await setupLazyFrame(
    t,
    (src, options) => {
      invariant(options?.signal)
      let { signal } = options
      let response = Promise.withResolvers<string>()
      signal.addEventListener('abort', () => response.reject(signal.reason), { once: true })
      requests.push({ src, signal, response })
      return response.promise
    },
    { mode },
  )
  host.style.top = '0'
  await waitForIntersection(host)
  expect(requests.length).toBe(1)
  if (options.ancestorReload) {
    await app.frames.top.reload({ src: '/page' })
    expect(requests.length).toBe(2)
    host.style.top = '0'
  }

  let previous = requests.at(-1)
  invariant(previous)
  let reloaded = frame.reload({ src: '/explicit' })
  let requestCount = requests.length
  let explicit = requests.at(-1)
  invariant(explicit)
  expect(previous.signal.aborted).toBe(true)
  expect(explicit.src).toBe('/explicit')
  await waitForIntersection(host)
  await waitForIntersection(host)
  expect(requests.length).toBe(requestCount)
  expect(explicit.signal.aborted).toBe(false)

  explicit.response.resolve('<p id="explicit-lazy-content">Explicit</p>')
  await reloaded
  expect(document.getElementById('explicit-lazy-content')?.textContent).toBe('Explicit')
  expect(frame.src).toBe('/explicit')
}

function createDisposableEntry(id: string, onDispose: () => void) {
  return clientEntry(id, function Entry(handle: Handle) {
    handle.signal.addEventListener('abort', onDispose)
    return () => <section>Entry</section>
  })
}

function createObsoleteEntryContent(Entry: EntryComponent): RemixNode {
  return <Entry />
}

function createReplacementContent(): RemixNode {
  return (
    <>
      <section id="gallery">Gallery</section>
      <section id="details">Details</section>
    </>
  )
}

async function setupFrameNavigationTest(t: TestContext) {
  let initialUrl = window.location.href
  let initialEntryKey = window.navigation.currentEntry?.key
  let baseUrl = new URL('/', initialUrl).href
  window.history.replaceState(null, '', baseUrl)

  function renderPage() {
    return renderToStream(
      <html>
        <head />
        <body>
          <Frame name="target" src="/frame" />
        </body>
      </html>,
      {
        resolveFrame(src, target) {
          expect(src).toBe('/frame')
          expect(target).toBe('target')
          return '<p id="frame-content">Frame</p>'
        },
      },
    )
  }

  let initialDocument = new DOMParser().parseFromString(await drain(renderPage()), 'text/html')
  document.documentElement.innerHTML = initialDocument.documentElement.innerHTML

  let requests: Array<{ src: string; target: string | undefined }> = []
  let app = run({
    loadModule: mock.fn(),
    async resolveFrame(src, options) {
      let target = options?.target
      requests.push({ src, target })
      if (target === 'target') return '<p id="frame-content">Targeted frame</p>'
      return renderPage()
    },
  })

  t.after(async () => {
    if (initialEntryKey && window.navigation.currentEntry?.key !== initialEntryKey) {
      await window.navigation.traverseTo(initialEntryKey).finished
    }
    app.dispose()
    window.history.replaceState(null, '', initialUrl)
  })

  await app.ready()

  return {
    baseUrl,
    requests,
    frames() {
      return {
        top: app.frames.top,
        target: app.frames.get('target'),
      }
    },
  }
}

async function navigateWithLink(
  href: string,
  options: { target: string; src?: string },
): Promise<void> {
  let link = document.createElement('a')
  link.href = href
  link.setAttribute('data-rmx-target', options.target)
  if (options.src !== undefined) link.setAttribute('data-rmx-src', options.src)
  document.body.append(link)

  // Chromium navigates during the click, but Firefox and WebKit navigate in a later task, so the
  // transition doesn't exist yet when `click()` returns.
  let listeners = new AbortController()
  let settled = new Promise<void>((resolve, reject) => {
    let { signal } = listeners
    window.navigation.addEventListener('navigatesuccess', () => resolve(), { signal })
    window.navigation.addEventListener('navigateerror', (event) => reject(event.error), { signal })
  })
  link.click()
  try {
    await settled
  } finally {
    listeners.abort()
    link.remove()
  }
}

describe('run', () => {
  let container: HTMLDivElement

  beforeEach(() => {
    // The test runner's page starts with its own <title>, so every test needs an empty head.
    document.head.replaceChildren()
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('uses fetch to request HTML by default and posts form data', async (t) => {
    let formData = new FormData()
    formData.set('name', 'Ada')
    let signal = new AbortController().signal
    let fetchMock = t.mock.method(
      globalThis,
      'fetch',
      async () =>
        new Response(
          '<!DOCTYPE html><html><head></head><body><main id="account">Ada</main></body></html><!-- rmx:flush document -->',
        ),
    )

    let app = run({ loadModule: mock.fn() })
    await app.ready()
    app.frames.top.src = '/account'

    try {
      await reloadFrameForNavigation(app.frames.top, {
        formData,
        method: 'post',
        encType: 'multipart/form-data',
        signal,
      }).finished

      expect(fetchMock).toHaveBeenCalledTimes(1)
      let [src, init] = fetchMock.mock.calls[0]!.arguments
      expect(src).toBe('/account')
      expect(init?.body).toBe(formData)
      let headers = new Headers(init?.headers)
      expect(headers.get('Accept')).toBe('text/html')
      expect(headers.get('X-Remix-Frame')).toBe('true')
      expect(headers.get('X-Remix-Target')).toBeNull()
      expect(headers.get('X-Remix-Top-Frame-Src')).toBeNull()
      expect(init?.method).toBe('post')
      expect(init?.mode).toBe('same-origin')
      expect(init?.signal).toBeInstanceOf(AbortSignal)
      expect(document.getElementById('account')?.textContent).toBe('Ada')
    } finally {
      app.dispose()
    }
  })

  it('sends frame headers and the target when reloading a named frame', async (t) => {
    let { frame, fetchMock } = await setupDefaultFrameRequestTest(t, 'details')

    await frame.reload()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    let [src, init] = fetchMock.mock.calls[0]!.arguments
    expect(src).toBe('/frame')
    expect(init?.mode).toBe('same-origin')
    let headers = new Headers(init?.headers)
    expect(headers.get('Accept')).toBe('text/html')
    expect(headers.get('X-Remix-Frame')).toBe('true')
    expect(headers.get('X-Remix-Target')).toBe('details')
    expect(headers.get('X-Remix-Top-Frame-Src')).toBeNull()
    expect(document.getElementById('frame-content')?.textContent).toBe('Frame content')
  })

  it('sends frame headers without a target when reloading an unnamed frame', async (t) => {
    let { frame, fetchMock } = await setupDefaultFrameRequestTest(t)

    await frame.reload()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    let [src, init] = fetchMock.mock.calls[0]!.arguments
    expect(src).toBe('/frame')
    expect(init?.mode).toBe('same-origin')
    let headers = new Headers(init?.headers)
    expect(headers.get('Accept')).toBe('text/html')
    expect(headers.get('X-Remix-Frame')).toBe('true')
    expect(headers.get('X-Remix-Target')).toBeNull()
    expect(headers.get('X-Remix-Top-Frame-Src')).toBeNull()
    expect(document.getElementById('frame-content')?.textContent).toBe('Frame content')
  })

  it('sends frame headers without a target when reloading the top frame', async (t) => {
    let fetchMock = t.mock.method(
      globalThis,
      'fetch',
      async () => new Response(await renderDocumentContent(<p id="next-page">Next page</p>)),
    )
    let app = run({ loadModule: mock.fn() })
    t.after(() => app.dispose())
    await app.ready()
    app.frames.top.src = '/next'

    await app.frames.top.reload()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    let [src, init] = fetchMock.mock.calls[0]!.arguments
    expect(src).toBe('/next')
    expect(init?.mode).toBe('same-origin')
    let headers = new Headers(init?.headers)
    expect(headers.get('Accept')).toBe('text/html')
    expect(headers.get('X-Remix-Frame')).toBe('true')
    expect(headers.get('X-Remix-Target')).toBeNull()
    expect(headers.get('X-Remix-Top-Frame-Src')).toBeNull()
    expect(document.getElementById('next-page')?.textContent).toBe('Next page')
  })

  it('retains the requested source without retaining the previous method or body', async (t) => {
    let { app, requests } = await setupReloadBodyTest(t)
    let events: FrameReloadStartEvent[] = []
    app.frames.top.addEventListener('reloadStart', (event) => events.push(event))
    let body = new FormData()
    body.set('name', 'Ada')
    await app.frames.top.reload({ src: '/save', method: 'post', body })
    await app.frames.top.reload()

    expect(requests).toHaveLength(2)
    expect(requests[0]!.method).toBe('POST')
    expect(requests[1]!.method).toBe('GET')
    expect(requests[1]!.url).toBe(new URL('/save', document.baseURI).href)
    expect(requests[1]!.body).toBeNull()
    expect(events).toHaveLength(2)
    expect(events[1]!.src).toBe('/save')
    expect(events[1]!.method).toBe('get')
    expect(events[1]!.encType).toBeNull()
    expect(events[1]!.formData).toBeNull()
  })

  it('normalizes multipart reload metadata and lets Fetch generate its boundary', async (t) => {
    let { app, requests } = await setupReloadBodyTest(t)
    let events: FrameReloadStartEvent[] = []
    app.frames.top.addEventListener('reloadStart', (event) => events.push(event))
    let body = new FormData()
    body.set('name', 'Ada')
    await app.frames.top.reload({
      src: '/save',
      method: 'POST',
      encType: 'MULTIPART/FORM-DATA',
      body,
    })

    expect(events).toHaveLength(1)
    expect(events[0]!.src).toBe('/save')
    expect(events[0]!.method).toBe('post')
    expect(events[0]!.encType).toBe('multipart/form-data')
    expect(events[0]!.formData).toBe(body)

    expect(requests).toHaveLength(1)
    let request = requests[0]!
    expect(request.headers.get('Content-Type')?.startsWith('multipart/form-data; boundary=')).toBe(
      true,
    )
    expect((await request.formData()).get('name')).toBe('Ada')
  })

  it('describes a POST reload on its reloadStart event and resolves finished once it renders', async (t) => {
    let { app } = await setupReloadBodyTest(t)
    let events: FrameReloadStartEvent[] = []
    app.frames.top.addEventListener('reloadStart', (event) => events.push(event))
    let body = new FormData()
    body.set('name', 'Ada')

    let reload = app.frames.top.reload({ src: '/save', method: 'post', body })

    expect(events).toHaveLength(1)
    let event = events[0]!
    expect(event.src).toBe('/save')
    expect(event.method).toBe('post')
    expect(event.encType).toBe('application/x-www-form-urlencoded')
    expect(event.formData?.get('name')).toBe('Ada')
    expect(event.element).toBeNull()
    expect(event.submitter).toBeNull()
    let signal = await event.finished
    expect(signal).toBe(await reload)
    expect(signal.aborted).toBe(false)
    expect(document.querySelector('main')?.textContent).toBe('Saved')
  })

  it('identifies the anchor when a nested element starts a link navigation', async (t) => {
    let { app } = await setupReloadBodyTest(t)
    let anchor = document.createElement('a')
    anchor.href = new URL('/next', window.location.href).href
    let label = document.createElement('span')
    anchor.append(label)
    document.body.append(anchor)
    let reloaded = Promise.withResolvers<FrameReloadStartEvent>()
    app.frames.top.addEventListener('reloadStart', reloaded.resolve, { once: true })
    let submissions: Event[] = []
    window.addEventListener('rmx:submission', (event) => submissions.push(event), {
      signal: t.signal,
    })

    label.click()
    let event = await reloaded.promise
    await event.finished

    expect(event.element).toBe(anchor)
    expect(event.submitter).toBeNull()
    expect(event.src).toBe(anchor.href)
    expect(event.method).toBe('get')
    expect(event.encType).toBeNull()
    expect(event.formData).toBeNull()
    expect(submissions).toHaveLength(0)
  })

  it('describes native form submission options after submitter overrides', async (t) => {
    let { app, requests } = await setupReloadBodyTest(t)
    let src = window.location.href
    let form = document.createElement('form')
    form.method = 'get'
    form.action = '/unused'
    let button = document.createElement('button')
    button.formAction = src
    button.formMethod = 'post'
    button.formEnctype = 'text/plain'
    button.name = 'intent'
    button.value = 'save'
    form.append(button)
    document.body.append(form)
    let reloaded = Promise.withResolvers<FrameReloadStartEvent>()
    app.frames.top.addEventListener('reloadStart', reloaded.resolve, { once: true })
    let submissions: FormSubmissionEvent[] = []
    form.addEventListener('rmx:submission', (event) => submissions.push(event))

    form.requestSubmit(button)
    let event = await reloaded.promise
    await event.finished

    expect(event.src).toBe(src)
    expect(event.method).toBe('post')
    expect(event.encType).toBe('text/plain')
    expect(event.element).toBe(form)
    expect(event.submitter).toBe(button)
    expect(event.formData?.get('intent')).toBe('save')
    expect(submissions).toHaveLength(1)
    let submission = submissions[0]!
    expect(submission.src).toBe(event.src)
    expect(submission.method).toBe('post')
    expect(submission.encType).toBe('text/plain')
    expect(submission.formData).toBe(event.formData)
    expect(submission.form).toBe(form)
    expect(submission.submitter).toBe(button)
    expect(submission.finished).toBe(event.finished)
    expect(requests[0]!.headers.get('Content-Type')).toBe('text/plain')
    expect(await requests[0]!.text()).toBe('intent=save\r\n')
  })

  it('dispatches rmx:submission on the submit button and its form after reloadStart', async (t) => {
    let { app } = await setupReloadBodyTest(t)
    let form = document.createElement('form')
    let input = document.createElement('input')
    input.name = 'contains'
    let button = document.createElement('button')
    form.append(input, button)
    document.body.append(form)
    let order: string[] = []
    let events: FormSubmissionEvent[] = []
    let reloadEvents: FrameReloadStartEvent[] = []
    app.frames.top.addEventListener('reloadStart', (event) => {
      order.push('reloadStart')
      reloadEvents.push(event)
    })
    button.addEventListener('rmx:submission', (event) => {
      events.push(event)
      order.push('button')
      event.preventDefault()
    })
    form.addEventListener('rmx:submission', (event) => {
      events.push(event)
      order.push('form')
    })
    let formData = new FormData()
    formData.set('name', 'Ada')

    let reload = reloadFrameForNavigation(app.frames.top, {
      formData,
      method: 'post',
      encType: 'application/x-www-form-urlencoded',
      element: form,
      submitter: button,
      form,
    })

    expect(order).toEqual(['reloadStart', 'button', 'form'])
    let event = events[0]!
    expect(events[1]).toBe(event)
    expect(event.target).toBe(button)
    expect(event.form).toBe(form)
    expect('element' in event).toBe(false)
    expect(event.submitter).toBe(button)
    expect(reloadEvents[0]!.element).toBe(form)
    expect(reloadEvents[0]!.submitter).toBe(button)
    expect(event.formData).toBe(formData)
    expect(event).toBeInstanceOf(SubmitEvent)
    expect(event.cancelable).toBe(false)
    expect(event.defaultPrevented).toBe(false)
    expect(event.src).toBe(reloadEvents[0]!.src)
    expect(event.method).toBe('post')
    expect(event.encType).toBe('application/x-www-form-urlencoded')
    expect(event.formData).toBe(reloadEvents[0]!.formData)
    expect(event.finished).toBe(reloadEvents[0]!.finished)
    await event.finished
    expect(document.querySelector('main')?.textContent).toBe('Saved')
    await reload.finished
  })

  it('dispatches rmx:submission for each way the browser submits a form', async (t) => {
    let { app } = await setupReloadBodyTest(t)
    type Submission = { submit(form: HTMLFormElement, button: HTMLButtonElement): void; by: string }
    let submissions: Submission[] = [
      { submit: (_form, button) => button.click(), by: 'button' },
      { submit: (form, button) => form.requestSubmit(button), by: 'button' },
      { submit: (form) => form.requestSubmit(), by: 'form' },
      // Skips the submit event, but the browser still navigates with the form's entries.
      { submit: (form) => form.submit(), by: 'form' },
    ]

    for (let { submit, by } of submissions) {
      let form = document.createElement('form')
      form.method = 'post'
      form.action = window.location.href
      let input = document.createElement('input')
      input.name = 'title'
      input.value = 'Ada'
      let button = document.createElement('button')
      form.append(input, button)
      document.body.append(form)
      let events: FormSubmissionEvent[] = []
      form.addEventListener('rmx:submission', (event) => events.push(event))
      let reloaded = new Promise<FrameReloadStartEvent>((resolve) => {
        app.frames.top.addEventListener('reloadStart', resolve, { once: true })
      })

      submit(form, button)
      let reload = await reloaded

      expect(events).toHaveLength(1)
      let event = events[0]!
      expect(event.target).toBe(by === 'button' ? button : form)
      expect(event.form).toBe(form)
      expect(event.submitter).toBe(by === 'button' ? button : null)
      expect(reload.element).toBe(form)
      expect(reload.submitter).toBe(event.submitter)
      expect(event.formData?.get('title')).toBe('Ada')
      expect(event.finished).toBe(reload.finished)
      await event.finished
      expect(document.querySelector('main')?.textContent).toBe('Saved')
    }
  })

  it('does not dispatch a stale rmx:submission when reloadStart replaces the submission', async (t) => {
    let { app } = await setupReloadBodyTest(t)
    let form = document.createElement('form')
    let events: FormSubmissionEvent[] = []
    form.addEventListener('rmx:submission', (event) => events.push(event))
    let replacement: Promise<AbortSignal> | undefined
    let reloadEvents: FrameReloadStartEvent[] = []
    app.frames.top.addEventListener('reloadStart', (event) => {
      reloadEvents.push(event)
      if (reloadEvents.length === 1) replacement = app.frames.top.reload()
    })

    await reloadFrameForNavigation(app.frames.top, { element: form, form }).finished
    await replacement

    expect(events).toHaveLength(0)
    expect((await reloadEvents[0]!.finished).aborted).toBe(true)
    await reloadEvents[1]!.finished
  })

  it('leaves formData null on rmx:submission for a GET submission', async (t) => {
    let { app } = await setupReloadBodyTest(t)
    let form = document.createElement('form')
    form.action = window.location.href
    let input = document.createElement('input')
    input.name = 'q'
    input.value = 'Ada'
    let button = document.createElement('button')
    form.append(input, button)
    document.body.append(form)
    let events: FormSubmissionEvent[] = []
    form.addEventListener('rmx:submission', (event) => events.push(event))
    let reloaded = Promise.withResolvers<FrameReloadStartEvent>()
    app.frames.top.addEventListener('reloadStart', reloaded.resolve, { once: true })
    form.requestSubmit(button)
    let reload = await reloaded.promise
    await reload.finished

    expect(events).toHaveLength(1)
    expect(events[0]!.form).toBe(form)
    expect(events[0]!.submitter).toBe(button)
    expect(events[0]!.src).toBe(reload.src)
    expect(new URL(events[0]!.src).searchParams.get('q')).toBe('Ada')
    expect(events[0]!.method).toBe('get')
    expect(events[0]!.encType).toBeNull()
    expect(events[0]!.formData).toBeNull()
    expect(events[0]!.finished).toBe(reload.finished)
    await events[0]!.finished
  })

  it('notifies the owning form when its submit button is inside another form', async (t) => {
    let { app } = await setupReloadBodyTest(t)
    let form = document.createElement('form')
    form.id = 'external-submit-form'
    form.method = 'post'
    let input = document.createElement('input')
    input.name = 'dispatchEvent'
    form.append(input)
    let otherForm = document.createElement('form')
    let button = document.createElement('button')
    button.setAttribute('form', form.id)
    otherForm.append(button)
    document.body.append(form, otherForm)
    let order: string[] = []
    let events: FormSubmissionEvent[] = []
    button.addEventListener('rmx:submission', (event) => {
      order.push('button')
      events.push(event)
    })
    form.addEventListener('rmx:submission', (event) => {
      order.push('form')
      events.push(event)
    })
    otherForm.addEventListener('rmx:submission', () => order.push('other form'))
    window.addEventListener('rmx:submission', () => order.push('window'), {
      signal: t.signal,
    })
    let reloaded = Promise.withResolvers<FrameReloadStartEvent>()
    app.frames.top.addEventListener('reloadStart', reloaded.resolve, { once: true })

    form.requestSubmit(button)
    let reload = await reloaded.promise
    await reload.finished

    expect(order).toEqual(['button', 'form', 'window'])
    expect(events).toHaveLength(2)
    expect(events[0]?.target).toBe(button)
    expect(events[0]?.bubbles).toBe(false)
    expect(events[1]?.target).toBe(form)
    expect(events[1]?.form).toBe(form)
    expect(events[1]?.submitter).toBe(button)
    expect(events[1]?.finished).toBe(reload.finished)
    expect(events[0]?.finished).toBe(reload.finished)
  })

  it('notifies the owning form after a GET submitter is detached and history is replaced', async (t) => {
    let { app } = await setupReloadBodyTest(t)
    let form = document.createElement('form')
    form.setAttribute('data-rmx-history', 'replace')
    let button = document.createElement('button')
    form.append(button)
    document.body.append(form)
    form.addEventListener('submit', () => button.remove())
    let events: FormSubmissionEvent[] = []
    form.addEventListener('rmx:submission', (event) => events.push(event))
    let reloaded = Promise.withResolvers<FrameReloadStartEvent>()
    app.frames.top.addEventListener('reloadStart', reloaded.resolve, { once: true })

    form.requestSubmit(button)
    let reload = await reloaded.promise
    await reload.finished

    expect(events).toHaveLength(1)
    expect(events[0]?.form).toBe(form)
    expect(events[0]?.submitter).toBe(button)
    expect(events[0]?.formData).toBeNull()
    expect(events[0]?.finished).toBe(reload.finished)
  })

  it('notifies the owning form after a POST submitter is detached', async (t) => {
    let { app } = await setupReloadBodyTest(t)
    let form = document.createElement('form')
    form.method = 'post'
    let button = document.createElement('button')
    button.name = 'intent'
    button.value = 'save'
    form.append(button)
    document.body.append(form)
    form.addEventListener('submit', () => button.remove())
    let events: FormSubmissionEvent[] = []
    form.addEventListener('rmx:submission', (event) => events.push(event))
    let reloaded = Promise.withResolvers<FrameReloadStartEvent>()
    app.frames.top.addEventListener('reloadStart', reloaded.resolve, { once: true })

    form.requestSubmit(button)
    let reload = await reloaded.promise
    await reload.finished

    expect(events).toHaveLength(1)
    expect(events[0]?.form).toBe(form)
    expect(events[0]?.submitter).toBe(button)
    expect(events[0]?.finished).toBe(reload.finished)
  })

  it('dispatches rmx:submission only for reloads a form submission started', async (t) => {
    let { app } = await setupReloadBodyTest(t)
    let form = document.createElement('form')
    let link = document.createElement('a')
    link.href = '/next'
    form.append(link)
    document.body.append(form)
    let events: Event[] = []
    let listeners = new AbortController()
    t.after(() => listeners.abort())
    window.addEventListener('rmx:submission', (event) => events.push(event), listeners)

    await reloadFrameForNavigation(app.frames.top, { element: link }).finished
    await app.frames.top.reload({ method: 'post', body: new FormData(form) })
    await navigate(window.location.href)

    expect(events).toHaveLength(0)
  })

  it('rejects the submission’s finished with the failure when its reload fails', async (t) => {
    document.body.innerHTML = '<main>Initial</main>'
    t.mock.method(
      globalThis,
      'fetch',
      async () =>
        new Response('<main>Internal Server Error</main>', {
          headers: { 'Content-Type': 'text/html' },
          status: 500,
          statusText: 'Internal Server Error',
        }),
    )
    let app = run({ loadModule: mock.fn() })
    t.after(() => app.dispose())
    app.addEventListener('error', () => {})
    await app.ready()
    let form = document.createElement('form')
    document.body.append(form)
    let events: FormSubmissionEvent[] = []
    let reloadEvents: FrameReloadStartEvent[] = []
    app.frames.top.addEventListener('reloadStart', (event) => reloadEvents.push(event))
    form.addEventListener('rmx:submission', (event) => events.push(event))

    let reload = reloadFrameForNavigation(app.frames.top, {
      formData: new FormData(form),
      method: 'post',
      element: form,
      form,
    })

    expect(events).toHaveLength(1)
    expect(reloadEvents).toHaveLength(1)
    expect(events[0]!.finished).toBe(reloadEvents[0]!.finished)
    await expect(events[0]!.finished).rejects.toThrow('500 Internal Server Error')
    await expect(reload.finished).rejects.toThrow('500 Internal Server Error')
    expect(document.querySelector('main')?.textContent).toBe('Initial')
  })

  it('aborts the submission handler signal when a newer submission of the same button starts', async (t) => {
    document.body.innerHTML = '<main>Initial</main>'
    let [firstResponse, resolveFirstResponse] = withResolvers<Response>()
    let fetchCalls = 0
    t.mock.method(globalThis, 'fetch', async () => {
      fetchCalls++
      if (fetchCalls === 1) return firstResponse
      return new Response(
        '<!DOCTYPE html><html><head></head><body><main>Second</main></body></html><!-- rmx:flush document -->',
      )
    })
    let app = run({ loadModule: mock.fn() })
    t.after(() => app.dispose())
    await app.ready()
    let container = document.createElement('div')
    let root = createRoot(container)
    t.after(() => root.dispose())
    let submissions: Array<{ event: FormSubmissionEvent; signal: AbortSignal }> = []
    root.render(
      <form>
        <button
          mix={on('rmx:submission', (event, signal) => {
            submissions.push({ event, signal })
          })}
        >
          Save
        </button>
      </form>,
    )
    root.flush()
    let button = container.querySelector('button')
    invariant(button)
    let form = button.form
    invariant(form)
    let submit = (value: string) => {
      let formData = new FormData()
      formData.set('value', value)
      return reloadFrameForNavigation(app.frames.top, {
        formData,
        method: 'post',
        element: form,
        submitter: button,
        form,
      })
    }

    let first = submit('first')
    let second = submit('second')

    expect(submissions.map(({ event }) => event.formData?.get('value'))).toEqual([
      'first',
      'second',
    ])
    expect(submissions[0]!.signal.aborted).toBe(true)
    expect(submissions[1]!.signal.aborted).toBe(false)
    expect((await submissions[0]!.event.finished).aborted).toBe(true)
    await submissions[1]!.event.finished
    expect(document.querySelector('main')?.textContent).toBe('Second')
    resolveFirstResponse(
      new Response(
        '<!DOCTYPE html><html><head></head><body><main>First</main></body></html><!-- rmx:flush document -->',
      ),
    )
    await Promise.all([first.finished, second.finished])
    expect(document.querySelector('main')?.textContent).toBe('Second')
  })

  it('resolves finished as aborted when a newer reload replaces it', async (t) => {
    document.body.innerHTML = '<main>Initial</main>'
    let [firstResponse, resolveFirstResponse] = withResolvers<Response>()
    let fetchCalls = 0
    t.mock.method(globalThis, 'fetch', async () => {
      fetchCalls++
      if (fetchCalls === 1) return firstResponse
      return new Response(
        '<!DOCTYPE html><html><head></head><body><main>Second</main></body></html><!-- rmx:flush document -->',
      )
    })
    let app = run({ loadModule: mock.fn() })
    t.after(() => app.dispose())
    await app.ready()
    let events: FrameReloadStartEvent[] = []
    let completions = 0
    app.frames.top.addEventListener('reloadStart', (event) => events.push(event))
    app.frames.top.addEventListener('reloadComplete', () => completions++)

    let first = app.frames.top.reload()
    let second = app.frames.top.reload()

    expect(events).toHaveLength(2)
    expect((await events[0]!.finished).aborted).toBe(true)
    resolveFirstResponse(
      new Response(
        '<!DOCTYPE html><html><head></head><body><main>First</main></body></html><!-- rmx:flush document -->',
      ),
    )
    await Promise.all([first, second])
    await events[1]!.finished
    expect(completions).toBe(1)
    expect(document.querySelector('main')?.textContent).toBe('Second')
  })

  it('resolves finished as aborted when the frame is disposed mid-reload', async (t) => {
    document.body.innerHTML = '<main>Initial</main>'
    let [response] = withResolvers<Response>()
    t.mock.method(globalThis, 'fetch', () => response)
    let app = run({ loadModule: mock.fn() })
    await app.ready()
    let events: FrameReloadStartEvent[] = []
    app.frames.top.addEventListener('reloadStart', (event) => events.push(event))

    void app.frames.top.reload().catch(() => {})
    app.dispose()

    expect(events).toHaveLength(1)
    expect((await events[0]!.finished).aborted).toBe(true)
  })

  it('resolves finished immediately when navigation aborts before its resolver settles', async (t) => {
    document.body.innerHTML = '<main>Initial</main>'
    let response = Promise.withResolvers<string>()
    let app = run({ loadModule: mock.fn(), resolveFrame: () => response.promise })
    t.after(() => {
      response.resolve('')
      app.dispose()
    })
    await app.ready()
    let signal: AbortSignal | undefined
    app.frames.top.addEventListener('reloadStart', (event) => {
      void event.finished.then((result) => {
        signal = result
      })
    })
    let controller = new AbortController()
    let reload = reloadFrameForNavigation(app.frames.top, { signal: controller.signal })

    controller.abort(new Error('Navigation stopped'))
    await Promise.resolve()

    expect(signal?.aborted).toBe(true)
    response.resolve('<!DOCTYPE html><html><head></head><body>Stale</body></html>')
    await reload.finished
    expect(document.querySelector('main')?.textContent).toBe('Initial')
  })

  it('preserves non-Error reload rejections in finished', async (t) => {
    document.body.innerHTML = '<main>Initial</main>'
    let failure: unknown
    let app = run({ loadModule: mock.fn(), resolveFrame: () => Promise.reject(failure) })
    t.after(() => app.dispose())
    app.addEventListener('error', () => {})
    await app.ready()
    let events: FrameReloadStartEvent[] = []
    app.frames.top.addEventListener('reloadStart', (event) => events.push(event))

    await expect(app.frames.top.reload()).rejects.toBe(undefined)
    await expect(events[0]!.finished).rejects.toBe(undefined)
    failure = null
    await expect(app.frames.top.reload()).rejects.toBe(null)
    await expect(events[1]!.finished).rejects.toBe(null)
  })

  it('preserves a resolver AbortError when an error listener retries', async (t) => {
    document.body.innerHTML = '<main>Initial</main>'
    let failure = new DOMException('Resolver failed', 'AbortError')
    let fail = true
    let app = run({
      loadModule: mock.fn(),
      resolveFrame() {
        if (fail) {
          fail = false
          throw failure
        }
        return '<!DOCTYPE html><html><head></head><body><main>Recovered</main></body></html>'
      },
    })
    t.after(() => app.dispose())
    let recovery: Promise<AbortSignal> | undefined
    app.addEventListener('error', () => {
      recovery = app.frames.top.reload()
    })
    await app.ready()
    let events: FrameReloadStartEvent[] = []
    app.frames.top.addEventListener('reloadStart', (event) => events.push(event))

    await expect(app.frames.top.reload()).rejects.toBe(failure)

    invariant(recovery)
    expect((await recovery).aborted).toBe(false)
    await expect(events[0]!.finished).rejects.toBe(failure)
    expect(document.querySelector('main')?.textContent).toBe('Recovered')
  })

  it('preserves a client child frame’s failure normally and when an error listener retries', async (t) => {
    document.body.innerHTML = '<main>Initial</main>'
    let failure = new Error('Child request failed')
    let failChild = false
    let order: string[] = []
    let app = run({
      loadModule: mock.fn(),
      resolveFrame(src) {
        if (src === '/child') {
          if (failChild) throw failure
          return '<p>Initial child</p>'
        }
        return (
          <main>
            <Frame name="child" src="/child" />
          </main>
        )
      },
    })
    t.after(() => app.dispose())
    await app.ready()
    await app.frames.top.reload()
    let child = app.frames.get('child')
    invariant(child)
    app.addEventListener('error', () => order.push('error'))
    let events: FrameReloadStartEvent[] = []
    child.addEventListener('reloadStart', (event) => events.push(event))
    child.addEventListener('reloadComplete', () => order.push('complete'))
    failChild = true

    await app.frames.top.reload()

    expect(events).toHaveLength(1)
    await expect(events[0]!.finished).rejects.toBe(failure)
    expect(order).toEqual(['error', 'complete'])
    expect(document.querySelector('main')?.textContent).toBe('Initial child')

    let recovery = Promise.withResolvers<AbortSignal>()
    app.addEventListener(
      'error',
      () => {
        failChild = false
        void child.reload().then(recovery.resolve, recovery.reject)
      },
      { once: true },
    )
    await app.frames.top.reload()

    expect(events).toHaveLength(3)
    await expect(events[1]!.finished).rejects.toBe(failure)
    expect((await recovery.promise).aborted).toBe(false)
    expect(order).toEqual(['error', 'complete', 'error', 'complete'])
    expect(document.querySelector('main')?.textContent).toBe('Initial child')
  })

  it('preserves a direct reload started by a finished signal’s abort listener', async (t) => {
    let { child, events, signal } = await setupInheritedReloadFinished(t)
    let replacement: Promise<AbortSignal> | undefined
    signal.addEventListener(
      'abort',
      () => {
        replacement = child.reload({ src: '/child' })
      },
      { once: true },
    )

    let outer = child.reload({ src: '/outer' })
    invariant(replacement)
    expect((await outer).aborted).toBe(true)
    let replacementSignal = await replacement

    expect(replacementSignal.aborted).toBe(false)
    expect(events).toHaveLength(2)
    expect(await events[1]!.finished).toBe(replacementSignal)
    expect(document.querySelector('main')?.textContent).toBe('/child')
  })

  it('preserves an ancestor reload started by a finished signal’s abort listener', async (t) => {
    let { app, events, signal } = await setupInheritedReloadFinished(t)
    let replacement: Promise<AbortSignal> | undefined
    signal.addEventListener(
      'abort',
      () => {
        replacement = app.frames.top.reload()
      },
      { once: true },
    )

    let outer = app.frames.top.reload()
    invariant(replacement)
    expect((await outer).aborted).toBe(true)
    expect((await replacement).aborted).toBe(false)

    expect(events).toHaveLength(2)
    expect((await events[1]!.finished).aborted).toBe(false)
    expect(document.querySelector('main')?.textContent).toBe('/child')
  })

  it('replaces inherited finished when a child reloadStart listener reloads its ancestor', async (t) => {
    document.body.innerHTML = '<main>Initial</main>'
    let app = run({
      loadModule: mock.fn(),
      resolveFrame(src) {
        if (src === '/child') return '<p>Child</p>'
        return (
          <main>
            <Frame name="child" src="/child" />
          </main>
        )
      },
    })
    t.after(() => app.dispose())
    await app.ready()
    await app.frames.top.reload()
    let child = app.frames.get('child')
    invariant(child)
    let events: FrameReloadStartEvent[] = []
    let replacement: Promise<AbortSignal> | undefined
    child.addEventListener('reloadStart', (event) => {
      events.push(event)
      if (events.length === 1) replacement = app.frames.top.reload()
    })
    let form = document.createElement('form')
    let submissions: FormSubmissionEvent[] = []
    form.addEventListener('rmx:submission', (event) => submissions.push(event))

    await reloadFrameForNavigation(app.frames.top, { element: form, form }).finished
    await replacement

    expect(events).toHaveLength(2)
    expect(submissions).toHaveLength(0)
    expect((await events[0]!.finished).aborted).toBe(true)
    await events[1]!.finished
    expect(document.querySelector('main')?.textContent).toBe('Child')
  })

  it('reloads with text/plain FormData and normalizes line breaks', async (t) => {
    let { app, requests } = await setupReloadBodyTest(t)
    let body = new FormData()
    body.set('name', 'Ada\nLovelace')
    await app.frames.top.reload({ method: 'post', encType: 'text/plain', body })

    expect(requests).toHaveLength(1)
    let request = requests[0]!
    expect(request.headers.get('Content-Type')).toBe('text/plain')
    expect(await request.text()).toBe('name=Ada\r\nLovelace\r\n')
  })

  it('defaults FormData reloads to GET and replaces the source query without a body', async (t) => {
    let { app, requests } = await setupReloadBodyTest(t)
    let events: FrameReloadStartEvent[] = []
    app.frames.top.addEventListener('reloadStart', (event) => events.push(event))
    let body = new FormData()
    body.append('name', 'Ada Lovelace')
    body.append('name', 'Grace')
    body.append('file', new File(['contents'], 'notes.txt'))
    await app.frames.top.reload({
      src: '/search?old=1#results',
      encType: 'multipart/form-data',
      body,
    })

    expect(requests).toHaveLength(1)
    let request = requests[0]!
    let expectedUrl = new URL(
      '/search?name=Ada+Lovelace&name=Grace&file=notes.txt#results',
      document.baseURI,
    ).href
    expect(events).toHaveLength(1)
    expect(events[0]!.src).toBe(expectedUrl)
    expect(events[0]!.method).toBe('get')
    expect(events[0]!.encType).toBeNull()
    expect(events[0]!.formData).toBeNull()
    expect(request.url).toBe(expectedUrl)
    expect(request.method).toBe('GET')
    expect(request.body).toBeNull()
    expect(app.frames.top.src).toBe(expectedUrl)
    expect(document.body.textContent).toBe('Saved')
  })

  it('defaults POST FormData to URL encoding with normalized line breaks and file names', async (t) => {
    let { app, requests } = await setupReloadBodyTest(t)
    let body = new FormData()
    body.set('name\nline', 'Ada\nLovelace')
    body.set('file', new File(['contents'], 'notes.txt'))
    await app.frames.top.reload({ method: 'post', body })

    expect(requests).toHaveLength(1)
    let request = requests[0]!
    expect(request.headers.get('Content-Type')).toBe('application/x-www-form-urlencoded')
    expect(await request.text()).toBe('name%0D%0Aline=Ada%0D%0ALovelace&file=notes.txt')
  })

  it('defaults an invalid form method to GET and encodes its fields in the query', async (t) => {
    let { app, requests } = await setupReloadBodyTest(t)
    let events: FrameReloadStartEvent[] = []
    app.frames.top.addEventListener('reloadStart', (event) => events.push(event))
    let body = new FormData()
    body.set('name', 'Ada')
    await app.frames.top.reload({ src: '/search?old=1', method: 'PATCH', body })

    expect(requests).toHaveLength(1)
    expect(requests[0]!.method).toBe('GET')
    expect(requests[0]!.url).toBe(new URL('/search?name=Ada', document.baseURI).href)
    expect(requests[0]!.body).toBeNull()
    expect(requests[0]!.headers.get('Content-Type')).toBeNull()
    expect(events).toHaveLength(1)
    expect(events[0]!.src).toBe(requests[0]!.url)
    expect(events[0]!.method).toBe('get')
    expect(events[0]!.encType).toBeNull()
  })

  it('accepts case-insensitive form methods and encodings', async (t) => {
    let { app, requests } = await setupReloadBodyTest(t)
    let body = new FormData()
    body.set('name', 'Ada')
    await app.frames.top.reload({ method: 'PoSt', encType: 'TEXT/PLAIN', body })

    expect(requests).toHaveLength(1)
    let request = requests[0]!
    expect(request.method).toBe('POST')
    expect(request.headers.get('Content-Type')).toBe('text/plain')
    expect(await request.text()).toBe('name=Ada\r\n')
  })

  it('falls back to URL encoding for an invalid FormData encoding', async (t) => {
    let { app, requests } = await setupReloadBodyTest(t)
    let events: FrameReloadStartEvent[] = []
    app.frames.top.addEventListener('reloadStart', (event) => events.push(event))
    let body = new FormData()
    body.set('name', 'Ada')
    await app.frames.top.reload({ method: 'post', encType: 'invalid', body })

    expect(requests).toHaveLength(1)
    expect(requests[0]!.headers.get('Content-Type')).toBe('application/x-www-form-urlencoded')
    expect(await requests[0]!.text()).toBe('name=Ada')
    expect(events).toHaveLength(1)
    expect(events[0]!.method).toBe('post')
    expect(events[0]!.encType).toBe('application/x-www-form-urlencoded')
  })

  it('submits FormData through one default fetch and renders the returned HTML', async (t) => {
    document.body.innerHTML = '<main id="initial">Initial</main>'
    let fetchMock = t.mock.method(
      globalThis,
      'fetch',
      async () =>
        new Response(
          '<!DOCTYPE html><html><head></head><body><main id="saved">Saved</main></body></html><!-- rmx:flush document -->',
        ),
    )
    let app = run({ loadModule: mock.fn() })
    t.after(() => app.dispose())
    await app.ready()
    let initialUrl = window.location.href
    let initialEntryCount = window.navigation.entries().length
    let data = new FormData()
    data.set('name', 'Ada Lovelace')

    let signal = await app.frames.top.reload({
      src: '/account/save',
      method: 'post',
      encType: 'application/x-www-form-urlencoded',
      body: data,
    })

    expect(signal.aborted).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    let [src, init] = fetchMock.mock.calls[0]!.arguments
    expect(src).toBe('/account/save')
    expect(init?.method).toBe('post')
    expect(init?.body).toBeInstanceOf(URLSearchParams)
    expect(String(init?.body)).toBe('name=Ada+Lovelace')
    expect(document.getElementById('saved')?.textContent).toBe('Saved')
    expect(window.location.href).toBe(initialUrl)
    expect(window.navigation.entries()).toHaveLength(initialEntryCount)
  })

  it('uses same-origin requests for explicitly cross-origin frame sources', async (t) => {
    let fetchMock = t.mock.method(
      globalThis,
      'fetch',
      async () =>
        new Response(
          '<!DOCTYPE html><html><head></head><body><main id="external">External frame</main></body></html><!-- rmx:flush document -->',
        ),
    )
    let app = run({ loadModule: mock.fn() })
    await app.ready()
    app.frames.top.src = 'https://frames.example/partial'

    try {
      await app.frames.top.reload()
      expect(fetchMock.mock.calls[0]?.arguments[0]).toBe('https://frames.example/partial')
      expect(fetchMock.mock.calls[0]?.arguments[1]?.mode).toBe('same-origin')
    } finally {
      app.dispose()
    }
  })

  it('uses same-origin requests when the document base is cross-origin', async (t) => {
    let fetchMock = t.mock.method(
      globalThis,
      'fetch',
      async () =>
        new Response(
          '<!DOCTYPE html><html><head></head><body><main id="external">External frame</main></body></html><!-- rmx:flush document -->',
        ),
    )
    let base = document.createElement('base')
    base.href = 'https://frames.example/partials/'
    document.head.prepend(base)
    let app = run({ loadModule: mock.fn() })
    await app.ready()
    app.frames.top.src = 'details'

    try {
      await app.frames.top.reload()
      expect(fetchMock.mock.calls[0]?.arguments[0]).toBe('details')
      expect(fetchMock.mock.calls[0]?.arguments[1]?.mode).toBe('same-origin')
    } finally {
      app.dispose()
      base.remove()
    }
  })

  it('allows custom resolvers to fetch cross-origin frame sources', async (t) => {
    let fetchMock = t.mock.method(
      globalThis,
      'fetch',
      async () =>
        new Response(
          '<!DOCTYPE html><html><head></head><body><main id="external">External frame</main></body></html><!-- rmx:flush document -->',
        ),
    )
    let app = run({
      loadModule: mock.fn(),
      resolveFrame(src, options) {
        return fetch(src, { mode: 'cors', signal: options?.signal })
      },
    })
    await app.ready()
    app.frames.top.src = 'https://frames.example/partial'

    try {
      await app.frames.top.reload()
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(fetchMock.mock.calls[0]?.arguments[0]).toBe('https://frames.example/partial')
      expect(fetchMock.mock.calls[0]?.arguments[1]?.mode).toBe('cors')
      expect(document.getElementById('external')?.textContent).toBe('External frame')
    } finally {
      app.dispose()
    }
  })

  it('renders 3xx HTML responses from the default resolver', async (t) => {
    let fetchMock = t.mock.method(
      globalThis,
      'fetch',
      async () =>
        new Response(
          '<!DOCTYPE html><html><head></head><body><main id="choices">Multiple choices</main></body></html><!-- rmx:flush document -->',
          {
            headers: { 'Content-Type': 'text/html' },
            status: 300,
            statusText: 'Multiple Choices',
          },
        ),
    )

    let app = run({ loadModule: mock.fn() })
    await app.ready()
    app.frames.top.src = '/choices'

    try {
      await app.frames.top.reload()

      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(document.getElementById('choices')?.textContent).toBe('Multiple choices')
    } finally {
      app.dispose()
    }
  })

  it('rejects non-HTML 3xx responses from the default resolver', async (t) => {
    document.body.innerHTML = '<main id="initial">Initial</main>'
    let fetchMock = t.mock.method(
      globalThis,
      'fetch',
      async () =>
        new Response('{"next":"/account"}', {
          headers: { 'Content-Type': 'application/json' },
          status: 300,
          statusText: 'Multiple Choices',
        }),
    )

    let app = run({ loadModule: mock.fn() })
    let reportedError: unknown
    app.addEventListener('error', (event) => {
      reportedError = event.error
    })

    try {
      await app.ready()
      app.frames.top.src = '/choices'

      await expect(app.frames.top.reload()).rejects.toThrow(
        'Failed to resolve frame: 300 Multiple Choices',
      )

      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(reportedError).toBeInstanceOf(Error)
      expect((reportedError as Error).message).toBe('Failed to resolve frame: 300 Multiple Choices')
      expect(document.getElementById('initial')?.textContent).toBe('Initial')
    } finally {
      app.dispose()
    }
  })

  it('renders 4xx HTML responses from the default resolver', async (t) => {
    let fetchMock = t.mock.method(
      globalThis,
      'fetch',
      async () =>
        new Response(
          '<!DOCTYPE html><html><head></head><body><p role="alert">Name is required</p></body></html><!-- rmx:flush document -->',
          {
            headers: { 'Content-Type': 'Text/HTML; charset=utf-8' },
            status: 422,
            statusText: 'Unprocessable Content',
          },
        ),
    )

    let app = run({ loadModule: mock.fn() })
    await app.ready()
    app.frames.top.src = '/account'

    try {
      await reloadFrameForNavigation(app.frames.top, {
        formData: new FormData(),
        method: 'post',
      }).finished

      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(document.querySelector('[role="alert"]')?.textContent).toBe('Name is required')
    } finally {
      app.dispose()
    }
  })

  it('rejects non-HTML 4xx responses from the default resolver', async (t) => {
    document.body.innerHTML = '<main id="initial">Initial</main>'
    let flushUnhandledRejections = trackUnhandledRejections(t)

    let fetchMock = t.mock.method(
      globalThis,
      'fetch',
      async () =>
        new Response('Not Found', {
          headers: { 'Content-Type': 'text/plain' },
          status: 404,
          statusText: 'Not Found',
        }),
    )

    let app = run({ loadModule: mock.fn() })
    let reportedError: unknown
    app.addEventListener('error', (event) => {
      reportedError = event.error
    })

    try {
      await app.ready()
      app.frames.top.src = '/account'

      await expect(app.frames.top.reload()).rejects.toThrow(
        'Failed to resolve frame: 404 Not Found',
      )
      expect(await flushUnhandledRejections()).toEqual([])
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(reportedError).toBeInstanceOf(Error)
      expect((reportedError as Error).message).toBe('Failed to resolve frame: 404 Not Found')
      expect(document.getElementById('initial')?.textContent).toBe('Initial')
    } finally {
      app.dispose()
    }
  })

  it('rejects 5xx HTML responses from the default resolver', async (t) => {
    document.body.innerHTML = '<main id="initial">Initial</main>'
    let fetchMock = t.mock.method(
      globalThis,
      'fetch',
      async () =>
        new Response('<main id="error">Internal Server Error</main>', {
          headers: { 'Content-Type': 'text/html' },
          status: 500,
          statusText: 'Internal Server Error',
        }),
    )

    let app = run({ loadModule: mock.fn() })
    let reportedError: unknown
    app.addEventListener('error', (event) => {
      reportedError = event.error
    })

    try {
      await app.ready()
      app.frames.top.src = '/account'

      await expect(app.frames.top.reload()).rejects.toThrow(
        'Failed to resolve frame: 500 Internal Server Error',
      )

      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(reportedError).toBeInstanceOf(Error)
      expect((reportedError as Error).message).toBe(
        'Failed to resolve frame: 500 Internal Server Error',
      )
      expect(document.getElementById('initial')?.textContent).toBe('Initial')
      expect(document.getElementById('error')).toBeNull()
    } finally {
      app.dispose()
    }
  })

  it('encodes urlencoded form data with URLSearchParams by default', async (t) => {
    let formData = new FormData()
    formData.set('name', 'Ada Lovelace')
    formData.set('avatar', new File([], 'avatar.png'))
    let fetchMock = t.mock.method(
      globalThis,
      'fetch',
      async () =>
        new Response(
          '<!DOCTYPE html><html><head></head><body><main id="account">Ada</main></body></html><!-- rmx:flush document -->',
        ),
    )

    let app = run({ loadModule: mock.fn() })
    await app.ready()
    app.frames.top.src = '/account'

    try {
      await reloadFrameForNavigation(app.frames.top, {
        encType: 'application/x-www-form-urlencoded',
        formData,
        method: 'post',
      }).finished

      expect(fetchMock).toHaveBeenCalledTimes(1)
      let [, init] = fetchMock.mock.calls[0]!.arguments
      expect(init?.body).toBeInstanceOf(URLSearchParams)
      expect(String(init?.body)).toBe('name=Ada+Lovelace&avatar=avatar.png')
    } finally {
      app.dispose()
    }
  })

  it('encodes text/plain form data with CRLF-delimited entries by default', async (t) => {
    let formData = new FormData()
    formData.set('name', 'Ada Lovelace')
    formData.set('bio', 'First programmer\nMathematician')
    formData.set('avatar', new File([], 'avatar.png'))
    let fetchMock = t.mock.method(
      globalThis,
      'fetch',
      async () =>
        new Response(
          '<!DOCTYPE html><html><head></head><body><main id="account">Ada</main></body></html><!-- rmx:flush document -->',
        ),
    )

    let app = run({ loadModule: mock.fn() })
    await app.ready()
    app.frames.top.src = '/account'

    try {
      await reloadFrameForNavigation(app.frames.top, {
        encType: 'text/plain',
        formData,
        method: 'post',
      }).finished

      expect(fetchMock).toHaveBeenCalledTimes(1)
      let [, init] = fetchMock.mock.calls[0]!.arguments
      let request = new Request('https://example.com/account', init)
      expect(request.headers.get('Content-Type')).toBe('text/plain')
      expect(await request.text()).toBe(
        'name=Ada Lovelace\r\nbio=First programmer\r\nMathematician\r\navatar=avatar.png\r\n',
      )
    } finally {
      app.dispose()
    }
  })

  it('hydrates a single component', async () => {
    let Counter = clientEntry(
      '/js/counter.js#Counter',
      function Counter(handle: Handle<{ initialCount: number }>) {
        let count = handle.props.initialCount
        return () => (
          <button
            mix={[
              on('click', () => {
                count++
                handle.update()
              }),
            ]}
          >
            Count: {count}
          </button>
        )
      },
    )

    let stream = renderToStream(<Counter initialCount={5} />)
    let html = await drain(stream)

    document.body.innerHTML = html

    let loadModule = mock.fn(() => Promise.resolve(Counter))

    let frame = run({ loadModule })
    await frame.ready()

    expect(loadModule).toHaveBeenCalledWith('/js/counter.js', 'Counter')

    let button = document.querySelector('button')
    expect(button?.textContent).toBe('Count: 5')

    button?.click()
    frame.flush()

    expect(button?.textContent).toBe('Count: 6')

    frame.dispose()
  })

  it('hydrates function-valued children passed to a component', async () => {
    function FormatValue(handle: Handle<{ children: (value: number) => RemixNode }>) {
      return () => <output>{handle.props.children(2)}</output>
    }

    let Interactive = clientEntry(
      '/js/interactive.js#Interactive',
      function Interactive(handle: Handle) {
        let count = 0

        return () => (
          <div>
            <FormatValue>{(value) => <>Value: {value}</>}</FormatValue>
            <button
              mix={on('click', () => {
                count++
                handle.update()
              })}
            >
              Count: {count}
            </button>
          </div>
        )
      },
    )

    let html = await drain(renderToStream(<Interactive />))
    document.body.innerHTML = html

    expect(document.querySelector('output')?.textContent).toBe('Value: 2')

    let app = run({ loadModule: mock.fn(() => Promise.resolve(Interactive)) })
    try {
      await app.ready()

      let button = document.querySelector('button')
      button?.click()
      app.flush()

      expect(button?.textContent).toBe('Count: 1')
    } finally {
      app.dispose()
    }
  })

  it('forwards hydrated client entry root error events to app listeners', async () => {
    let error = new Error('hydrated client entry root error')
    let Broken = clientEntry('/js/broken.js#Broken', function Broken() {
      return () => <button>Trigger</button>
    })

    let html = await drain(renderToStream(<Broken />))
    document.body.innerHTML = html

    let app = run({ loadModule: mock.fn(() => Promise.resolve(Broken)) })
    let forwarded: unknown
    app.addEventListener('error', (event) => {
      forwarded = (event as ErrorEvent).error
    })

    await app.ready()

    let marker = Array.from(document.body.childNodes).find(
      (node): node is Comment & { $rmx: EventTarget } => node instanceof Comment && '$rmx' in node,
    )
    invariant(marker, 'Expected hydrated client entry marker')
    marker.$rmx.dispatchEvent(new ErrorEvent('error', { error }))

    expect(forwarded).toBe(error)

    app.dispose()
  })

  it('dispatches ready() rejections to app error listeners', async () => {
    document.body.innerHTML = '<!-- rmx:h:broken --><button>Broken</button>'

    let app = run({ loadModule: mock.fn() })
    let forwarded: unknown
    app.addEventListener('error', (event) => {
      forwarded = event.error
    })

    let readyError = await app.ready().catch((error) => error)

    expect(readyError).toBeInstanceOf(Error)
    expect((readyError as Error).message).toBe('End marker not found')
    expect(forwarded).toBe(readyError)

    app.dispose()
  })

  it('hydrates multiple components', async () => {
    let Button = clientEntry(
      '/js/button.js#Button',
      function Button(handle: Handle<{ text: string }>) {
        let clicked = false
        return () => (
          <button
            mix={[
              on('click', () => {
                clicked = true
                handle.update()
              }),
            ]}
          >
            {clicked ? `${handle.props.text} clicked!` : handle.props.text}
          </button>
        )
      },
    )

    let stream = renderToStream(
      <div>
        <Button text="First" />
        <Button text="Second" />
      </div>,
    )
    let html = await drain(stream)

    document.body.innerHTML = html

    let loadModule = mock.fn(() => Promise.resolve(Button))

    let frame = run({ loadModule })
    await frame.ready()

    // Module is cached by moduleUrl+exportName
    expect(loadModule).toHaveBeenCalledTimes(1)

    let buttons = document.querySelectorAll('button')
    expect(buttons).toHaveLength(2)
    expect(buttons[0]?.textContent).toBe('First')
    expect(buttons[1]?.textContent).toBe('Second')

    buttons[0]?.click()
    frame.flush()

    expect(buttons[0]?.textContent).toBe('First clicked!')
    expect(buttons[1]?.textContent).toBe('Second')

    frame.dispose()
  })

  it('hydrates nested client entries without duplicating events or DOM ownership', async () => {
    let outerSetupCount = 0
    let toggleSetupCount = 0
    let toggleClickCount = 0

    let Outer = clientEntry(
      '/js/outer.js#Outer',
      function Outer(handle: Handle<{ children?: RemixNode }>) {
        outerSetupCount++
        return () => handle.props.children ?? null
      },
    )

    let Toggle = clientEntry('/js/toggle.js#Toggle', function Toggle(handle: Handle) {
      toggleSetupCount++
      let wrapped = false

      function toggle() {
        toggleClickCount++
        wrapped = !wrapped
        handle.update()
      }

      return () =>
        wrapped ? (
          <div id="wrapper">
            <button id="wrapped-button" type="button" mix={[on('click', toggle)]}>
              Wrapped
            </button>
          </div>
        ) : (
          <button id="bare-button" type="button" mix={[on('click', toggle)]}>
            Bare
          </button>
        )
    })

    let html = await drain(
      renderToStream(
        <Outer>
          <Toggle />
        </Outer>,
      ),
    )
    document.body.innerHTML = html
    outerSetupCount = 0
    toggleSetupCount = 0
    toggleClickCount = 0

    let outerStart = document.body.firstChild
    invariant(outerStart instanceof Comment)
    let outerId = outerStart.data.trim().slice('rmx:h:'.length)
    let innerStart = outerStart.nextSibling
    invariant(innerStart instanceof Comment)
    let innerId = innerStart.data.trim().slice('rmx:h:'.length)

    function expectBodyHtml(innerHtml: string) {
      expect(document.body.innerHTML).toBe(
        `<!-- rmx:h:${outerId} --><!-- rmx:h:${innerId} -->${innerHtml}<!-- /rmx:h --><!-- /rmx:h -->`,
      )
    }

    function getButton(id: string): HTMLButtonElement {
      let button = document.getElementById(id)
      invariant(button instanceof HTMLButtonElement)
      return button
    }

    let app = run({
      loadModule(moduleUrl, exportName) {
        if (moduleUrl === '/js/outer.js' && exportName === 'Outer') return Outer
        if (moduleUrl === '/js/toggle.js' && exportName === 'Toggle') return Toggle
        throw new Error(`Unexpected module: ${moduleUrl}#${exportName}`)
      },
    })

    await app.ready()

    expect(outerSetupCount).toBe(1)
    expect(toggleSetupCount).toBe(1)
    expect(toggleClickCount).toBe(0)
    expectBodyHtml('<button id="bare-button" type="button">Bare</button>')

    getButton('bare-button').click()
    app.flush()

    expect(toggleClickCount).toBe(1)
    expectBodyHtml(
      '<div id="wrapper"><button id="wrapped-button" type="button">Wrapped</button></div>',
    )

    getButton('wrapped-button').click()
    app.flush()

    expect(toggleClickCount).toBe(2)
    expectBodyHtml('<button id="bare-button" type="button">Bare</button>')

    app.dispose()
  })

  it('does not hydrate imported client entries through their parent boundary', async () => {
    let clicks = 0
    let updateOuter = () => {}

    let Inner = clientEntry('/inner.js#Inner', function Inner() {
      return () => (
        <button
          mix={[
            on('click', () => {
              clicks++
            }),
          ]}
        >
          Inner
        </button>
      )
    })

    let Outer = clientEntry('/outer.js#Outer', function Outer(handle: Handle) {
      updateOuter = () => {
        void handle.update()
      }
      return () => (
        <section>
          <Inner />
        </section>
      )
    })

    document.body.innerHTML = await drain(renderToStream(<Outer />))

    let app = run({
      loadModule(moduleUrl, exportName) {
        if (moduleUrl === '/outer.js' && exportName === 'Outer') return Outer
        if (moduleUrl === '/inner.js' && exportName === 'Inner') return Inner
        throw new Error(`Unexpected client entry: ${moduleUrl}#${exportName}`)
      },
    })
    await app.ready()

    let button = document.querySelector('button')
    invariant(button)

    button.click()
    expect(clicks).toBe(1)

    updateOuter()
    app.flush()
    button.click()
    expect(clicks).toBe(2)

    app.dispose()
  })

  it('removes orphaned hydration end markers after full-document reloads of adjacent client entries', async () => {
    let FragmentEntry = clientEntry(
      '/js/fragment-entry.js#FragmentEntry',
      function FragmentEntry() {
        return () => <div />
      },
    )

    async function renderInitialBody() {
      return await drain(
        renderToStream(
          <div>
            <FragmentEntry />
            <FragmentEntry />
          </div>,
        ),
      )
    }

    async function renderReloadDocument() {
      return await drainWithProtocol(
        renderToStream(
          <html>
            <body>
              <div>
                <FragmentEntry />
              </div>
            </body>
          </html>,
        ),
      )
    }

    document.body.innerHTML = await renderInitialBody()

    let app = run({
      loadModule: mock.fn(() => Promise.resolve(FragmentEntry)),
      async resolveFrame(src: string) {
        if (src === '/b') return await renderReloadDocument()
        throw new Error(`Unexpected frame src: ${src}`)
      },
    })

    await app.ready()

    let topFrame = app.frames.top

    topFrame.src = '/b'
    await topFrame.reload()

    let bodyHtml = document.body.innerHTML
    let hydrationStarts = bodyHtml.match(/<!--\s*rmx:h:/g)?.length ?? 0
    let hydrationEnds = bodyHtml.match(/<!--\s*\/rmx:h\s*-->/g)?.length ?? 0

    expect(hydrationStarts).toBe(hydrationEnds)

    app.dispose()
  })

  it('keeps siblings inserted while obsolete client entries are disposed during document reloads', async () => {
    let disposeCount = 0

    let Entry = createDisposableEntry('/js/entry.js#Entry', () => {
      disposeCount++
    })

    let initialDocument = new DOMParser().parseFromString(
      await renderDocumentContent(createObsoleteEntryContent(Entry)),
      'text/html',
    )
    document.documentElement.innerHTML = initialDocument.documentElement.innerHTML

    let app = run({
      loadModule(moduleUrl, exportName) {
        if (moduleUrl === '/js/entry.js' && exportName === 'Entry') return Entry
        throw new Error(`Unexpected module: ${moduleUrl}#${exportName}`)
      },
      async resolveFrame(src: string) {
        if (src === '/destination') {
          return await renderDocumentContent(createReplacementContent())
        }
        throw new Error(`Unexpected frame src: ${src}`)
      },
    })

    try {
      await app.ready()

      let topFrame = app.frames.top
      topFrame.src = '/destination'
      await topFrame.reload()

      expect(document.querySelector('main')?.innerHTML).toBe(
        '<section id="gallery">Gallery</section><section id="details">Details</section>',
      )
      expect(disposeCount).toBe(1)
    } finally {
      app.dispose()
    }
  })

  it('keeps siblings inserted while obsolete client entries are disposed during frame reloads', async () => {
    let disposeCount = 0

    let Entry = createDisposableEntry('/js/frame-entry.js#FrameEntry', () => {
      disposeCount++
    })

    let html = await drain(
      renderToStream(<Frame name="target" src="/initial" />, {
        resolveFrame(src) {
          if (src === '/initial') {
            return renderFrameContent(
              <>
                {createObsoleteEntryContent(Entry)}
                <section id="trailing">Trailing</section>
              </>,
            )
          }
          throw new Error(`Unexpected server frame src: ${src}`)
        },
      }),
    )
    document.body.innerHTML = html

    let app = run({
      loadModule(moduleUrl, exportName) {
        if (moduleUrl === '/js/frame-entry.js' && exportName === 'FrameEntry') return Entry
        throw new Error(`Unexpected module: ${moduleUrl}#${exportName}`)
      },
      resolveFrame(src) {
        if (src === '/destination') return renderFrameContent(createReplacementContent())
        throw new Error(`Unexpected client frame src: ${src}`)
      },
    })

    try {
      await app.ready()

      let trailingSibling = document.querySelector('#trailing')
      invariant(trailingSibling)

      let targetFrame = app.frames.get('target')
      invariant(targetFrame)
      targetFrame.src = '/destination'
      await targetFrame.reload()

      expect(document.body.innerHTML).toContain(
        '<section id="gallery">Gallery</section><section id="details">Details</section>',
      )
      expect(document.querySelector('#details')).toBe(trailingSibling)
      expect(disposeCount).toBe(1)
    } finally {
      app.dispose()
    }
  })

  it('preserves hydrated client entries across full-document reloads', async () => {
    let setupCount = 0
    let removeCount = 0

    function createRootEntryRender(handle: Handle<{ label: string }>) {
      let count = 0
      return () => (
        <button
          id="root-entry"
          mix={[
            on('click', () => {
              count++
              handle.update()
            }),
          ]}
        >
          {handle.props.label}: {count}
        </button>
      )
    }

    let ServerRootEntry = clientEntry(
      '/js/root-entry.js#RootEntry',
      function RootEntry(handle: Handle<{ label: string }>) {
        return createRootEntryRender(handle)
      },
    )

    let ClientRootEntry = clientEntry(
      '/js/root-entry.js#RootEntry',
      function RootEntry(handle: Handle<{ label: string }>) {
        setupCount++
        handle.signal.addEventListener('abort', () => {
          removeCount++
        })

        return createRootEntryRender(handle)
      },
    )

    async function renderDocument(label: string) {
      return await drainWithProtocol(
        renderToStream(
          <html>
            <head />
            <body>
              <div>
                <ServerRootEntry label={label} />
              </div>
            </body>
          </html>,
        ),
      )
    }

    let initialDocument = new DOMParser().parseFromString(
      await renderDocument('Initial'),
      'text/html',
    )
    document.documentElement.innerHTML = initialDocument.documentElement.innerHTML

    let app = run({
      loadModule(moduleUrl, exportName) {
        if (moduleUrl === '/js/root-entry.js' && exportName === 'RootEntry') return ClientRootEntry
        throw new Error(`Unexpected module: ${moduleUrl}#${exportName}`)
      },
      async resolveFrame(src: string) {
        if (src === '/root') return await renderDocument('Reloaded')
        throw new Error(`Unexpected frame src: ${src}`)
      },
    })

    await app.ready()

    let button = document.getElementById('root-entry') as HTMLButtonElement | null
    invariant(button)
    expect(button.textContent).toBe('Initial: 0')
    expect(setupCount).toBe(1)

    button.click()
    app.flush()
    expect(button.textContent).toBe('Initial: 1')

    let topFrame = app.frames.top
    topFrame.src = '/root'
    await topFrame.reload()

    expect(document.getElementById('root-entry')).toBe(button)
    expect(button.textContent).toBe('Reloaded: 1')
    expect(setupCount).toBe(1)
    expect(removeCount).toBe(0)

    app.dispose()
  })

  it('disposes hydrated client entries removed by full-document reloads', async () => {
    let removeCount = 0

    let ServerRemovedEntry = clientEntry(
      '/js/removed-entry.js#RemovedEntry',
      function RemovedEntry() {
        return () => <button id="removed-entry">Removed entry</button>
      },
    )

    let ClientRemovedEntry = clientEntry(
      '/js/removed-entry.js#RemovedEntry',
      function RemovedEntry(handle: Handle) {
        handle.signal.addEventListener('abort', () => {
          removeCount++
        })

        return () => <button id="removed-entry">Removed entry</button>
      },
    )

    async function renderDocument(includeEntry: boolean) {
      return await drainWithProtocol(
        renderToStream(
          <html>
            <head />
            <body>
              <main>{includeEntry ? <ServerRemovedEntry /> : <p id="replacement">Gone</p>}</main>
            </body>
          </html>,
        ),
      )
    }

    let initialDocument = new DOMParser().parseFromString(await renderDocument(true), 'text/html')
    document.documentElement.innerHTML = initialDocument.documentElement.innerHTML

    let app = run({
      loadModule(moduleUrl, exportName) {
        if (moduleUrl === '/js/removed-entry.js' && exportName === 'RemovedEntry') {
          return ClientRemovedEntry
        }
        throw new Error(`Unexpected module: ${moduleUrl}#${exportName}`)
      },
      async resolveFrame(src: string) {
        if (src === '/without-entry') return await renderDocument(false)
        throw new Error(`Unexpected frame src: ${src}`)
      },
    })

    await app.ready()

    expect(document.getElementById('removed-entry')).toBeInstanceOf(HTMLButtonElement)
    expect(removeCount).toBe(0)

    let topFrame = app.frames.top
    topFrame.src = '/without-entry'
    await topFrame.reload()

    expect(document.getElementById('removed-entry')).toBeNull()
    expect(document.getElementById('replacement')?.textContent).toBe('Gone')
    expect(removeCount).toBe(1)

    app.dispose()
  })

  it('shows destination SSR while a different client entry module is loading', async () => {
    let pageTitleDisposeCount = 0
    let collectionGridDisposeCount = 0

    let PageTitle = clientEntry('/js/page-title.js#PageTitle', function PageTitle(handle: Handle) {
      handle.signal.addEventListener('abort', () => {
        pageTitleDisposeCount++
      })
      return () => <h1 id="collection-title">All products</h1>
    })

    let CollectionGrid = clientEntry(
      '/js/collection-grid.js#CollectionGrid',
      function CollectionGrid(handle: Handle) {
        handle.signal.addEventListener('abort', () => {
          collectionGridDisposeCount++
        })
        return () => (
          <section id="collection-grid">
            <a href="/products/test-product">Test product</a>
          </section>
        )
      },
    )

    let ProductDetails = clientEntry(
      '/js/product-details.js#ProductDetails',
      function ProductDetails(handle: Handle) {
        let added = false
        return () => (
          <article id="product-details">
            <h1>Test product</h1>
            <button
              type="button"
              mix={on('click', () => {
                added = true
                handle.update()
              })}
            >
              {added ? 'Added' : 'Add to cart'}
            </button>
          </article>
        )
      },
    )

    async function renderCollectionDocument() {
      return await renderDocumentContent(
        <>
          <PageTitle />
          <CollectionGrid />
        </>,
      )
    }

    async function renderProductDocument() {
      return await renderDocumentContent(<ProductDetails />)
    }

    let initialDocument = new DOMParser().parseFromString(
      await renderCollectionDocument(),
      'text/html',
    )
    document.documentElement.innerHTML = initialDocument.documentElement.innerHTML

    let [productModuleRequested, markProductModuleRequested] = withResolvers<void>()
    let [productModuleGate, allowProductModule] = withResolvers<void>()
    let app = run({
      async loadModule(moduleUrl, exportName) {
        if (moduleUrl === '/js/page-title.js' && exportName === 'PageTitle') return PageTitle
        if (moduleUrl === '/js/collection-grid.js' && exportName === 'CollectionGrid') {
          return CollectionGrid
        }
        if (moduleUrl === '/js/product-details.js' && exportName === 'ProductDetails') {
          markProductModuleRequested()
          await productModuleGate
          return ProductDetails
        }
        throw new Error(`Unexpected module: ${moduleUrl}#${exportName}`)
      },
      async resolveFrame(src: string) {
        if (src === '/products/test-product') return await renderProductDocument()
        throw new Error(`Unexpected frame src: ${src}`)
      },
    })

    try {
      await app.ready()
      expect(document.getElementById('collection-title')).not.toBeNull()
      expect(document.getElementById('collection-grid')).not.toBeNull()

      let topFrame = app.frames.top
      topFrame.src = '/products/test-product'
      let reloadPromise = topFrame.reload()
      await productModuleRequested

      expect(document.getElementById('collection-title')).toBeNull()
      expect(document.getElementById('collection-grid')).toBeNull()
      expect(document.getElementById('product-details')).not.toBeNull()
      expect(pageTitleDisposeCount).toBe(1)
      expect(collectionGridDisposeCount).toBe(1)

      allowProductModule()
      await reloadPromise

      let addButton = document.querySelector('#product-details button')
      invariant(addButton instanceof HTMLButtonElement)
      addButton.click()
      app.flush()
      expect(addButton.textContent).toBe('Added')
    } finally {
      app.dispose()
    }
  })

  it('shows the replacement entry styled while its module is loading', async () => {
    // Regression test for the demo-to-demo navigation FOUC: a full-document
    // reload commits a different client entry's server-rendered DOM before its
    // module finishes loading, so its adopted server styles must already be live.

    function rulePresent(selector: string): boolean {
      return Array.from(document.adoptedStyleSheets).some((sheet) =>
        Array.from(sheet.cssRules).some((rule) => rule.cssText.includes(`.${selector}`)),
      )
    }

    function findClassByPrefix(host: ParentNode, idAttr: string): string | undefined {
      let el = host.querySelector(`#${idAttr}`)
      let classes = el?.getAttribute('class')?.split(/\s+/).filter(Boolean) ?? []
      return classes.find((c) => c.startsWith('rmxc-'))
    }

    function adoptInitialDocument(html: string): void {
      let parsed = new DOMParser().parseFromString(html, 'text/html')
      let live = document.documentElement
      while (live.firstChild) live.removeChild(live.firstChild)
      for (let child of Array.from(parsed.documentElement.childNodes)) {
        live.appendChild(document.importNode(child, true))
      }
    }

    let aStyle = css({ color: 'rgb(10, 20, 30)' })
    let bStyle = css({ color: 'rgb(40, 50, 60)' })

    let EntryA = clientEntry('/js/entry-a.js#EntryA', function EntryA() {
      return () => (
        <div id="entry-a" mix={[aStyle]}>
          A
        </div>
      )
    })

    let EntryB = clientEntry('/js/entry-b.js#EntryB', function EntryB() {
      return () => (
        <div id="entry-b" mix={[bStyle]}>
          B
        </div>
      )
    })

    async function renderDocument(useA: boolean) {
      return await drainWithProtocol(
        renderToStream(
          <html>
            <head />
            <body>
              <main>{useA ? <EntryA /> : <EntryB />}</main>
            </body>
          </html>,
        ),
      )
    }

    adoptInitialDocument(await renderDocument(true))

    // Capture the SSR class names from the live document before hydration, so
    // we can assert against the actual hashed selectors the css() calls
    // produced rather than recomputing them.
    let aSelector = findClassByPrefix(document, 'entry-a')
    invariant(aSelector, 'expected SSR markup to carry an rmxc-* class for entry-a')

    let [bModuleRequested, markBModuleRequested] = withResolvers<void>()
    let [bModuleGate, allowBModule] = withResolvers<void>()
    let app = run({
      async loadModule(moduleUrl, exportName) {
        if (moduleUrl === '/js/entry-a.js' && exportName === 'EntryA') return EntryA
        if (moduleUrl === '/js/entry-b.js' && exportName === 'EntryB') {
          markBModuleRequested()
          await bModuleGate
          return EntryB
        }
        throw new Error(`Unexpected module: ${moduleUrl}#${exportName}`)
      },
      async resolveFrame(src: string) {
        if (src === '/b') return await renderDocument(false)
        throw new Error(`Unexpected frame src: ${src}`)
      },
    })

    await app.ready()
    expect(rulePresent(aSelector)).toBe(true)

    // Begin the reload but hold EntryB's module load to inspect its server DOM
    // before hydration makes it interactive.
    let topFrame = app.frames.top
    topFrame.src = '/b'
    let reloadSettled = false
    let reloadPromise = topFrame.reload().then(() => {
      reloadSettled = true
    })
    await bModuleRequested

    // Pull EntryB's hashed selector from the SSR markup that replaceServerStyles
    // just adopted into adoptedStyleSheets.
    let bDocHtml = await renderDocument(false)
    let bDoc = new DOMParser().parseFromString(bDocHtml, 'text/html')
    let bSelectorFromB = findClassByPrefix(bDoc, 'entry-b')
    invariant(bSelectorFromB, 'expected SSR markup to carry an rmxc-* class for entry-b')

    expect(document.getElementById('entry-a')).toBeNull()
    expect(document.getElementById('entry-b')).not.toBeNull()
    expect(rulePresent(bSelectorFromB)).toBe(true)
    expect(reloadSettled).toBe(false)

    // Allow the module load to finish and hydrate the destination SSR.
    allowBModule()
    await reloadPromise

    expect(document.getElementById('entry-a')).toBeNull()
    expect(document.getElementById('entry-b')).not.toBeNull()
    // entry-a's rule was server-adopted, so it is pinned and stays in the
    // registry even after its mixin tears down — content-addressed rules are
    // only ever unused, never wrong.
    expect(rulePresent(aSelector)).toBe(true)
    expect(rulePresent(bSelectorFromB)).toBe(true)

    app.dispose()
  })

  it('does not start transitions when hydrating adopted server styles', async () => {
    let knobStyle = css({
      '--offset': '8px',
      display: 'block',
      width: '30px',
      height: '18px',
      '&::before': {
        content: '""',
        display: 'block',
        width: '10px',
        height: '14px',
        transform: 'translateX(0)',
        transition: 'transform 80ms ease, width 80ms ease',
      },
      '&[data-state="checked"]::before': {
        width: '18px',
        transform: 'translateX(var(--offset))',
      },
    })

    let HydratedKnob = clientEntry(
      '/assets/hydrated-knob.js#HydratedKnob',
      function HydratedKnob() {
        return () => <div id="hydrated-knob" data-state="checked" mix={[knobStyle]} />
      },
    )

    let html = await drain(renderToStream(<HydratedKnob />))
    document.body.innerHTML = html

    let target = document.getElementById('hydrated-knob')
    invariant(target instanceof HTMLDivElement)

    let beforeTransform = getComputedStyle(target, '::before').transform
    let beforeWidth = getComputedStyle(target, '::before').width
    expect(beforeTransform).toBe('matrix(1, 0, 0, 1, 8, 0)')
    expect(beforeWidth).toBe('18px')

    let app = run({
      loadModule(moduleUrl, exportName) {
        if (moduleUrl === '/assets/hydrated-knob.js' && exportName === 'HydratedKnob') {
          return HydratedKnob
        }
        throw new Error(`Unexpected module: ${moduleUrl}#${exportName}`)
      },
    })

    await app.ready()

    expect(getComputedStyle(target, '::before').transform).toBe(beforeTransform)
    expect(getComputedStyle(target, '::before').width).toBe(beforeWidth)
    // Reading computed style flushes style, which creates any transition synchronously.
    expect(target.getAnimations({ subtree: true })).toEqual([])

    app.dispose()
  })

  it('disposes named frames replaced by client entries during full-document reloads', async () => {
    let readNamedFrame: (() => unknown) | undefined

    let Probe = clientEntry('/js/probe.js#Probe', function Probe(handle: Handle) {
      readNamedFrame = () => handle.frames.get('replace-me')
      return () => <button id="probe">Probe</button>
    })

    let Replacement = clientEntry('/js/replacement.js#Replacement', function Replacement() {
      return () => <p id="replacement">Replacement</p>
    })

    async function renderDocument(includeFrame: boolean) {
      return await drainWithProtocol(
        renderToStream(
          <html>
            <head />
            <body>
              <main>
                <Probe />
                {includeFrame ? (
                  <Frame
                    name="replace-me"
                    src="/frame"
                    fallback={<span id="frame-fallback">Loading frame...</span>}
                  />
                ) : (
                  <Replacement />
                )}
              </main>
            </body>
          </html>,
          {
            resolveFrame(src: string) {
              if (src === '/frame') return '<p id="frame-content">Frame content</p>'
              throw new Error(`Unexpected frame src: ${src}`)
            },
          },
        ),
      )
    }

    let initialDocument = new DOMParser().parseFromString(await renderDocument(true), 'text/html')
    document.documentElement.innerHTML = initialDocument.documentElement.innerHTML

    let app = run({
      loadModule(moduleUrl, exportName) {
        if (moduleUrl === '/js/probe.js' && exportName === 'Probe') return Probe
        if (moduleUrl === '/js/replacement.js' && exportName === 'Replacement') return Replacement
        throw new Error(`Unexpected module: ${moduleUrl}#${exportName}`)
      },
      async resolveFrame(src: string) {
        if (src === '/without-frame') return await renderDocument(false)
        if (src === '/frame') return '<p id="frame-content">Frame content</p>'
        throw new Error(`Unexpected frame src: ${src}`)
      },
    })

    await app.ready()

    invariant(readNamedFrame)
    expect(readNamedFrame()).toBeDefined()

    let topFrame = app.frames.top
    topFrame.src = '/without-frame'
    await topFrame.reload()

    expect(document.getElementById('replacement')?.textContent).toBe('Replacement')
    expect(readNamedFrame()).toBeUndefined()

    app.dispose()
  })

  it('hydrates ready modules before slower modules while ready() stays pending', async () => {
    let [fastHydrated, markFastHydrated] = withResolvers<void>()
    let Fast = clientEntry('/js/fast.js#Fast', function Fast(handle: Handle) {
      let clicked = false
      handle.queueTask(() => markFastHydrated())
      return () => (
        <button
          id="fast"
          mix={[
            on('click', () => {
              clicked = true
              handle.update()
            }),
          ]}
        >
          {clicked ? 'Fast!' : 'Fast'}
        </button>
      )
    })

    let Slow = clientEntry('/js/slow.js#Slow', function Slow(handle: Handle) {
      let clicked = false
      return () => (
        <button
          id="slow"
          mix={[
            on('click', () => {
              clicked = true
              handle.update()
            }),
          ]}
        >
          {clicked ? 'Slow!' : 'Slow'}
        </button>
      )
    })

    let html = await drain(
      renderToStream(
        <div>
          <Fast />
          <Slow />
        </div>,
      ),
    )
    document.body.innerHTML = html

    let [slowModulePromise, resolveSlowModule] = withResolvers<Function>()
    let loadModule = mock.fn((moduleUrl: string, exportName: string) => {
      if (moduleUrl === '/js/fast.js' && exportName === 'Fast') return Fast
      if (moduleUrl === '/js/slow.js' && exportName === 'Slow') return slowModulePromise
      throw new Error(`Unexpected module request: ${moduleUrl}#${exportName}`)
    })

    let app = run({ loadModule })

    let readySettled = false
    let readyPromise = app.ready().then(() => {
      readySettled = true
    })

    await fastHydrated

    let fastButton = document.getElementById('fast')
    let slowButton = document.getElementById('slow')
    invariant(fastButton instanceof HTMLButtonElement)
    invariant(slowButton instanceof HTMLButtonElement)

    fastButton.click()
    app.flush()
    expect(fastButton.textContent).toBe('Fast!')

    slowButton.click()
    app.flush()
    expect(slowButton.textContent).toBe('Slow')

    expect(readySettled).toBe(false)

    resolveSlowModule(Slow)
    await readyPromise

    slowButton.click()
    app.flush()
    expect(slowButton.textContent).toBe('Slow!')

    app.dispose()
  })

  it('shows updated SSR when reloading an entry whose initial module is still loading', async () => {
    let reloadPromise: Promise<AbortSignal> | undefined
    let markFastHydrated: (() => void) | undefined
    let Fast = clientEntry('/js/partial-fast.js#Fast', function Fast(handle: Handle) {
      markFastHydrated?.()
      markFastHydrated = undefined
      return () => (
        <button
          id="partial-fast"
          type="button"
          mix={on('click', () => {
            reloadPromise = handle.frame.reload()
          })}
        >
          Reload
        </button>
      )
    })

    let Slow = clientEntry(
      '/js/partial-slow.js#Slow',
      function Slow(handle: Handle<{ label: string }>) {
        return () => <p id="partial-slow">{handle.props.label}</p>
      },
    )

    async function renderDocument(label: string) {
      return await renderDocumentContent(
        <>
          <Fast />
          <Slow label={label} />
        </>,
      )
    }

    let initialDocument = new DOMParser().parseFromString(
      await renderDocument('Initial'),
      'text/html',
    )
    document.documentElement.innerHTML = initialDocument.documentElement.innerHTML

    let [fastHydrated, resolveFastHydrated] = withResolvers<void>()
    markFastHydrated = resolveFastHydrated
    let [slowModulePromise, resolveSlowModule] = withResolvers<Function>()
    let slowLoadCount = 0
    let app = run({
      loadModule(moduleUrl, exportName) {
        if (moduleUrl === '/js/partial-fast.js' && exportName === 'Fast') return Fast
        if (moduleUrl === '/js/partial-slow.js' && exportName === 'Slow') {
          slowLoadCount++
          return slowModulePromise
        }
        throw new Error(`Unexpected module: ${moduleUrl}#${exportName}`)
      },
      async resolveFrame(src) {
        if (src === '/reloaded') return await renderDocument('Reloaded')
        throw new Error(`Unexpected frame src: ${src}`)
      },
    })

    try {
      await fastHydrated

      let fastButton = document.getElementById('partial-fast')
      invariant(fastButton instanceof HTMLButtonElement)
      let initialSlow = document.getElementById('partial-slow')
      invariant(initialSlow instanceof HTMLParagraphElement)

      app.frames.top.src = '/reloaded'
      let reloadedSlowReady = waitForElement(
        '#partial-slow',
        (element) => element !== initialSlow && element.textContent === 'Reloaded',
      )
      fastButton.click()
      invariant(reloadPromise)
      let reloadSettled = false
      void reloadPromise.then(() => {
        reloadSettled = true
      })
      await reloadedSlowReady

      let reloadedSlow = document.getElementById('partial-slow')
      invariant(reloadedSlow instanceof HTMLParagraphElement)
      expect(reloadedSlow).not.toBe(initialSlow)
      expect(reloadedSlow.textContent).toBe('Reloaded')
      expect(slowLoadCount).toBe(1)
      expect(reloadSettled).toBe(false)

      resolveSlowModule(Slow)
      await Promise.all([reloadPromise, app.ready()])
      expect(document.getElementById('partial-slow')?.textContent).toBe('Reloaded')
    } finally {
      app.dispose()
    }
  })

  it('shows updated SSR when reloading a named frame entry whose module is still loading', async () => {
    let entrySetupCount = 0
    let Slow = clientEntry(
      '/js/named-partial-slow.js#Slow',
      function Slow(handle: Handle<{ label: string }>) {
        entrySetupCount++
        return () => <p id="named-partial-slow">{handle.props.label}</p>
      },
    )

    async function renderEntry(label: string) {
      return await drain(renderToStream(<Slow label={label} />))
    }

    let initialHtml = await drain(
      renderToStream(<Frame name="partial-target" src="/initial" />, {
        resolveFrame: () => renderEntry('Initial'),
      }),
    )
    document.body.innerHTML = initialHtml

    let [slowModulePromise, resolveSlowModule] = withResolvers<Function>()
    let [moduleRequested, markModuleRequested] = withResolvers<void>()
    let slowLoadCount = 0
    let app = run({
      loadModule(moduleUrl, exportName) {
        if (moduleUrl === '/js/named-partial-slow.js' && exportName === 'Slow') {
          slowLoadCount++
          markModuleRequested()
          return slowModulePromise
        }
        throw new Error(`Unexpected module: ${moduleUrl}#${exportName}`)
      },
      async resolveFrame(src, options) {
        expect(options?.target).toBe('partial-target')
        if (src === '/reloaded') return await renderEntry('Reloaded')
        throw new Error(`Unexpected frame src: ${src}`)
      },
    })

    try {
      await moduleRequested

      let initialSlow = document.getElementById('named-partial-slow')
      invariant(initialSlow instanceof HTMLParagraphElement)
      let targetFrame = app.frames.get('partial-target')
      invariant(targetFrame)

      targetFrame.src = '/reloaded'
      let reloadedSlowReady = waitForElement(
        '#named-partial-slow',
        (element) => element !== initialSlow && element.textContent === 'Reloaded',
      )
      let reloadSettled = false
      let reloadPromise = targetFrame.reload().then(() => {
        reloadSettled = true
      })
      await reloadedSlowReady

      let reloadedSlow = document.getElementById('named-partial-slow')
      invariant(reloadedSlow instanceof HTMLParagraphElement)
      expect(reloadedSlow).not.toBe(initialSlow)
      expect(reloadedSlow.textContent).toBe('Reloaded')
      expect(slowLoadCount).toBe(1)
      expect(reloadSettled).toBe(false)

      let setupCountBeforeHydration = entrySetupCount
      resolveSlowModule(Slow)
      await reloadPromise

      expect(document.getElementById('named-partial-slow')?.textContent).toBe('Reloaded')
      expect(entrySetupCount).toBe(setupCountBeforeHydration + 1)
    } finally {
      app.dispose()
    }
  })

  it('handles complex props', async () => {
    let Card = clientEntry(
      '/js/card.js#Card',
      function Card(
        handle: Handle<{ title: string; count: number; enabled: boolean; items: string[] }>,
      ) {
        return () => (
          <div>
            <h2>{handle.props.title}</h2>
            <p>Count: {handle.props.count}</p>
            <p>Enabled: {String(handle.props.enabled)}</p>
            <ul>
              {handle.props.items.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
        )
      },
    )

    let stream = renderToStream(
      <Card title="Test" count={42} enabled={true} items={['one', 'two', 'three']} />,
    )
    let html = await drain(stream)

    document.body.innerHTML = html

    let loadModule = mock.fn(() => Promise.resolve(Card))

    let frame = run({ loadModule })
    await frame.ready()

    expect(loadModule).toHaveBeenCalledWith('/js/card.js', 'Card')
    expect(document.querySelector('h2')?.textContent).toBe('Test')
    expect(document.querySelector('p')?.textContent).toBe('Count: 42')
    expect(document.querySelectorAll('li')).toHaveLength(3)

    frame.dispose()
  })

  it('renders fragment props after hydration', async (t) => {
    let Disclosure = clientEntry(
      '/js/disclosure.js#Disclosure',
      function Disclosure(handle: Handle<{ content: RemixNode }>) {
        let open = true
        return () => (
          <div>
            <button
              mix={on('click', () => {
                open = !open
                handle.update()
              })}
            >
              Toggle
            </button>
            <section>{open ? handle.props.content : null}</section>
          </div>
        )
      },
    )

    document.body.innerHTML = await drain(
      renderToStream(
        <Disclosure
          content={
            <>
              <b>Bold</b>
              <i>Italic</i>
            </>
          }
        />,
      ),
    )
    expect(document.querySelector('section')?.innerHTML).toBe('<b>Bold</b><i>Italic</i>')

    let app = run({ loadModule: () => Disclosure })
    t.after(() => app.dispose())
    await app.ready()
    let button = document.querySelector('button')
    invariant(button)

    button.click()
    app.flush()
    expect(document.querySelector('section')?.innerHTML).toBe('')

    button.click()
    app.flush()
    expect(document.querySelector('section')?.innerHTML).toBe('<b>Bold</b><i>Italic</i>')
  })

  it('preserves element keys in props after hydration', async (t) => {
    let ReversibleList = clientEntry(
      '/js/reversible-list.js#ReversibleList',
      function ReversibleList(handle: Handle<{ items: RemixNode[] }>) {
        let reversed = false
        return () => (
          <div>
            <button
              mix={on('click', () => {
                reversed = !reversed
                handle.update()
              })}
            >
              Reverse
            </button>
            <ul>{reversed ? [...handle.props.items].reverse() : handle.props.items}</ul>
          </div>
        )
      },
    )

    document.body.innerHTML = await drain(
      renderToStream(<ReversibleList items={[<li key="a">A</li>, <li key="b">B</li>]} />),
    )

    let app = run({ loadModule: () => ReversibleList })
    t.after(() => app.dispose())
    await app.ready()
    let [a, b] = Array.from(document.querySelectorAll('li'))
    invariant(a && b)

    document.querySelector('button')?.click()
    app.flush()

    let [first, second] = Array.from(document.querySelectorAll('li'))
    expect(first).toBe(b)
    expect(second).toBe(a)
    expect([a.textContent, b.textContent]).toEqual(['A', 'B'])
  })

  it('preserves keyed fragment props after hydration', async (t) => {
    let ReversibleTerms = clientEntry(
      '/js/reversible-terms.js#ReversibleTerms',
      function ReversibleTerms(handle: Handle<{ terms: RemixNode[] }>) {
        let reversed = false
        return () => (
          <div>
            <button
              mix={on('click', () => {
                reversed = !reversed
                handle.update()
              })}
            >
              Reverse
            </button>
            <dl>{reversed ? [...handle.props.terms].reverse() : handle.props.terms}</dl>
          </div>
        )
      },
    )

    document.body.innerHTML = await drain(
      renderToStream(
        <ReversibleTerms
          terms={[
            <Fragment key="a">
              <dt>A</dt>
              <dd>First</dd>
            </Fragment>,
            <Fragment key="b">
              <dt>B</dt>
              <dd>Second</dd>
            </Fragment>,
          ]}
        />,
      ),
    )

    let app = run({ loadModule: () => ReversibleTerms })
    t.after(() => app.dispose())
    await app.ready()
    let [dtA, ddA, dtB, ddB] = Array.from(document.querySelectorAll('dl > *'))
    invariant(dtA && ddA && dtB && ddB)

    document.querySelector('button')?.click()
    app.flush()

    let [first, second, third, fourth] = Array.from(document.querySelectorAll('dl > *'))
    expect(first).toBe(dtB)
    expect(second).toBe(ddB)
    expect(third).toBe(dtA)
    expect(fourth).toBe(ddA)
    expect(document.querySelector('dl')?.textContent).toBe('BSecondAFirst')
  })

  it('preserves plain data containing every hydration descriptor tag', async (t) => {
    let props = {
      element: { $rmx: true, type: 'div', props: { innerHTML: '<b>Data</b>' }, key: 'data' },
      values: [
        { $rmx: false },
        { $rmx: null },
        { $rmx: 'unknown', type: 'article', props: { children: 'Data' } },
        { $rmxFrame: true, props: { src: '/data' }, key: 'frame' },
        { $rmxFragment: true, props: { children: 'Data' }, key: 'fragment' },
        { $rmxMixin: 'css', args: [{ color: 'red' }] },
        { $rmxMixin: null },
        { $rmxMixin: 'unknown', args: [1] },
        { $rmxFrame: false, $rmxFragment: 'unknown' },
        { $rmx: true, $rmxFrame: true, $rmxFragment: true, $rmxMixin: 'css' },
      ],
      ordinary: { type: 'span', props: { innerHTML: 'Data' }, args: [], key: { id: 1 } },
    }

    expect(await hydrateDataProps(t, props)).toEqual(props)
  })

  it('preserves descriptor tags on the top-level client entry props', async (t) => {
    let cases = [
      { $rmx: true, type: 'div', props: { innerHTML: '<b>Data</b>' } },
      { $rmx: 0 },
      { $rmxFrame: true, props: { src: '/data' } },
      { $rmxFragment: true, props: { children: 'Data' } },
      { $rmxMixin: 'css', args: [{ color: 'red' }] },
      { $rmxMixin: null },
      { $rmxObject: { $rmxMixin: 'css', args: [] } },
    ]

    for (let props of cases) {
      expect(await hydrateDataProps(t, props)).toEqual(props)
    }
  })

  it('preserves plain data shaped exactly like nested escape wrappers', async (t) => {
    let props = {
      $rmxObject: { $rmx: true, type: 'div', props: {} },
      nested: [
        { $rmxObject: { $rmxObject: { $rmxMixin: null } } },
        {
          $rmxObject: [
            ['$rmxMixin', 'css'],
            ['args', []],
          ],
        },
        { $rmxObject: null },
        { $rmxObject: true, $rmxFrame: true, props: { src: '/data' } },
      ],
    }

    expect(await hydrateDataProps(t, props)).toEqual(props)
  })

  it('preserves JSON omission and toJSON behavior in escaped data', async (t) => {
    let calls: string[] = []
    let props = {
      $rmx: undefined,
      data: {
        $rmxMixin: 'css',
        missing: undefined,
        callback() {},
        symbol: Symbol('data'),
        omitted: { toJSON() {} },
        omittedFunction: { toJSON: () => function ignored() {} },
        omittedSymbol: { toJSON: () => Symbol('ignored') },
        array: [undefined, () => {}, Symbol('data'), { toJSON() {} }],
        date: new Date('2026-01-01T00:00:00.000Z'),
        value: {
          $rmx: 'data',
          toJSON(key: string) {
            calls.push(key)
            return this
          },
        },
        converted: { toJSON: () => ({ $rmxFragment: true, props: {} }) },
      },
    }
    let expected = JSON.parse(JSON.stringify(props))
    calls = []

    expect(await hydrateDataProps(t, props)).toEqual(expected)
    expect(calls).toEqual(['value'])
  })

  it('preserves own __proto__ properties without changing data prototypes', async (t) => {
    let props = {
      $rmxFragment: true,
      ['__proto__']: { label: 'top' },
      ordinary: { ['__proto__']: { label: 'ordinary' } },
      escaped: { $rmxMixin: null, ['__proto__']: { $rmx: 'data' } },
    }
    let received = await hydrateDataProps(t, props)

    expect(received).toEqual(props)
    for (let value of [received, received.ordinary, received.escaped]) {
      expect(Object.hasOwn(value, '__proto__')).toBe(true)
      expect(Object.getPrototypeOf(value)).toBe(Object.prototype)
    }
  })

  it('serializes repeated escaped objects separately after each toJSON call', async (t) => {
    let value = {
      $rmxMixin: 'data',
      calls: 0,
      toJSON() {
        this.calls++
        return this
      },
    }

    expect(await hydrateDataProps(t, { values: [value, value] })).toEqual({
      values: [
        { $rmxMixin: 'data', calls: 1 },
        { $rmxMixin: 'data', calls: 2 },
      ],
    })
  })

  it('hydrates real elements alongside escaped data and preserves element copies', async (t) => {
    let data = { $rmx: true, type: 'div', props: { innerHTML: '<b>Data</b>' } }
    let received: unknown
    let Entry = clientEntry(
      '/mixed.js#Entry',
      function Entry(
        handle: Handle<{ bundle: { $rmxFrame: true; data: typeof data; content: RemixNode } }>,
      ) {
        received = handle.props.bundle.data
        let visible = false
        return () => (
          <section>
            <button
              mix={on('click', () => {
                visible = true
                handle.update()
              })}
            >
              Show
            </button>
            {visible ? handle.props.bundle.content : null}
          </section>
        )
      },
    )
    let element = <p mix={css({ color: 'rgb(1, 2, 3)' })}>Styled</p>
    let content = (
      <Fragment key="content">
        {{ ...element }}
        <Frame src="/real-frame" />
      </Fragment>
    )
    document.body.innerHTML = await drain(
      renderToStream(<Entry bundle={{ $rmxFrame: true, data, content }} />),
    )
    received = undefined
    let requests: string[] = []
    let errors: unknown[] = []
    let app = run({
      loadModule: () => Entry,
      resolveFrame(src) {
        requests.push(src)
        return '<i>Frame content</i>'
      },
    })
    app.addEventListener('error', (event) => errors.push(event.error))
    t.after(() => app.dispose())
    await app.ready()
    expect(received).toEqual(data)

    document.querySelector('button')?.click()
    app.flush()
    await waitForElement('i', (element) => element.textContent === 'Frame content')

    let paragraph = document.querySelector('p')
    invariant(paragraph)
    expect(paragraph.textContent).toBe('Styled')
    expect(getComputedStyle(paragraph).color).toBe('rgb(1, 2, 3)')
    expect(document.querySelector('i')?.textContent).toBe('Frame content')
    expect(requests).toEqual(['/real-frame'])
    expect(errors).toEqual([])
  })

  it('hydrates css() mixins in element props', async (t) => {
    let Tabs = clientEntry(
      '/js/tabs.js#Tabs',
      function Tabs(handle: Handle<{ panels: RemixNode[] }>) {
        let selected = 0
        return () => (
          <div>
            <button
              mix={on('click', () => {
                selected = (selected + 1) % handle.props.panels.length
                handle.update()
              })}
            >
              Next
            </button>
            <section>{handle.props.panels[selected]}</section>
          </div>
        )
      },
    )

    document.body.innerHTML = await drain(
      renderToStream(
        <Tabs
          panels={[
            <p mix={css({ color: 'rgb(1, 2, 3)' })}>One</p>,
            <article mix={[css({ color: 'rgb(4, 5, 6)' }), css({ paddingTop: 7 })]}>
              <span mix={css({ fontWeight: 700 })}>Two</span>
            </article>,
          ]}
        />,
      ),
    )
    let serverPanel = document.querySelector('p')
    invariant(serverPanel)

    let errors: unknown[] = []
    let app = run({ loadModule: () => Tabs })
    app.addEventListener('error', (event) => errors.push(event.error))
    t.after(() => app.dispose())
    await app.ready()

    expect(errors).toEqual([])
    expect(document.querySelector('p')).toBe(serverPanel)
    expect(getComputedStyle(serverPanel).color).toBe('rgb(1, 2, 3)')

    document.querySelector('button')?.click()
    app.flush()

    let article = document.querySelector('article')
    let span = document.querySelector('article > span')
    invariant(article && span)
    expect(getComputedStyle(article).color).toBe('rgb(4, 5, 6)')
    expect(getComputedStyle(article).paddingTop).toBe('7px')
    expect(getComputedStyle(span).fontWeight).toBe('700')
  })

  it('preserves css() precedence when entry props contain undefined styles', async (t) => {
    let Slot = clientEntry(
      '/js/slot.js#Slot',
      function Slot(handle: Handle<{ content: RemixNode }>) {
        return () => <div>{handle.props.content}</div>
      },
    )

    document.body.innerHTML = await drain(
      renderToStream(
        <Slot
          content={
            <p mix={[css({ color: 'red', '&:hover': undefined }), css({ color: 'blue' })]}>
              Styled
            </p>
          }
        />,
      ),
    )
    let paragraph = document.querySelector('p')
    invariant(paragraph)
    let serverClassName = paragraph.className
    expect(getComputedStyle(paragraph).color).toBe('rgb(0, 0, 255)')

    let app = run({ loadModule: () => Slot })
    t.after(() => app.dispose())
    await app.ready()

    expect(document.querySelector('p')).toBe(paragraph)
    expect(getComputedStyle(paragraph).color).toBe('rgb(0, 0, 255)')
    expect(paragraph.className).toBe(serverClassName)
  })

  it('reports a clear error for mixins in element props that cannot be serialized', async (t) => {
    let Slot = clientEntry(
      '/js/slot.js#Slot',
      function Slot(handle: Handle<{ content: RemixNode }>) {
        return () => <div>{handle.props.content}</div>
      },
    )

    document.body.innerHTML = await drain(
      renderToStream(<Slot content={<button mix={on('click', () => {})}>Save</button>} />),
    )

    let errors: unknown[] = []
    let app = run({ loadModule: () => Slot })
    app.addEventListener('error', (event) => errors.push(event.error))
    t.after(() => app.dispose())
    await app.ready()

    expect(errors).toHaveLength(1)
    expect(errors[0]).toBeInstanceOf(Error)
    expect(String(errors[0])).toMatch(
      /Client entry props contain a mixin that can't be serialized\. Only css\(\) mixins/,
    )
  })

  it('ready() does not wait for hydration markers from later frame templates', async () => {
    let Initial = clientEntry('/js/initial.js#Initial', function Initial(handle: Handle) {
      let clicked = false
      return () => (
        <button
          id="initial"
          mix={[
            on('click', () => {
              clicked = true
              handle.update()
            }),
          ]}
        >
          {clicked ? 'Initial!' : 'Initial'}
        </button>
      )
    })

    let [lateHydrated, markLateHydrated] = withResolvers<void>()
    let Late = clientEntry('/js/late.js#Late', function Late(handle: Handle) {
      let clicked = false
      handle.queueTask(() => markLateHydrated())
      return () => (
        <button
          id="late"
          mix={[
            on('click', () => {
              clicked = true
              handle.update()
            }),
          ]}
        >
          {clicked ? 'Late!' : 'Late'}
        </button>
      )
    })

    let pageStream = renderToStream(
      <div>
        <Initial />
        <Frame src="/late-frame" fallback={<span id="frame-fallback">Loading…</span>} />
      </div>,
      { resolveFrame: () => new Promise<string>(() => {}) },
    )
    let pageChunks = readChunks(pageStream)
    let first = await pageChunks.next()
    invariant(!first.done)
    document.body.innerHTML = first.value

    let frameId = getCommentMarkerId(first.value, 'rmx:f:')
    let [lateModulePromise, resolveLateModule] = withResolvers<Function>()
    let [lateModuleRequested, markLateModuleRequested] = withResolvers<void>()

    let loadModule = mock.fn((moduleUrl: string, exportName: string) => {
      if (moduleUrl === '/js/initial.js' && exportName === 'Initial') return Initial
      if (moduleUrl === '/js/late.js' && exportName === 'Late') {
        markLateModuleRequested()
        return lateModulePromise
      }
      throw new Error(`Unexpected module request: ${moduleUrl}#${exportName}`)
    })

    let app = run({ loadModule })
    await app.ready()

    // Only initial adopted-document markers block ready().
    expect(loadModule).toHaveBeenCalledTimes(1)

    let template = document.createElement('template')
    template.id = frameId
    template.innerHTML = await drain(renderToStream(<Late />))
    document.body.appendChild(template)

    await lateModuleRequested

    // Late template markers hydrate after ready() and are not part of initial barrier.
    expect(loadModule).toHaveBeenCalledTimes(2)

    let lateButton = document.getElementById('late')
    invariant(lateButton instanceof HTMLButtonElement)
    lateButton.click()
    app.flush()
    expect(lateButton.textContent).toBe('Late')

    resolveLateModule(Late)
    await lateHydrated

    lateButton.click()
    app.flush()
    expect(lateButton.textContent).toBe('Late!')

    app.dispose()
  })

  it('does nothing when no rmx-data script exists', async () => {
    document.body.innerHTML = '<div>No hydration here</div>'

    let loadModule = mock.fn()

    let frame = run({ loadModule })
    await frame.ready()

    expect(loadModule).not.toHaveBeenCalled()

    frame.dispose()
  })

  it('does nothing when rmx-data has no hydration data', async () => {
    document.body.innerHTML = `
      <div>Static content</div>
      <script type="application/json" id="rmx-data">{}</script>
    `

    let loadModule = mock.fn()

    let frame = run({ loadModule })
    await frame.ready()

    expect(loadModule).not.toHaveBeenCalled()

    frame.dispose()
  })

  it('adopts existing DOM nodes during hydration', async () => {
    let Counter = clientEntry('/js/counter.js#Counter', function Counter() {
      return () => (
        <div>
          <span>Static text</span>
        </div>
      )
    })

    let stream = renderToStream(<Counter />)
    let html = await drain(stream)

    document.body.innerHTML = html

    let existingSpan = document.querySelector('span')
    expect(existingSpan).toBeTruthy()

    let loadModule = mock.fn(() => Promise.resolve(Counter))

    let frame = run({ loadModule })
    await frame.ready()

    let spanAfterHydration = document.querySelector('span')
    expect(spanAfterHydration).toBe(existingSpan)

    frame.dispose()
  })

  it('replaces pending frame regions when streamed templates arrive', async () => {
    let stream = renderToStream(
      <div>
        <h1>Title</h1>
        <Frame src="/x" fallback={<nav>Loading...</nav>} />
        <p>Main</p>
      </div>,
      { resolveFrame: () => '<nav>Loaded</nav>' },
    )

    let chunks = readChunks(stream)
    let first = await chunks.next()
    invariant(!first.done)
    document.body.innerHTML = first.value

    let h1 = document.querySelector('h1')
    let p = document.querySelector('p')
    let nav = document.querySelector('nav')
    invariant(h1 && p && nav)
    expect(nav.textContent).toBe('Loading...')

    let frame = run({ loadModule: mock.fn() })
    await frame.ready()

    let second = await chunks.next()
    invariant(!second.done)
    document.body.insertAdjacentHTML('beforeend', second.value)

    await waitForText('nav', 'Loaded')

    expect(document.querySelector('h1')).toBe(h1)
    expect(document.querySelector('p')).toBe(p)
    expect(document.querySelector('nav')).toBe(nav)
    expect(nav.textContent).toBe('Loaded')

    frame.dispose()
  })

  it('renders every sibling when an observed frame template is parsed in two parts', async (t) => {
    await renderSplitFrameTemplate(t, 'observer')

    expect(
      Array.from(document.querySelectorAll('[data-item]'), (node) => node.textContent),
    ).toEqual(['First', 'Second'])
    expect(document.querySelector('#fallback')).toBe(null)
  })

  it('renders every sibling when hydration starts during frame template parsing', async (t) => {
    await renderSplitFrameTemplate(t, 'hydrate')

    expect(
      Array.from(document.querySelectorAll('[data-item]'), (node) => node.textContent),
    ).toEqual(['First', 'Second'])
    expect(document.querySelector('#fallback')).toBe(null)
  })

  it('waits for document parsing to finish when a frame template has no end marker', async (t) => {
    let chunks = readChunks(
      renderToStream(
        <html>
          <head />
          <body>
            <Frame src="/items" fallback={<p id="fallback">Loading...</p>} />
          </body>
        </html>,
        { resolveFrame: () => '<p id="loaded">Loaded</p>' },
      ),
    )
    let shell = await chunks.next()
    let template = await chunks.next()
    invariant(!shell.done && !template.done)

    document.open()
    document.write(shell.value)
    let app = run({ loadModule: mock.fn() })
    t.after(() => {
      app.dispose()
      document.close()
    })
    await app.ready()

    let observed = nextDomMutation()
    document.write(template.value.replace(`<!--${FRAME_TEMPLATE_END_MARKER}-->`, ''))
    document.write('<div>Following sibling</div>')
    await observed

    expect(document.readyState).toBe('loading')
    expect(document.querySelector('template')).not.toBe(null)
    expect(document.querySelector('#fallback')?.textContent).toBe('Loading...')
    expect(document.querySelector('#loaded')).toBe(null)

    document.close()
    await waitForElement('#loaded')

    expect(document.readyState).not.toBe('loading')
    expect(document.querySelector('#loaded')?.textContent).toBe('Loaded')
    expect(document.querySelector('#fallback')).toBe(null)
  })

  it('preserves every streamed frame item when a script appends a sibling mid-template', async (t) => {
    await renderSplitFrameTemplate(t, 'observer', async () => {
      let observed = nextDomMutation()
      document.body.append(document.createElement('div'))
      await observed
    })
    // The runtime's DOMContentLoaded listener was added first, so it has run when this one does.
    let loaded = new Promise((resolve) => {
      document.addEventListener('DOMContentLoaded', resolve, { once: true })
    })
    document.close()
    await loaded

    expect(
      Array.from(document.querySelectorAll('[data-item]'), (node) => node.textContent),
    ).toEqual(['First', 'Second'])
    expect(document.querySelector('#fallback')).toBe(null)
  })

  it('preserves pre-existing application templates while waiting for a streamed frame', async (t) => {
    let chunks = readChunks(
      renderToStream(
        <div>
          <template id="row-template">
            <p>Application row</p>
          </template>
          <Frame src="/items" fallback={<p id="fallback">Loading...</p>} />
        </div>,
        { resolveFrame: () => '<p id="loaded">Loaded</p>' },
      ),
    )
    let shell = await chunks.next()
    invariant(!shell.done)
    document.body.innerHTML = shell.value
    let rowTemplate = document.querySelector('#row-template')
    invariant(rowTemplate instanceof HTMLTemplateElement)

    let app = run({ loadModule: mock.fn() })
    t.after(() => app.dispose())
    await app.ready()
    expect(document.querySelector('#fallback')?.textContent).toBe('Loading...')

    let template = await chunks.next()
    invariant(!template.done)
    document.body.insertAdjacentHTML('beforeend', template.value)
    await waitForElement('#loaded')

    expect(document.querySelector('#loaded')?.textContent).toBe('Loaded')
    expect(document.querySelector('#row-template')).toBe(rowTemplate)
    expect(rowTemplate.content.querySelector('p')?.textContent).toBe('Application row')
  })

  it('merges hydration data across multiple rmx-data scripts', async () => {
    function A(handle: Handle) {
      let clicked = false
      return () => (
        <button
          id="a"
          mix={[
            on('click', () => {
              clicked = true
              handle.update()
            }),
          ]}
        >
          {clicked ? 'A!' : 'A'}
        </button>
      )
    }

    function B(handle: Handle) {
      let clicked = false
      return () => (
        <button
          id="b"
          mix={[
            on('click', () => {
              clicked = true
              handle.update()
            }),
          ]}
        >
          {clicked ? 'B!' : 'B'}
        </button>
      )
    }

    document.body.innerHTML = `
      <!-- rmx:h:h1 --><button id="a">A</button><!-- /rmx:h -->
      <!-- rmx:h:h2 --><button id="b">B</button><!-- /rmx:h -->
      <script type="application/json" id="rmx-data">
        {"h":{"h1":{"moduleUrl":"/a.js","exportName":"A","props":{}}}}
      </script>
      <script type="application/json" id="rmx-data">
        {"h":{"h2":{"moduleUrl":"/b.js","exportName":"B","props":{}}}}
      </script>
    `

    let loadModule = mock.fn((moduleUrl: string, exportName: string) => {
      if (moduleUrl === '/a.js' && exportName === 'A') return A
      if (moduleUrl === '/b.js' && exportName === 'B') return B
      throw new Error(`Unexpected module request: ${moduleUrl}#${exportName}`)
    })

    let frame = run({ loadModule })
    await frame.ready()

    expect(loadModule).toHaveBeenCalledTimes(2)

    let a = document.getElementById('a')
    let b = document.getElementById('b')
    invariant(a instanceof HTMLButtonElement)
    invariant(b instanceof HTMLButtonElement)

    expect(a.textContent).toBe('A')
    expect(b.textContent).toBe('B')

    a.click()
    b.click()
    frame.flush()

    expect(a.textContent).toBe('A!')
    expect(b.textContent).toBe('B!')

    frame.dispose()
  })

  it('ignores prototype-polluting keys when merging rmx-data scripts', async () => {
    function A() {
      return () => <button id="a">A</button>
    }

    document.body.innerHTML = `
      <!-- rmx:h:h1 --><button id="a">A</button><!-- /rmx:h -->
      <!-- rmx:h:h2 --><button id="b">B</button><!-- /rmx:h -->
      <script type="application/json" id="rmx-data">
        {"h":{"__proto__":{"h2":{"moduleUrl":"/evil.js","exportName":"Evil","props":{}}}}}
      </script>
      <script type="application/json" id="rmx-data">
        {"h":{"h1":{"moduleUrl":"/a.js","exportName":"A","props":{}}}}
      </script>
    `

    let loadModule = mock.fn((moduleUrl: string, exportName: string) => {
      if (moduleUrl === '/a.js' && exportName === 'A') return A
      throw new Error(`Unexpected module request: ${moduleUrl}#${exportName}`)
    })

    let frame = run({ loadModule })
    await frame.ready()

    expect(loadModule).toHaveBeenCalledTimes(1)
    expect(loadModule).toHaveBeenCalledWith('/a.js', 'A')

    frame.dispose()
  })

  it('reloads a frame region and preserves static DOM nodes', async () => {
    let renderCount = 0

    let reload: undefined | (() => Promise<AbortSignal>)

    let ReloadButton = clientEntry('/assets/reload.js#Reload', function Reload(handle: Handle) {
      reload = () => handle.frame.reload()
      return () => <button>Reload</button>
    })

    async function renderTimeFragment() {
      renderCount++
      let stream = renderToStream(
        <section>
          <h2>Activity</h2>
          <p>Server: {renderCount}</p>
          <ul>
            <li>First</li>
            <li>Second</li>
          </ul>
          <ReloadButton />
        </section>,
        {
          onError(error) {
            console.error(error)
          },
        },
      )
      return await drain(stream)
    }

    let stream = renderToStream(
      <main>
        <Frame src="/time" fallback={<div>Loading…</div>} />
      </main>,
      { resolveFrame: renderTimeFragment },
    )

    let html = await drain(stream)
    document.body.innerHTML = html

    // Ensure template exists so the pending frame can render immediately.
    let frameId = getCommentMarkerId(html, 'rmx:f:')
    expect(document.querySelector(`template#${frameId}`)).toBeTruthy()

    let clientFrame = run({
      loadModule(moduleUrl, exportName) {
        if (moduleUrl === '/assets/reload.js' && exportName === 'Reload') return ReloadButton
        throw new Error(`Unexpected module: ${moduleUrl}#${exportName}`)
      },
      resolveFrame: renderTimeFragment,
    })

    await clientFrame.ready()

    expect(document.querySelector('p')?.textContent).toBe('Server: 1')
    invariant(reload)

    // Capture references to every element before reload.
    let section = document.querySelector('section')
    let heading = document.querySelector('h2')
    let paragraph = document.querySelector('p')
    let list = document.querySelector('ul')
    let items = document.querySelectorAll('li')
    let button = document.querySelector('button')
    invariant(section && heading && paragraph && list && button)
    invariant(items.length === 2)

    await reload()

    // Dynamic text updated.
    expect(document.querySelector('p')?.textContent).toBe('Server: 2')

    // Static elements are the exact same DOM nodes — not replaced.
    expect(document.querySelector('section')).toBe(section)
    expect(document.querySelector('h2')).toBe(heading)
    expect(document.querySelector('p')).toBe(paragraph)
    expect(document.querySelector('ul')).toBe(list)
    expect(document.querySelectorAll('li')[0]).toBe(items[0])
    expect(document.querySelectorAll('li')[1]).toBe(items[1])
    expect(document.querySelector('button')).toBe(button)

    // Static text preserved.
    expect(heading.textContent).toBe('Activity')
    expect(items[0].textContent).toBe('First')
    expect(items[1].textContent).toBe('Second')

    clientFrame.dispose()
  })

  it('clears frame content when reload resolves to an empty stream', async () => {
    let reload: undefined | (() => Promise<AbortSignal>)

    let ReloadButton = clientEntry(
      '/assets/reload-empty.js#ReloadEmpty',
      function ReloadEmpty(handle: Handle) {
        reload = () => handle.frame.reload()
        return () => <button id="reload-empty">Reload empty</button>
      },
    )

    async function renderInitial(): Promise<string> {
      return await drain(
        renderToStream(
          <section id="frame-content">
            <p id="frame-value">Initial content</p>
            <ReloadButton />
          </section>,
        ),
      )
    }

    let html = await drain(
      renderToStream(
        <main>
          <Frame src="/reload-empty" fallback={<div>Loading…</div>} />
        </main>,
        { resolveFrame: renderInitial },
      ),
    )
    document.body.innerHTML = html

    let clientFrame = run({
      loadModule(moduleUrl, exportName) {
        if (moduleUrl === '/assets/reload-empty.js' && exportName === 'ReloadEmpty') {
          return ReloadButton
        }
        throw new Error(`Unexpected module: ${moduleUrl}#${exportName}`)
      },
      resolveFrame(src: string) {
        if (src !== '/reload-empty') throw new Error(`Unexpected frame src: ${src}`)
        return new ReadableStream<Uint8Array>({
          start(controller) {
            controller.close()
          },
        })
      },
    })

    await clientFrame.ready()
    expect(document.getElementById('frame-value')?.textContent).toBe('Initial content')

    invariant(reload)
    await reload()

    expect(document.getElementById('frame-content')).toBeNull()
    expect(document.getElementById('frame-value')).toBeNull()

    clientFrame.dispose()
  })

  it('ignores updates from a client entry removed by a frame reload', async () => {
    let pending = false
    let showCartItems = true
    let removeLastItem: undefined | (() => Promise<void>)

    let CartItems = clientEntry(
      '/assets/cart-items.js#CartItems',
      function CartItems(handle: Handle) {
        removeLastItem = async () => {
          pending = true
          await handle.update()
          showCartItems = false
          await handle.frame.reload()
          pending = false
          handle.update()
        }

        return () => (
          <>
            {pending ? <p id="cart-pending">Updating your cart...</p> : null}
            <table id="cart-items">
              <tbody>
                <tr>
                  <td>Book</td>
                  <td>
                    <button>Remove</button>
                  </td>
                </tr>
              </tbody>
            </table>
            <div id="cart-total">Total: $16.99</div>
          </>
        )
      },
    )

    async function renderCartItems(): Promise<string> {
      return await drain(
        renderToStream(showCartItems ? <CartItems /> : <p id="empty-cart">Your cart is empty.</p>),
      )
    }

    let html = await drain(
      renderToStream(
        <main>
          <Frame src="/cart-items" />
        </main>,
        { resolveFrame: renderCartItems },
      ),
    )
    document.body.innerHTML = html

    let errors: unknown[] = []
    let clientFrame = run({
      loadModule(moduleUrl, exportName) {
        if (moduleUrl === '/assets/cart-items.js' && exportName === 'CartItems') {
          return CartItems
        }
        throw new Error(`Unexpected module: ${moduleUrl}#${exportName}`)
      },
      resolveFrame(src: string) {
        if (src === '/cart-items') return renderCartItems()
        throw new Error(`Unexpected frame src: ${src}`)
      },
    })
    clientFrame.addEventListener('error', (event) => {
      errors.push(event.error)
    })

    await clientFrame.ready()

    expect(document.getElementById('cart-items')).toBeInstanceOf(HTMLElement)
    invariant(removeLastItem)

    await removeLastItem()

    expect(document.getElementById('cart-items')).toBeNull()
    expect(document.getElementById('empty-cart')?.textContent).toBe('Your cart is empty.')
    expect(errors).toEqual([])

    clientFrame.dispose()
  })

  it('looks up named adjacent frames from handle.frames.get(name)', async () => {
    let summaryRenderCount = 0
    let reloadSummary: undefined | (() => Promise<void>)

    let RowAction = clientEntry(
      '/assets/row-action.js#RowAction',
      function RowAction(handle: Handle) {
        reloadSummary = async () => {
          expect(handle.frames.get('missing-frame')).toBeUndefined()
          await handle.frames.get('cart-summary')?.reload()
        }
        return () => <button id="row-action">Update</button>
      },
    )

    async function resolveFrame(src: string) {
      if (src === '/summary') {
        summaryRenderCount++
        let stream = renderToStream(<p id="summary">Summary: {summaryRenderCount}</p>)
        return await drain(stream)
      }
      if (src === '/row') {
        let stream = renderToStream(<RowAction />)
        return await drain(stream)
      }
      return '<p>Unexpected frame</p>'
    }

    let stream = renderToStream(
      <main>
        <Frame name="cart-summary" src="/summary" fallback={<div>Loading summary…</div>} />
        <Frame src="/row" fallback={<div>Loading row…</div>} />
      </main>,
      { resolveFrame },
    )

    let html = await drain(stream)
    document.body.innerHTML = html

    let clientFrame = run({
      loadModule(moduleUrl, exportName) {
        if (moduleUrl === '/assets/row-action.js' && exportName === 'RowAction') return RowAction
        throw new Error(`Unexpected module: ${moduleUrl}#${exportName}`)
      },
      resolveFrame,
    })

    await clientFrame.ready()

    expect(document.querySelector('#summary')?.textContent).toBe('Summary: 1')

    invariant(reloadSummary)
    await reloadSummary()

    expect(document.querySelector('#summary')?.textContent).toBe('Summary: 2')

    clientFrame.dispose()
  })

  it('returns undefined when an internal named frame lookup misses', async () => {
    document.body.innerHTML = await drain(renderToStream(<main />))

    let app = run({ loadModule: mock.fn() })

    try {
      await app.ready()
      expect(getNamedFrame('missing-frame')).toBeUndefined()
    } finally {
      app.dispose()
    }
  })

  it('restores the previous named frame when the latest duplicate unmounts', async () => {
    let showLatest = true
    let getDuplicateFrame: undefined | (() => ReturnType<Handle['frames']['get']>)
    let removeLatestFrame: undefined | (() => Promise<AbortSignal>)

    let DuplicateFrames = clientEntry(
      '/assets/duplicate-frames.js#DuplicateFrames',
      function DuplicateFrames(handle: Handle) {
        getDuplicateFrame = () => handle.frames.get('duplicate')
        removeLatestFrame = () => {
          showLatest = false
          return handle.update()
        }

        return () => (
          <>
            <Frame name="duplicate" src="/first" />
            {showLatest ? <Frame name="duplicate" src="/latest" /> : null}
          </>
        )
      },
    )

    let resolveFrame = (src: string) => `<p>${src}</p>`
    let html = await drain(renderToStream(<DuplicateFrames />, { resolveFrame }))
    document.body.innerHTML = html

    let app = run({
      loadModule(moduleUrl, exportName) {
        if (moduleUrl === '/assets/duplicate-frames.js' && exportName === 'DuplicateFrames') {
          return DuplicateFrames
        }
        throw new Error(`Unexpected module: ${moduleUrl}#${exportName}`)
      },
      resolveFrame,
    })

    try {
      await app.ready()
      invariant(getDuplicateFrame)
      invariant(removeLatestFrame)
      expect(getDuplicateFrame()?.src).toBe('/latest')

      await removeLatestFrame()

      expect(getDuplicateFrame()?.src).toBe('/first')
    } finally {
      app.dispose()
    }
  })

  it('exposes the root frame as handle.frames.top', async () => {
    let assertTopFrame: undefined | (() => void)

    let ReloadTop = clientEntry(
      '/assets/reload-top.js#ReloadTop',
      function ReloadTop(handle: Handle) {
        assertTopFrame = () => {
          expect(handle.frames.top).not.toBe(handle.frame)
        }
        return () => <button id="reload-top">Check top frame</button>
      },
    )

    async function renderInner() {
      let stream = renderToStream(<ReloadTop />)
      return await drain(stream)
    }
    document.body.innerHTML = await drain(
      renderToStream(
        <main>
          <Frame src="/inner" />
        </main>,
        {
          resolveFrame(src: string) {
            if (src === '/inner') return renderInner()
            throw new Error(`Unexpected page frame src: ${src}`)
          },
        },
      ),
    )

    let app = run({
      loadModule(moduleUrl, exportName) {
        if (moduleUrl === '/assets/reload-top.js' && exportName === 'ReloadTop') {
          return ReloadTop
        }
        throw new Error(`Unexpected module: ${moduleUrl}#${exportName}`)
      },
      async resolveFrame(src: string) {
        if (src === '/inner') {
          return await renderInner()
        }
        throw new Error(`Unexpected frame src: ${src}`)
      },
    })

    await app.ready()

    invariant(assertTopFrame)
    assertTopFrame()
    app.dispose()
  })

  it('updates and reloads the top frame for ordinary navigation', async (t) => {
    let fixture = await setupFrameNavigationTest(t)
    let destinationUrl = new URL('/next', window.location.href).href

    await navigate(destinationUrl, {
      history: 'replace',
      resetScroll: false,
    })

    expect(window.location.href).toBe(destinationUrl)
    expect(fixture.frames().top.src).toBe(window.location.href)
    expect(fixture.requests).toEqual([{ src: destinationUrl, target: undefined }])
  })

  it('reloads only the target frame using the public destination without data-rmx-src', async (t) => {
    let fixture = await setupFrameNavigationTest(t)
    let destinationUrl = new URL('/destination', window.location.href).href

    await navigateWithLink(destinationUrl, { target: 'target' })

    let frames = fixture.frames()
    expect(window.location.href).toBe(destinationUrl)
    expect(frames.top.src).toBe(window.location.href)
    expect(frames.target.src).toBe(destinationUrl)
    expect(fixture.requests).toEqual([{ src: destinationUrl, target: 'target' }])
  })

  it('preserves a targeted src while later top frame reloads use the public destination', async (t) => {
    let fixture = await setupFrameNavigationTest(t)
    let destinationUrl = new URL('/destination', window.location.href).href
    let targetSrc = '/target-frame'

    await navigateWithLink(destinationUrl, { target: 'target', src: targetSrc })

    let frames = fixture.frames()
    expect(window.location.href).toBe(destinationUrl)
    expect(frames.top.src).toBe(window.location.href)
    expect(frames.target.src).toBe(targetSrc)
    expect(fixture.requests).toEqual([{ src: targetSrc, target: 'target' }])

    await frames.top.reload()
    expect(fixture.requests).toEqual([
      { src: targetSrc, target: 'target' },
      { src: destinationUrl, target: undefined },
    ])
  })

  it('restores top and targeted frame sources during back and forward traversal', async (t) => {
    let fixture = await setupFrameNavigationTest(t)
    let events: FrameReloadStartEvent[] = []
    let target = fixture.frames().target
    invariant(target)
    target.addEventListener('reloadStart', (event) => events.push(event))
    let firstDestinationUrl = new URL('/first', window.location.href).href
    let secondDestinationUrl = new URL('/second', window.location.href).href
    let firstTargetSrc = '/first-frame'
    let secondTargetSrc = '/second-frame'

    await navigate(firstDestinationUrl, {
      target: 'target',
      src: firstTargetSrc,
      resetScroll: false,
    })
    await navigate(secondDestinationUrl, {
      target: 'target',
      src: secondTargetSrc,
      resetScroll: false,
    })
    await window.navigation.back().finished

    let frames = fixture.frames()
    expect(window.location.href).toBe(firstDestinationUrl)
    expect(frames.top.src).toBe(window.location.href)
    expect(frames.target.src).toBe(firstTargetSrc)

    await window.navigation.forward().finished

    frames = fixture.frames()
    expect(window.location.href).toBe(secondDestinationUrl)
    expect(frames.top.src).toBe(window.location.href)
    expect(frames.target.src).toBe(secondTargetSrc)
    expect(fixture.requests).toEqual([
      { src: firstTargetSrc, target: 'target' },
      { src: secondTargetSrc, target: 'target' },
      { src: firstTargetSrc, target: 'target' },
      { src: secondTargetSrc, target: 'target' },
    ])
    expect(events.map((event) => event.src)).toEqual([
      firstTargetSrc,
      secondTargetSrc,
      firstTargetSrc,
      secondTargetSrc,
    ])
    for (let event of events) {
      expect(event.element).toBeNull()
      expect(event.submitter).toBeNull()
      expect(event.method).toBe('get')
      expect(event.encType).toBeNull()
      expect(event.formData).toBeNull()
      await event.finished
    }
  })

  it('restores traversal scroll after a preserved entry resolves a blocking frame', async (t) => {
    let initialUrl = window.location.href
    let initialEntryKey = window.navigation.currentEntry?.key
    let listUrl = new URL('/scroll-list', initialUrl).href
    let detailUrl = new URL('/scroll-detail', initialUrl).href
    window.history.replaceState(null, '', listUrl)

    let StoreEntry = clientEntry(
      '/js/scroll-store.js#ScrollStore',
      function ScrollStore(handle: Handle<{ variant: 'list' | 'detail' }>) {
        let showItems = false

        return () =>
          handle.props.variant === 'list' ? (
            <main id="scroll-list-page">
              <button
                id="show-scroll-list-items"
                type="button"
                mix={on('click', () => {
                  showItems = true
                  handle.update()
                })}
              >
                Show list items
              </button>
              {showItems ? <Frame src="/list-items" /> : <p>List items hidden</p>}
            </main>
          ) : (
            <main id="scroll-detail-page" style={{ display: 'block', height: '1000px' }}>
              Detail
            </main>
          )
      },
    )

    async function renderStoreDocument(variant: 'list' | 'detail') {
      return await drainWithProtocol(
        renderToStream(
          <html>
            <head />
            <body>
              <StoreEntry variant={variant} />
            </body>
          </html>,
        ),
      )
    }

    let initialDocument = new DOMParser().parseFromString(
      await renderStoreDocument('list'),
      'text/html',
    )
    document.documentElement.innerHTML = initialDocument.documentElement.innerHTML

    let listItemsContent = '<div id="scroll-list-items" style="height:4000px"></div>'
    let [deferredListItems, resolveDeferredListItems] = withResolvers<string>()
    let [deferredListItemsRequested, markDeferredListItemsRequested] = withResolvers<void>()
    let listItemsRequestCount = 0
    let app = run({
      loadModule(moduleUrl, exportName) {
        if (moduleUrl === '/js/scroll-store.js' && exportName === 'ScrollStore') return StoreEntry
        throw new Error(`Unexpected module: ${moduleUrl}#${exportName}`)
      },
      async resolveFrame(src: string) {
        let pathname = new URL(src, window.location.href).pathname
        if (pathname === '/scroll-list') return await renderStoreDocument('list')
        if (pathname === '/scroll-detail') return await renderStoreDocument('detail')
        if (pathname === '/list-items') {
          listItemsRequestCount++
          if (listItemsRequestCount === 1) return listItemsContent
          markDeferredListItemsRequested()
          return await deferredListItems
        }
        throw new Error(`Unexpected frame src: ${src}`)
      },
    })

    t.after(async () => {
      resolveDeferredListItems(listItemsContent)
      if (initialEntryKey && window.navigation.currentEntry?.key !== initialEntryKey) {
        await window.navigation.traverseTo(initialEntryKey).finished
      }
      app.dispose()
      window.history.replaceState(null, '', initialUrl)
      window.scrollTo(0, 0)
    })

    await app.ready()
    let initialListItems = waitForElement('#scroll-list-items')
    let showItemsButton = document.getElementById('show-scroll-list-items')
    invariant(showItemsButton instanceof HTMLButtonElement)
    showItemsButton.click()
    app.flush()
    await initialListItems

    let scrolled = new Promise((resolve) =>
      window.addEventListener('scroll', resolve, { once: true }),
    )
    window.scrollTo(0, 2500)
    expect(window.scrollY).toBe(2500)
    await scrolled

    await navigate(detailUrl)
    expect(document.getElementById('scroll-detail-page')?.textContent).toContain('Detail')

    let listItemsRenderedAtScroll: boolean | undefined
    window.navigation.addEventListener(
      'navigate',
      (event) => {
        let scroll = event.scroll.bind(event)
        Object.defineProperty(event, 'scroll', {
          value() {
            listItemsRenderedAtScroll = document.getElementById('scroll-list-items') != null
            scroll()
          },
        })
      },
      { once: true },
    )

    let backNavigation = window.navigation.back().finished
    await deferredListItemsRequested
    resolveDeferredListItems(listItemsContent)
    await backNavigation

    expect(listItemsRenderedAtScroll).toBe(true)
    expect(document.getElementById('scroll-list-items')).not.toBe(null)
    expect(window.scrollY).toBe(2500)
  })

  it('dispatches reloadStart and reloadComplete events for handle.frame and handle.frames.get(name)', async () => {
    let summaryReloadStartEvents = 0
    let rowReloadStartEvents = 0
    let summaryReloadCompleteEvents = 0
    let rowReloadCompleteEvents = 0
    let triggerReloads: undefined | (() => Promise<void>)
    let summaryRenderCount = 0

    let RowAction = clientEntry(
      '/assets/reload-events.js#ReloadEvents',
      function ReloadEvents(handle: Handle) {
        triggerReloads = async () => {
          let summaryFrame = handle.frames.get('cart-summary')
          invariant(summaryFrame)
          summaryFrame.addEventListener(
            'reloadStart',
            () => {
              summaryReloadStartEvents++
            },
            { once: true },
          )
          summaryFrame.addEventListener(
            'reloadComplete',
            () => {
              summaryReloadCompleteEvents++
            },
            { once: true },
          )
          handle.frame.addEventListener(
            'reloadStart',
            () => {
              rowReloadStartEvents++
            },
            { once: true },
          )
          handle.frame.addEventListener(
            'reloadComplete',
            () => {
              rowReloadCompleteEvents++
            },
            { once: true },
          )
          await Promise.all([summaryFrame.reload(), handle.frame.reload()])
        }

        return () => <button id="reload-events">Reload events</button>
      },
    )

    async function resolveFrame(src: string) {
      if (src === '/summary') {
        summaryRenderCount++
        return await drain(renderToStream(<p id="summary-events">Summary: {summaryRenderCount}</p>))
      }
      if (src === '/row') {
        return await drain(renderToStream(<RowAction />))
      }
      throw new Error(`Unexpected frame src: ${src}`)
    }

    let html = await drain(
      renderToStream(
        <main>
          <Frame name="cart-summary" src="/summary" fallback={<div>Loading summary…</div>} />
          <Frame src="/row" fallback={<div>Loading row…</div>} />
        </main>,
        { resolveFrame },
      ),
    )
    document.body.innerHTML = html

    let app = run({
      loadModule(moduleUrl, exportName) {
        if (moduleUrl === '/assets/reload-events.js' && exportName === 'ReloadEvents') {
          return RowAction
        }
        throw new Error(`Unexpected module: ${moduleUrl}#${exportName}`)
      },
      resolveFrame,
    })

    await app.ready()

    expect(document.getElementById('summary-events')?.textContent).toBe('Summary: 1')

    invariant(triggerReloads)
    await triggerReloads()

    expect(summaryReloadStartEvents).toBe(1)
    expect(rowReloadStartEvents).toBe(1)
    expect(summaryReloadCompleteEvents).toBe(1)
    expect(rowReloadCompleteEvents).toBe(1)
    expect(document.getElementById('summary-events')?.textContent).toBe('Summary: 2')

    app.dispose()
  })

  it('dispatches reloadStart and reloadComplete events for non-blocking child frames during top frame reloads', async () => {
    let childReloadStartEvents = 0
    let childReloadCompleteEvents = 0
    let childReloadFinished: FrameReloadStartEvent['finished'] | undefined
    let childReloadSettled = false
    let [childReloadCompleted, markChildReloadCompleted] = withResolvers<void>()
    let reloadTopFromChild: undefined | (() => Promise<AbortSignal>)

    let ChildReloadObserver = clientEntry(
      '/assets/child-reload-observer.js#ChildReloadObserver',
      function ChildReloadObserver(handle: Handle) {
        reloadTopFromChild = async () => {
          handle.frame.addEventListener(
            'reloadStart',
            (event) => {
              childReloadStartEvents++
              childReloadFinished = event.finished.finally(() => {
                childReloadSettled = true
              })
            },
            { once: true },
          )
          handle.frame.addEventListener(
            'reloadComplete',
            () => {
              childReloadCompleteEvents++
              markChildReloadCompleted()
            },
            { once: true },
          )
          return await handle.frames.top.reload()
        }

        return () => <button id="reload-top-from-child">Reload top</button>
      },
    )

    async function renderChildFrame(label: string) {
      return await drain(
        renderToStream(
          <section id="event-child-frame-content">
            <p id="event-child-frame-label">{label}</p>
            <ChildReloadObserver />
          </section>,
        ),
      )
    }

    function renderDocument(childContent: string | Promise<string>) {
      return renderToStream(
        <html>
          <head />
          <body>
            <main>
              <p id="event-top-frame-label">Top frame</p>
              <Frame
                name="event-child"
                src="/event-child"
                fallback={<span id="event-child-frame-fallback">Loading child...</span>}
              />
            </main>
          </body>
        </html>,
        {
          resolveFrame(src: string) {
            if (src === '/event-child') return childContent
            throw new Error(`Unexpected frame src: ${src}`)
          },
        },
      )
    }

    let initialDocument = new DOMParser().parseFromString(
      await drainWithProtocol(renderDocument(renderChildFrame('Initial child'))),
      'text/html',
    )
    document.documentElement.innerHTML = initialDocument.documentElement.innerHTML

    let [childReloadPromise, resolveChildReload] = withResolvers<string>()
    let streamedReload = renderDocument(childReloadPromise)
    let streamedChunks = readChunks(streamedReload)
    let firstChunk = await streamedChunks.next()
    invariant(!firstChunk.done)
    resolveChildReload(await renderChildFrame('Reloaded child'))
    let secondChunk = await streamedChunks.next()
    invariant(!secondChunk.done)
    let [secondChunkPromise, releaseSecondChunk] = withResolvers<string>()

    let app = run({
      loadModule(moduleUrl, exportName) {
        if (
          moduleUrl === '/assets/child-reload-observer.js' &&
          exportName === 'ChildReloadObserver'
        ) {
          return ChildReloadObserver
        }
        throw new Error(`Unexpected module: ${moduleUrl}#${exportName}`)
      },
      resolveFrame(src: string) {
        if (src === document.location.href) {
          return streamFromChunks(['<!DOCTYPE html>', firstChunk.value, secondChunkPromise])
        }
        throw new Error(`Unexpected frame src: ${src}`)
      },
    })

    await app.ready()

    expect(document.getElementById('event-child-frame-label')?.textContent).toBe('Initial child')

    invariant(reloadTopFromChild)
    let reloadPromise = reloadTopFromChild()
    await waitForFrameMarker(firstChunk.value)

    expect(childReloadStartEvents).toBe(1)
    expect(childReloadCompleteEvents).toBe(0)
    expect(childReloadSettled).toBe(false)
    expect(document.getElementById('event-child-frame-fallback')).toBeNull()
    expect(document.getElementById('event-child-frame-label')?.textContent).toBe('Initial child')

    releaseSecondChunk(secondChunk.value)
    await Promise.all([reloadPromise, childReloadCompleted])

    expect(childReloadStartEvents).toBe(1)
    expect(childReloadCompleteEvents).toBe(1)
    await childReloadFinished
    expect(document.getElementById('event-child-frame-fallback')).toBeNull()
    expect(document.getElementById('event-child-frame-label')?.textContent).toBe('Reloaded child')

    app.dispose()
  })

  it('finishes child reloads when cached HTML reuses resolved frame markers', async (t) => {
    let cachedHtml = await drainWithProtocol(
      renderToStream(
        <html>
          <head />
          <body>
            <Frame name="child" src="/child" />
          </body>
        </html>,
        { resolveFrame: () => '<p id="cached-child">Cached child</p>' },
      ),
    )
    let initialDocument = new DOMParser().parseFromString(cachedHtml, 'text/html')
    document.documentElement.innerHTML = initialDocument.documentElement.innerHTML
    let childRender = Promise.withResolvers<void>()
    let releaseChildRender = Promise.withResolvers<string[]>()
    let reloadRenderCalls = 0
    let reloading = false
    let app = run({
      loadModule: mock.fn(),
      resolveFrame: () => streamFromChunks([cachedHtml]),
      processClientEntryPreloads(hrefs) {
        if (reloading && ++reloadRenderCalls === 2) {
          childRender.resolve()
          return releaseChildRender.promise
        }
        return hrefs
      },
    })
    t.after(() => app.dispose())
    await app.ready()
    let child = app.frames.get('child')
    invariant(child)
    let events: FrameReloadStartEvent[] = []
    let completions = 0
    child.addEventListener('reloadStart', (event) => events.push(event))
    child.addEventListener('reloadComplete', () => completions++)

    reloading = true
    let reload = app.frames.top.reload()
    await childRender.promise
    expect(completions).toBe(0)
    releaseChildRender.resolve([])
    await reload

    expect(app.frames.get('child')).toBe(child)
    expect(document.getElementById('cached-child')?.textContent).toBe('Cached child')
    expect(events).toHaveLength(1)
    expect(completions).toBe(1)
    expect((await events[0]!.finished).aborted).toBe(false)
  })

  it('finishes cached pending frame markers only after their replayed template renders', async (t) => {
    let content = Promise.withResolvers<string>()
    let chunks = readChunks(
      renderToStream(
        <html>
          <head />
          <body>
            <Frame name="child" src="/child" fallback={<p>Loading child</p>} />
          </body>
        </html>,
        { resolveFrame: () => content.promise },
      ),
    )
    let shell = await chunks.next()
    invariant(!shell.done)
    content.resolve('<p id="cached-child">Cached child</p>')
    let templates = ''
    for await (let chunk of chunks) templates += chunk
    let initialDocument = new DOMParser().parseFromString(shell.value + templates, 'text/html')
    document.documentElement.innerHTML = initialDocument.documentElement.innerHTML
    let templateChunk = Promise.withResolvers<string>()
    let app = run({
      loadModule: mock.fn(),
      resolveFrame: () => streamFromChunks([shell.value, templateChunk.promise]),
    })
    t.after(() => app.dispose())
    await app.ready()
    let label = document.getElementById('cached-child')
    invariant(label)
    label.textContent = 'Client edit'
    let child = app.frames.get('child')
    invariant(child)
    let events: FrameReloadStartEvent[] = []
    let completions = 0
    child.addEventListener('reloadStart', (event) => events.push(event))
    child.addEventListener('reloadComplete', () => completions++)

    let reload = reloadFrameForNavigation(app.frames.top)
    await reload.committed
    expect(events).toHaveLength(1)
    expect(completions).toBe(0)
    expect(document.getElementById('cached-child')?.textContent).toBe('Client edit')

    templateChunk.resolve(templates)
    await reload.finished
    await new Promise(requestAnimationFrame)

    expect(app.frames.get('child')).toBe(child)
    expect(document.getElementById('cached-child')?.textContent).toBe('Cached child')
    expect(events).toHaveLength(1)
    expect(completions).toBe(1)
    expect((await events[0]!.finished).aborted).toBe(false)
  })

  it('finishes cached reloads that reuse an initial pending template watch', async (t) => {
    let content = Promise.withResolvers<string>()
    let chunks = readChunks(
      renderToStream(
        <html>
          <head />
          <body>
            <Frame name="child" src="/child" fallback={<p>Loading child</p>} />
          </body>
        </html>,
        { resolveFrame: () => content.promise },
      ),
    )
    let shell = await chunks.next()
    invariant(!shell.done)
    content.resolve(
      '<link rel="modulepreload" data-rmx-module-preload href="/child.js"><p id="cached-child">Cached child</p>',
    )
    let templates = ''
    for await (let chunk of chunks) templates += chunk

    for (let buffered of [false, true]) {
      let initialDocument = new DOMParser().parseFromString(shell.value, 'text/html')
      document.documentElement.innerHTML = initialDocument.documentElement.innerHTML
      let templateChunk = Promise.withResolvers<string>()
      let rendering = Promise.withResolvers<void>()
      let releaseRender = Promise.withResolvers<string[]>()
      let releaseShell = Promise.withResolvers<string[]>()
      let reloading = false
      let app = run({
        loadModule: mock.fn(),
        resolveFrame: () =>
          streamFromChunks(
            buffered ? [shell.value + templates] : [shell.value, templateChunk.promise],
          ),
        processClientEntryPreloads(hrefs) {
          if (hrefs.includes('/child.js')) {
            rendering.resolve()
            return releaseRender.promise
          }
          if (reloading && buffered) return releaseShell.promise
          return hrefs
        },
      })
      t.after(() => app.dispose())
      await app.ready()
      let child = app.frames.get('child')
      invariant(child)
      let events: FrameReloadStartEvent[] = []
      let completions = 0
      child.addEventListener('reloadStart', (event) => events.push(event))
      child.addEventListener('reloadComplete', () => completions++)

      reloading = true
      let reload = reloadFrameForNavigation(app.frames.top)
      if (!buffered) {
        await reload.committed
        templateChunk.resolve(templates)
      }
      await rendering.promise
      expect(completions).toBe(0)
      releaseRender.resolve([])
      if (buffered) {
        // The initial watcher can finish rendering before the replayed shell is accepted.
        await new Promise(requestAnimationFrame)
        expect(document.getElementById('cached-child')?.textContent).toBe('Cached child')
        expect(completions).toBe(0)
        releaseShell.resolve([])
      }
      await reload.finished
      await new Promise(requestAnimationFrame)

      expect(document.getElementById('cached-child')?.textContent).toBe('Cached child')
      expect(events).toHaveLength(1)
      expect(completions).toBe(1)
      expect((await events[0]!.finished).aborted).toBe(false)
      app.dispose()
    }
  })

  it('preserves initial streamed child content when an ancestor navigation is aborted', async (t) => {
    let content = Promise.withResolvers<string>()
    let chunks = readChunks(
      renderToStream(
        <html>
          <head />
          <body>
            <Frame name="child" src="/child" fallback={<p>Loading child</p>} />
          </body>
        </html>,
        { resolveFrame: () => content.promise },
      ),
    )
    let shell = await chunks.next()
    invariant(!shell.done)
    content.resolve(
      '<link rel="modulepreload" data-rmx-module-preload href="/child.js"><p id="streamed-child">Initial child</p>',
    )
    let templates = ''
    for await (let chunk of chunks) templates += chunk

    for (let acceptShell of [false, true]) {
      let initialDocument = new DOMParser().parseFromString(shell.value, 'text/html')
      document.documentElement.innerHTML = initialDocument.documentElement.innerHTML
      let response = Promise.withResolvers<string>()
      let releaseRender = Promise.withResolvers<string[]>()
      let rendering = false
      let app = run({
        loadModule: mock.fn(),
        resolveFrame: () =>
          acceptShell
            ? new ReadableStream<Uint8Array>({
                start(controller) {
                  controller.enqueue(new TextEncoder().encode(shell.value))
                },
              })
            : response.promise,
        processClientEntryPreloads(hrefs) {
          if (hrefs.includes('/child.js')) {
            rendering = true
            return releaseRender.promise
          }
          return hrefs
        },
      })
      t.after(() => {
        releaseRender.resolve([])
        response.resolve('')
        app.dispose()
      })
      await app.ready()
      let child = app.frames.get('child')
      invariant(child)
      let events: FrameReloadStartEvent[] = []
      child.addEventListener('reloadStart', (event) => events.push(event))
      let controller = new AbortController()
      let reload = reloadFrameForNavigation(app.frames.top, { signal: controller.signal })
      if (acceptShell) {
        await reload.committed
        controller.abort()
      }
      document.body.insertAdjacentHTML('beforeend', templates)
      await new Promise(requestAnimationFrame)
      expect(rendering).toBe(true)
      controller.abort()
      expect(events).toHaveLength(1)
      expect((await events[0]!.finished).aborted).toBe(true)
      releaseRender.resolve([])
      response.resolve('')
      await reload.finished
      await new Promise(requestAnimationFrame)

      expect(document.getElementById('streamed-child')?.textContent).toBe('Initial child')
      app.dispose()
    }
  })

  it('rejects a streamed child reload when processing its template fails', async (t) => {
    function renderDocument(content: string | Promise<string>) {
      return renderToStream(
        <html>
          <head />
          <body>
            <Frame name="child" src="/child" fallback={<p>Loading child</p>} />
          </body>
        </html>,
        { resolveFrame: () => content },
      )
    }
    let initialDocument = new DOMParser().parseFromString(
      await drainWithProtocol(renderDocument('<p>Initial child</p>')),
      'text/html',
    )
    document.documentElement.innerHTML = initialDocument.documentElement.innerHTML
    let content = Promise.withResolvers<string>()
    let chunks = readChunks(renderDocument(content.promise))
    let shell = await chunks.next()
    invariant(!shell.done)
    content.resolve(
      '<link rel="modulepreload" data-rmx-module-preload href="/failed.js"><p>Saved child</p>',
    )
    let templates = ''
    for await (let chunk of chunks) templates += chunk
    let templateChunk = Promise.withResolvers<string>()
    let failure = new Error('Preload processing failed')
    let app = run({
      loadModule: mock.fn(),
      resolveFrame: () => streamFromChunks([shell.value, templateChunk.promise]),
      processClientEntryPreloads(hrefs) {
        if (hrefs.includes('/failed.js')) throw failure
        return hrefs
      },
    })
    t.after(() => app.dispose())
    let errors: unknown[] = []
    app.addEventListener('error', (event) => errors.push(event.error))
    await app.ready()
    let child = app.frames.get('child')
    invariant(child)
    let rejected: unknown[] = []
    let completions = 0
    child.addEventListener('reloadStart', (event) => {
      void event.finished.catch((error) => rejected.push(error))
    })
    child.addEventListener('reloadComplete', () => completions++)

    let reload = reloadFrameForNavigation(app.frames.top)
    await reload.committed
    templateChunk.resolve(templates)
    await reload.finished
    await new Promise(requestAnimationFrame)

    expect(errors).toEqual([failure])
    expect(rejected).toEqual([failure])
    expect(completions).toBe(1)
    expect(document.querySelector('p')?.textContent).toBe('Initial child')
  })

  it('does not fail a sibling’s new reload when a completion listener retries its ancestor', async (t) => {
    function renderDocument() {
      return renderToStream(
        <html>
          <head />
          <body>
            <Frame name="first" src="/first" />
            <Frame name="second" src="/second" />
          </body>
        </html>,
        { resolveFrame: (src) => `<p>${src}</p>` },
      )
    }
    let initialDocument = new DOMParser().parseFromString(
      await drainWithProtocol(renderDocument()),
      'text/html',
    )
    document.documentElement.innerHTML = initialDocument.documentElement.innerHTML
    let content = Promise.withResolvers<ReadableStream<Uint8Array>>()
    let failure = new Error('Ancestor failed')
    let fail = true
    let app = run({
      loadModule: mock.fn(),
      resolveFrame() {
        if (fail) throw failure
        return content.promise
      },
    })
    t.after(() => app.dispose())
    await app.ready()
    let first = app.frames.get('first')
    let second = app.frames.get('second')
    invariant(first && second)
    let recovery: Promise<AbortSignal> | undefined
    first.addEventListener(
      'reloadComplete',
      () => {
        fail = false
        recovery = app.frames.top.reload()
      },
      { once: true },
    )
    let events: FrameReloadStartEvent[] = []
    let settled: boolean[] = []
    let completions = 0
    second.addEventListener('reloadStart', (event) => {
      let index = events.length
      events.push(event)
      settled.push(false)
      void event.finished.then(
        () => (settled[index] = true),
        () => (settled[index] = true),
      )
    })
    second.addEventListener('reloadComplete', () => completions++)

    await expect(app.frames.top.reload()).rejects.toBe(failure)

    expect(events).toHaveLength(2)
    expect(completions).toBe(1)
    expect(settled).toEqual([true, false])
    content.resolve(renderDocument())
    invariant(recovery)
    expect((await recovery).aborted).toBe(false)
    expect((await events[1]!.finished).aborted).toBe(false)
    expect(completions).toBe(2)
  })

  it('gives child frames the initiating request and their own reload lifecycle before rmx:submission', async (t) => {
    function renderDocument(label: string) {
      return renderToStream(
        <html>
          <head />
          <body>
            <Frame name="child" src="/child" />
          </body>
        </html>,
        {
          resolveFrame: () => renderToStream(<p id="child-label">{label}</p>),
        },
      )
    }
    let initialDocument = new DOMParser().parseFromString(
      await drainWithProtocol(renderDocument('Initial child')),
      'text/html',
    )
    document.documentElement.innerHTML = initialDocument.documentElement.innerHTML
    let app = run({
      loadModule: mock.fn(),
      resolveFrame: () => renderDocument('Saved child'),
    })
    t.after(() => app.dispose())
    await app.ready()
    let child = app.frames.get('child')
    invariant(child)
    let events: FrameReloadStartEvent[] = []
    let order: string[] = []
    let topEvents: FrameReloadStartEvent[] = []
    app.frames.top.addEventListener('reloadStart', (event) => {
      topEvents.push(event)
      order.push('top')
    })
    child.addEventListener('reloadStart', (event) => {
      events.push(event)
      order.push('child')
    })
    let form = document.createElement('form')
    let button = document.createElement('button')
    form.append(button)
    let submissions: FormSubmissionEvent[] = []
    button.addEventListener('rmx:submission', (event) => {
      submissions.push(event)
      order.push('submit')
    })
    let formData = new FormData()
    formData.set('name', 'Ada')

    await reloadFrameForNavigation(app.frames.top, {
      formData,
      method: 'post',
      encType: 'application/x-www-form-urlencoded',
      element: form,
      submitter: button,
      form,
    }).finished

    expect(order).toEqual(['top', 'child', 'submit'])
    expect(events).toHaveLength(1)
    expect(submissions).toHaveLength(1)
    expect(submissions[0]!.finished).toBe(topEvents[0]!.finished)
    expect(events[0]!.finished).not.toBe(topEvents[0]!.finished)
    expect(events[0]!.src).toBe(app.frames.top.src)
    expect(events[0]!.method).toBe('post')
    expect(events[0]!.encType).toBe('application/x-www-form-urlencoded')
    expect(events[0]!.formData).toBe(formData)
    expect(events[0]!.element).toBe(form)
    expect(events[0]!.submitter).toBe(button)
    let childSignal = await events[0]!.finished
    expect(childSignal.aborted).toBe(false)
    expect(document.getElementById('child-label')?.textContent).toBe('Saved child')
    app.dispose()
    expect(childSignal.aborted).toBe(true)
  })

  it('keeps the ancestor request when a child finishes its own reload before the ancestor renders', async (t) => {
    let ancestorContent = Promise.withResolvers<RemixNode>()
    let childContent = Promise.withResolvers<string>()
    let parentRequests = 0
    let childRequests = 0
    let childNode = <Frame name="child" src="/child" />
    let app = run({
      loadModule: mock.fn(),
      resolveFrame(src) {
        if (src === '/child') {
          childRequests++
          return childRequests === 2 ? childContent.promise : '<p>Child</p>'
        }
        parentRequests++
        return parentRequests === 1 ? childNode : ancestorContent.promise
      },
    })
    t.after(() => app.dispose())
    await app.ready()
    await app.frames.top.reload()
    let child = app.frames.get('child')
    invariant(child)
    let events: FrameReloadStartEvent[] = []
    child.addEventListener('reloadStart', (event) => events.push(event))
    let ownReload = child.reload()
    let form = document.createElement('form')
    let button = document.createElement('button')
    form.append(button)
    let formData = new FormData()
    formData.set('title', 'Saved')
    let ancestorReload = reloadFrameForNavigation(app.frames.top, {
      method: 'post',
      encType: 'text/plain',
      formData,
      element: form,
      submitter: button,
      form,
    })

    childContent.resolve('<p>Earlier child request</p>')
    await ownReload
    ancestorContent.resolve(childNode)
    await ancestorReload.finished

    expect(events).toHaveLength(2)
    let event = events[1]!
    expect(event.src).toBe(app.frames.top.src)
    expect(event.method).toBe('post')
    expect(event.encType).toBe('text/plain')
    expect(event.formData).toBe(formData)
    expect(event.element).toBe(form)
    expect(event.submitter).toBe(button)
    expect((await event.finished).aborted).toBe(false)
    expect(document.querySelector('p')?.textContent).toBe('Child')
  })

  it('keeps the ancestor request through buffered and streamed pending frame templates', async (t) => {
    function renderParent(label: string) {
      return renderToStream(<Frame name="child" src="/child" />, {
        resolveFrame: () => `<p id="child-content">${label}</p>`,
      })
    }
    function renderDocument(
      parentContent: ReadableStream<Uint8Array> | Promise<ReadableStream<Uint8Array>>,
    ) {
      return renderToStream(
        <html>
          <head />
          <body>
            <Frame name="parent" src="/parent" fallback={<p>Loading parent</p>} />
          </body>
        </html>,
        {
          resolveFrame: () => parentContent,
        },
      )
    }

    for (let delivery of ['buffered', 'streamed']) {
      let initialDocument = new DOMParser().parseFromString(
        await drainWithProtocol(renderDocument(renderParent('Initial child'))),
        'text/html',
      )
      document.documentElement.innerHTML = initialDocument.documentElement.innerHTML
      let parentContent = Promise.withResolvers<ReadableStream<Uint8Array>>()
      let chunks = readChunks(renderDocument(parentContent.promise))
      let shell = await chunks.next()
      invariant(!shell.done, 'Expected the pending parent shell')
      parentContent.resolve(renderParent('Saved child'))
      let templates = ''
      for await (let chunk of chunks) templates += chunk
      let firstChunk = Promise.withResolvers<string>()
      let lastChunk = Promise.withResolvers<string>()
      let childContent = Promise.withResolvers<string>()
      let app = run({
        loadModule: mock.fn(),
        resolveFrame(src) {
          return src === '/child'
            ? childContent.promise
            : streamFromChunks([firstChunk.promise, lastChunk.promise])
        },
      })
      t.after(() => app.dispose())
      await app.ready()
      await waitForElement('#child-content')
      let child = app.frames.get('child')
      invariant(child, 'Expected the nested child frame')
      let events: FrameReloadStartEvent[] = []
      child.addEventListener('reloadStart', (event) => events.push(event))
      let ownReload = child.reload()
      let form = document.createElement('form')
      let formData = new FormData()
      formData.set('title', 'Saved')
      let ancestorReload = reloadFrameForNavigation(app.frames.top, {
        method: 'post',
        encType: 'text/plain',
        formData,
        element: form,
        form,
      })
      childContent.resolve('<p>Earlier child request</p>')
      await ownReload

      if (delivery === 'buffered') {
        firstChunk.resolve(shell.value + templates)
        lastChunk.resolve('')
      } else {
        firstChunk.resolve(shell.value)
        await ancestorReload.committed
        lastChunk.resolve(templates)
      }
      await ancestorReload.finished

      expect(events).toHaveLength(2)
      let event = events[1]!
      expect(event.src).toBe(app.frames.top.src)
      expect(event.method).toBe('post')
      expect(event.encType).toBe('text/plain')
      expect(event.formData).toBe(formData)
      expect(event.element).toBe(form)
      expect((await event.finished).aborted).toBe(false)
      expect(document.getElementById('child-content')?.textContent).toBe('Saved child')
      app.dispose()
    }
  })

  it('rejects child frames’ finished with the failure when the reload of an ancestor fails', async (t) => {
    function renderDocument() {
      return renderToStream(
        <html>
          <head />
          <body>
            <Frame name="child" src="/child" />
          </body>
        </html>,
        { resolveFrame: () => '<p id="child-label">Initial child</p>' },
      )
    }
    let initialDocument = new DOMParser().parseFromString(
      await drainWithProtocol(renderDocument()),
      'text/html',
    )
    document.documentElement.innerHTML = initialDocument.documentElement.innerHTML
    let failure = new Error('500 Internal Server Error')
    let fail = true
    let app = run({
      loadModule: mock.fn(),
      resolveFrame() {
        if (fail) throw failure
        return renderDocument()
      },
    })
    t.after(() => app.dispose())
    app.addEventListener('error', () => {})
    await app.ready()
    let child = app.frames.get('child')
    invariant(child)
    let events: FrameReloadStartEvent[] = []
    let completions = 0
    child.addEventListener('reloadStart', (event) => events.push(event))
    child.addEventListener('reloadComplete', () => completions++)

    await expect(app.frames.top.reload()).rejects.toBe(failure)

    expect(events).toHaveLength(1)
    await expect(events[0]!.finished).rejects.toBe(failure)
    expect(completions).toBe(1)
    expect(document.getElementById('child-label')?.textContent).toBe('Initial child')

    let recovery = Promise.withResolvers<AbortSignal>()
    app.addEventListener(
      'error',
      () => {
        fail = false
        void app.frames.top.reload().then(recovery.resolve, recovery.reject)
      },
      { once: true },
    )
    await expect(app.frames.top.reload()).rejects.toBe(failure)
    expect((await recovery.promise).aborted).toBe(false)

    expect(events).toHaveLength(3)
    await expect(events[1]!.finished).rejects.toBe(failure)
    expect((await events[2]!.finished).aborted).toBe(false)
  })

  it('reloads a frame region when the response uses css mixins', async () => {
    let renderCount = 0

    let reload: undefined | (() => Promise<AbortSignal>)

    let ReloadButton = clientEntry(
      '/assets/reload-css.js#ReloadCss',
      function ReloadCss(handle: Handle) {
        reload = () => handle.frame.reload()
        return () => <button mix={[css({ color: '#fff' })]}>Reload</button>
      },
    )

    async function renderTimeFragmentWithCss() {
      renderCount++
      let stream = renderToStream(
        <section mix={[css({ padding: 8 })]}>
          <p mix={[css({ margin: 0 })]}>Server: {renderCount}</p>
          <ReloadButton />
        </section>,
        {
          onError(error) {
            console.error(error)
          },
        },
      )
      return await drain(stream)
    }

    let stream = renderToStream(
      <main mix={[css({ color: '#0bf' })]}>
        <Frame src="/time-css" fallback={<div>Loading…</div>} />
      </main>,
      { resolveFrame: renderTimeFragmentWithCss },
    )

    let html = await drain(stream)
    document.body.innerHTML = html

    let frameId = getCommentMarkerId(html, 'rmx:f:')
    expect(document.querySelector(`template#${frameId}`)).toBeTruthy()

    let clientFrame = run({
      loadModule(moduleUrl, exportName) {
        if (moduleUrl === '/assets/reload-css.js' && exportName === 'ReloadCss') return ReloadButton
        throw new Error(`Unexpected module: ${moduleUrl}#${exportName}`)
      },
      resolveFrame: renderTimeFragmentWithCss,
    })

    await clientFrame.ready()

    expect(document.querySelector('p')?.textContent).toBe('Server: 1')
    invariant(reload)

    let section = document.querySelector('section')
    let paragraph = document.querySelector('p')
    let button = document.querySelector('button')
    invariant(section && paragraph && button)

    await reload()
    expect(document.querySelector('p')?.textContent).toBe('Server: 2')

    // Regression guard: reload should preserve node identity even with css-prop styles.
    expect(document.querySelector('section')).toBe(section)
    expect(document.querySelector('p')).toBe(paragraph)
    expect(document.querySelector('button')).toBe(button)

    clientFrame.dispose()
  })

  it('keeps shared css rules when a frame reload removes one keyed item', async () => {
    type Item = {
      id: string
      label: string
    }

    let items: Item[] = [
      { id: 'a', label: 'Ash & Smoke' },
      { id: 'b', label: 'Heavy Metal Guitar Riffs' },
    ]
    let reload: undefined | (() => Promise<AbortSignal>)

    let CartItems = clientEntry(
      '/assets/cart-items-css.js#CartItemsCss',
      function CartItemsCss(handle: Handle<{ items: Item[] }>) {
        reload = () => handle.frame.reload()

        return () => (
          <section>
            {handle.props.items.map((item) => (
              <form
                key={item.id}
                data-row={item.id}
                mix={[css({ display: 'inline-flex', gap: '4px', alignItems: 'center' })]}
              >
                <span mix={[css({ color: 'rgb(10, 20, 30)' })]}>{item.label}</span>
                <input
                  aria-label={`${item.label} quantity`}
                  defaultValue="1"
                  mix={[css({ width: '70px' })]}
                />
                <button
                  type="button"
                  mix={[
                    css({
                      color: 'rgb(255, 255, 255)',
                      backgroundColor: 'rgb(1, 2, 3)',
                    }),
                  ]}
                >
                  Update
                </button>
              </form>
            ))}
          </section>
        )
      },
    )

    async function renderCartItems(): Promise<string> {
      return await drain(renderToStream(<CartItems items={items} />))
    }

    let html = await drain(
      renderToStream(
        <main>
          <Frame src="/cart-items-css" />
        </main>,
        { resolveFrame: renderCartItems },
      ),
    )
    document.body.innerHTML = html

    let app = run({
      loadModule(moduleUrl, exportName) {
        if (moduleUrl === '/assets/cart-items-css.js' && exportName === 'CartItemsCss') {
          return CartItems
        }
        throw new Error(`Unexpected module: ${moduleUrl}#${exportName}`)
      },
      resolveFrame(src: string) {
        if (src === '/cart-items-css') return renderCartItems()
        throw new Error(`Unexpected frame src: ${src}`)
      },
    })

    await app.ready()

    let survivingRow = document.querySelector('[data-row="b"]')
    invariant(survivingRow instanceof HTMLFormElement)
    let survivingLabel = survivingRow.querySelector('span')
    let survivingInput = survivingRow.querySelector('input')
    let survivingButton = survivingRow.querySelector('button')
    invariant(survivingLabel && survivingInput && survivingButton)

    expect(getComputedStyle(survivingLabel).color).toBe('rgb(10, 20, 30)')
    expect(getComputedStyle(survivingInput).width).toBe('70px')
    expect(getComputedStyle(survivingButton).backgroundColor).toBe('rgb(1, 2, 3)')

    items = [{ id: 'b', label: 'Heavy Metal Guitar Riffs' }]
    invariant(reload)
    await reload()

    expect(document.querySelector('[data-row="a"]')).toBeNull()
    expect(document.querySelector('[data-row="b"]')).toBe(survivingRow)
    expect(getComputedStyle(survivingLabel).color).toBe('rgb(10, 20, 30)')
    expect(getComputedStyle(survivingInput).width).toBe('70px')
    expect(getComputedStyle(survivingButton).backgroundColor).toBe('rgb(1, 2, 3)')

    app.dispose()
  })

  it('keeps client-only css rules across a frame reload that omits them from server HTML', async () => {
    let itemCount = 2
    let startPendingReload: undefined | (() => Promise<AbortSignal>)

    let CartSummary = clientEntry(
      '/assets/cart-summary-css.js#CartSummaryCss',
      function CartSummaryCss(handle: Handle<{ itemCount: number }>) {
        let pending = false

        startPendingReload = async () => {
          pending = true
          await handle.update()
          return await handle.frame.reload()
        }

        return () => (
          <section>
            {pending ? (
              <p id="pending-message" mix={[css({ color: 'rgb(200, 0, 0)' })]}>
                Updating your cart...
              </p>
            ) : null}
            <p id="item-count" mix={[css({ color: 'rgb(0, 0, 200)' })]}>
              Items: {handle.props.itemCount}
            </p>
          </section>
        )
      },
    )

    async function renderCartSummary(): Promise<string> {
      return await drain(renderToStream(<CartSummary itemCount={itemCount} />))
    }

    let html = await drain(
      renderToStream(
        <main>
          <Frame src="/cart-summary-css" />
        </main>,
        { resolveFrame: renderCartSummary },
      ),
    )
    document.body.innerHTML = html

    let app = run({
      loadModule(moduleUrl, exportName) {
        if (moduleUrl === '/assets/cart-summary-css.js' && exportName === 'CartSummaryCss') {
          return CartSummary
        }
        throw new Error(`Unexpected module: ${moduleUrl}#${exportName}`)
      },
      resolveFrame(src: string) {
        if (src === '/cart-summary-css') return renderCartSummary()
        throw new Error(`Unexpected frame src: ${src}`)
      },
    })

    await app.ready()

    expect(document.getElementById('pending-message')).toBeNull()
    expect(getComputedStyle(document.getElementById('item-count')!).color).toBe('rgb(0, 0, 200)')

    itemCount = 1
    invariant(startPendingReload)
    await startPendingReload()

    let pendingMessage = document.getElementById('pending-message')
    invariant(pendingMessage)
    expect(pendingMessage.textContent).toBe('Updating your cart...')
    expect(getComputedStyle(pendingMessage).color).toBe('rgb(200, 0, 0)')
    expect(document.getElementById('item-count')?.textContent).toBe('Items: 1')
    expect(getComputedStyle(document.getElementById('item-count')!).color).toBe('rgb(0, 0, 200)')

    app.dispose()
  })

  it('dispatches reload rejections to app error listeners', async () => {
    let reload: undefined | (() => Promise<AbortSignal>)
    let reloadError = new TypeError('Failed to fetch')
    let renderCount = 0

    let ReloadButton = clientEntry(
      '/assets/reload-error.js#ReloadError',
      function ReloadError(handle: Handle) {
        reload = () => handle.frame.reload()
        return () => <button id="reload-error">Reload error</button>
      },
    )

    async function resolveFrame(src: string) {
      if (src !== '/reload-error') throw new Error(`Unexpected frame src: ${src}`)
      renderCount++
      if (renderCount === 1) {
        return await drain(
          renderToStream(
            <section>
              <p id="reload-error-value">Initial</p>
              <ReloadButton />
            </section>,
          ),
        )
      }
      throw reloadError
    }

    let html = await drain(
      renderToStream(
        <main>
          <Frame src="/reload-error" fallback={<div>Loading…</div>} />
        </main>,
        { resolveFrame },
      ),
    )
    document.body.innerHTML = html

    let app = run({
      loadModule(moduleUrl, exportName) {
        if (moduleUrl === '/assets/reload-error.js' && exportName === 'ReloadError') {
          return ReloadButton
        }
        throw new Error(`Unexpected module: ${moduleUrl}#${exportName}`)
      },
      resolveFrame,
    })
    let forwarded: unknown
    app.addEventListener('error', (event) => {
      forwarded = event.error
    })

    await app.ready()

    invariant(reload)

    let caught = await reload().catch((error) => error)

    expect(caught).toBe(reloadError)
    expect(forwarded).toBe(reloadError)
    expect(document.getElementById('reload-error-value')?.textContent).toBe('Initial')

    app.dispose()
  })

  it('cancels a superseded reload fetch without reporting an error', async (t) => {
    document.body.innerHTML = '<p id="initial">Initial</p>'
    let fetchSignal: AbortSignal | null | undefined
    let callCount = 0
    t.mock.method(window, 'fetch', async (_input: RequestInfo | URL, options?: RequestInit) => {
      if (callCount++ === 0) {
        fetchSignal = options?.signal
        return new Promise<Response>((_resolve, reject) => {
          fetchSignal?.addEventListener('abort', () => reject(fetchSignal?.reason), { once: true })
        })
      }
      return new Response(await renderDocumentContent(<p id="current">Current</p>))
    })
    let app = run({ loadModule: mock.fn() })
    t.after(() => app.dispose())
    let onError = t.mock.fn()
    app.addEventListener('error', onError)
    await app.ready()

    let staleReload = app.frames.top.reload()
    let currentReload = app.frames.top.reload()

    expect(fetchSignal?.aborted).toBe(true)
    expect((await staleReload).aborted).toBe(true)
    expect((await currentReload).aborted).toBe(false)
    expect(document.getElementById('current')?.textContent).toBe('Current')
    expect(onError.mock.calls).toHaveLength(0)
  })

  it('finishes a streamed reload after removing its calling component', async (t) => {
    let reload: Promise<AbortSignal> | undefined
    let eventSignal: AbortSignal | undefined
    let [removed, markRemoved] = withResolvers<void>()
    let [tail, resolveTail] = withResolvers<string>()
    let ReloadButton = clientEntry(
      '/reload.js#ReloadButton',
      function ReloadButton(handle: Handle) {
        return () => (
          <button
            id="reload"
            mix={[
              on('click', (_event, signal) => {
                eventSignal = signal
                signal.addEventListener('abort', () => markRemoved(), { once: true })
                reload = handle.frame.reload()
              }),
            ]}
          >
            Reload
          </button>
        )
      },
    )
    document.body.innerHTML = await drain(
      renderToStream(<Frame src="/reload" />, {
        resolveFrame: () => renderFrameContent(<ReloadButton />),
      }),
    )
    let fetchSignal: AbortSignal | null | undefined
    t.mock.method(window, 'fetch', async (_input: RequestInfo | URL, options?: RequestInit) => {
      fetchSignal = options?.signal
      return new Response(
        streamFromChunks([appendFlushMarker('<p id="first">First</p>', 'fragment'), tail]),
        { headers: { 'Content-Type': 'text/html' } },
      )
    })
    let app = run({ loadModule: () => ReloadButton })
    t.after(() => {
      resolveTail('')
      app.dispose()
    })
    await app.ready()
    let button = document.getElementById('reload')
    invariant(button)

    button.click()
    invariant(reload)
    await removed

    expect(eventSignal?.aborted).toBe(true)
    expect(fetchSignal?.aborted).toBe(false)
    expect(document.getElementById('reload')).toBeNull()
    expect(document.getElementById('first')?.textContent).toBe('First')
    resolveTail('<p id="last">Last</p>')

    expect((await reload).aborted).toBe(false)
    expect(document.getElementById('last')?.textContent).toBe('Last')
  })

  it('aborts stale frame reloads when reload is re-entered', async () => {
    let reload: undefined | (() => Promise<AbortSignal>)
    let callCount = 0
    let firstSignal: AbortSignal | undefined
    let secondSignal: AbortSignal | undefined
    let [firstReloadContent, resolveFirstReloadContent] = withResolvers<string>()
    let [secondReloadContent, resolveSecondReloadContent] = withResolvers<string>()
    let [firstReloadResolving, markFirstReloadResolving] = withResolvers<void>()
    let [secondReloadResolving, markSecondReloadResolving] = withResolvers<void>()

    let ReloadButton = clientEntry(
      '/assets/reload-abort.js#ReloadAbort',
      function ReloadAbort(handle: Handle) {
        reload = () => handle.frame.reload()
        return () => <button id="reload-abort">Reload abort</button>
      },
    )

    async function renderInitial() {
      return await drain(
        renderToStream(
          <section>
            <p id="reload-value">Initial</p>
            <ReloadButton />
          </section>,
        ),
      )
    }

    let html = await drain(
      renderToStream(
        <main>
          <Frame src="/reload-abort" fallback={<div>Loading…</div>} />
        </main>,
        { resolveFrame: renderInitial },
      ),
    )
    document.body.innerHTML = html

    let clientFrame = run({
      loadModule(moduleUrl, exportName) {
        if (moduleUrl === '/assets/reload-abort.js' && exportName === 'ReloadAbort') {
          return ReloadButton
        }
        throw new Error(`Unexpected module: ${moduleUrl}#${exportName}`)
      },
      resolveFrame(src: string, options) {
        if (src !== '/reload-abort') throw new Error(`Unexpected frame src: ${src}`)
        callCount++
        if (callCount === 1) {
          firstSignal = options?.signal
          markFirstReloadResolving()
          return firstReloadContent
        }
        if (callCount === 2) {
          secondSignal = options?.signal
          markSecondReloadResolving()
          return secondReloadContent
        }
        throw new Error(`Unexpected reload call count: ${callCount}`)
      },
    })

    await clientFrame.ready()

    invariant(reload)

    let firstReloadPromise = reload()
    await firstReloadResolving
    expect(firstSignal?.aborted).toBe(false)

    let secondReloadPromise = reload()
    await secondReloadResolving
    expect(firstSignal?.aborted).toBe(true)
    expect(secondSignal?.aborted).toBe(false)

    resolveFirstReloadContent('<section><p id="reload-value">Stale</p></section>')
    let firstReloadSignal = await firstReloadPromise
    expect(firstReloadSignal).toBe(firstSignal)
    expect(firstReloadSignal.aborted).toBe(true)

    // First reload should be ignored because it was superseded.
    expect(document.getElementById('reload-value')?.textContent).toBe('Initial')

    resolveSecondReloadContent('<section><p id="reload-value">Fresh</p></section>')
    let secondReloadSignal = await secondReloadPromise
    expect(secondReloadSignal).toBe(secondSignal)
    expect(secondReloadSignal.aborted).toBe(false)

    expect(document.getElementById('reload-value')?.textContent).toBe('Fresh')
    clientFrame.dispose()
  })

  it('dispatches reloadStart for each reentered request and completes only the latest', async () => {
    let frameHandle: FrameHandle | undefined
    let events: string[] = []
    let callCount = 0
    let [firstReloadContent, resolveFirstReloadContent] = withResolvers<string>()
    let [secondReloadContent, resolveSecondReloadContent] = withResolvers<string>()

    let ReloadButton = clientEntry(
      '/assets/reload-reentry-events.js#ReloadReentryEvents',
      function ReloadReentryEvents(handle: Handle) {
        frameHandle = handle.frame
        return () => <button id="reload-reentry-events">Reload</button>
      },
    )

    let html = await drain(
      renderToStream(
        <main>
          <Frame src="/reload-reentry-events" fallback={<div>Loading…</div>} />
        </main>,
        {
          async resolveFrame() {
            return await drain(
              renderToStream(
                <section>
                  <p id="reload-value">Initial</p>
                  <ReloadButton />
                </section>,
              ),
            )
          },
        },
      ),
    )
    document.body.innerHTML = html

    let clientFrame = run({
      loadModule(moduleUrl, exportName) {
        if (
          moduleUrl === '/assets/reload-reentry-events.js' &&
          exportName === 'ReloadReentryEvents'
        ) {
          return ReloadButton
        }
        throw new Error(`Unexpected module: ${moduleUrl}#${exportName}`)
      },
      resolveFrame(src: string) {
        if (src !== '/reload-reentry-events') throw new Error(`Unexpected frame src: ${src}`)
        callCount++
        if (callCount === 1) return firstReloadContent
        if (callCount === 2) return secondReloadContent
        throw new Error(`Unexpected reload call count: ${callCount}`)
      },
    })

    await clientFrame.ready()

    invariant(frameHandle)
    frameHandle.addEventListener('reloadStart', () => events.push('start'))
    frameHandle.addEventListener('reloadComplete', () => events.push('complete'))

    let firstReloadPromise = frameHandle.reload()
    let secondReloadPromise = frameHandle.reload()

    resolveFirstReloadContent('<section><p id="reload-value">Stale</p></section>')
    await firstReloadPromise
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(events).toEqual(['start', 'start'])

    resolveSecondReloadContent('<section><p id="reload-value">Fresh</p></section>')
    await secondReloadPromise
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(events).toEqual(['start', 'start', 'complete'])

    expect(document.getElementById('reload-value')?.textContent).toBe('Fresh')

    clientFrame.dispose()
  })

  it('keeps head-like elements inside the frame when a frame reloads', async () => {
    let renderCount = 0
    let reload: undefined | (() => Promise<AbortSignal>)

    let ReloadButton = clientEntry(
      '/assets/reload-head.js#ReloadHead',
      function ReloadHead(handle: Handle) {
        reload = () => handle.frame.reload()
        return () => <button id="reload-head">Reload head</button>
      },
    )

    async function renderHeadFragment() {
      renderCount++
      let stream = renderToStream(
        <>
          <title>Frame title {renderCount}</title>
          <meta name="frame-description" content={`frame-${renderCount}`} />
          <script type="application/ld+json">{`{"count":${renderCount}}`}</script>
          <script type="text/javascript">{`window.__frameRegular = ${renderCount}`}</script>
          <section>
            <p>Frame body {renderCount}</p>
            <ReloadButton />
          </section>
        </>,
      )

      return await drain(stream)
    }

    let stream = renderToStream(
      <main>
        <Frame src="/head-frame" fallback={<div>Loading…</div>} />
      </main>,
      { resolveFrame: renderHeadFragment },
    )

    let html = await drain(stream)
    document.body.innerHTML = html

    let frameId = getCommentMarkerId(html, 'rmx:f:')
    expect(document.querySelector(`template#${frameId}`)).toBeTruthy()

    let clientFrame = run({
      loadModule(moduleUrl, exportName) {
        if (moduleUrl === '/assets/reload-head.js' && exportName === 'ReloadHead')
          return ReloadButton
        throw new Error(`Unexpected module: ${moduleUrl}#${exportName}`)
      },
      resolveFrame: renderHeadFragment,
    })

    await clientFrame.ready()

    let main = document.querySelector('main')
    invariant(main)
    expect(main.querySelector('title')?.textContent).toBe('Frame title 1')
    expect(main.querySelector('meta[name="frame-description"]')?.getAttribute('content')).toBe(
      'frame-1',
    )
    expect(main.querySelector('script[type="application/ld+json"]')?.textContent).toBe(
      '{"count":1}',
    )
    expect(main.querySelector('script[type="text/javascript"]')?.textContent).toBe(
      'window.__frameRegular = 1',
    )
    expect(document.head.querySelector('title')).toBeNull()
    expect(document.head.querySelector('meta[name="frame-description"]')).toBeNull()
    expect(document.head.querySelector('script[type="application/ld+json"]')).toBeNull()

    invariant(reload)
    await reload()

    let titles = main.querySelectorAll('title')
    expect(titles).toHaveLength(1)
    expect(titles[0]?.textContent).toBe('Frame title 2')

    let metas = main.querySelectorAll('meta[name="frame-description"]')
    expect(metas).toHaveLength(1)
    expect(metas[0]?.getAttribute('content')).toBe('frame-2')

    let ldJsonScripts = main.querySelectorAll('script[type="application/ld+json"]')
    expect(ldJsonScripts).toHaveLength(1)
    expect(ldJsonScripts[0]?.textContent).toBe('{"count":2}')
    expect(main.querySelector('script[type="text/javascript"]')?.textContent).toBe(
      'window.__frameRegular = 2',
    )
    expect(document.querySelector('p')?.textContent).toBe('Frame body 2')

    clientFrame.dispose()
  })

  it('hydrates client entries in blocking frame content without redefining virtual roots', async () => {
    let Counter = clientEntry('/js/counter.js#Counter', function Counter() {
      return () => (
        <button id="counter" type="button">
          Count
        </button>
      )
    })

    async function renderInner(): Promise<string> {
      return await drain(renderToStream(<Counter />))
    }

    let stream = renderToStream(
      <main>
        <Frame src="/inner" />
      </main>,
      { resolveFrame: renderInner },
    )

    let html = await drain(stream)
    document.body.innerHTML = html

    let [modulePromise, resolveModule] = withResolvers<Function>()
    let [moduleRequested, markModuleRequested] = withResolvers<void>()
    let loadModule = mock.fn(async () => {
      markModuleRequested()
      return modulePromise
    })
    let clientFrame = run({ loadModule })

    await moduleRequested
    resolveModule(Counter)

    await expect(clientFrame.ready()).resolves.toBeUndefined()

    let button = document.getElementById('counter') as HTMLButtonElement | null
    invariant(button)
    expect(button.textContent).toContain('Count')
    expect(loadModule).toHaveBeenCalled()

    clientFrame.dispose()
  })

  it('hydrates components without waiting for pending frames', async () => {
    let Counter = clientEntry(
      '/js/counter.js#Counter',
      function Counter(handle: Handle<{ initialCount: number }>) {
        let count = handle.props.initialCount
        return () => (
          <button
            id="counter"
            mix={[
              on('click', () => {
                count++
                handle.update()
              }),
            ]}
          >
            Count: {count}
          </button>
        )
      },
    )

    let [framePromise, resolveFramePromise] = withResolvers<string>()

    let stream = renderToStream(
      <div>
        <Counter initialCount={0} />
        <Frame src="/slow" fallback={<span id="frame">Loading…</span>} />
      </div>,
      { resolveFrame: () => framePromise },
    )

    // Get first chunk only (fallback + counter HTML).
    let chunks = readChunks(stream)
    let first = await chunks.next()
    invariant(!first.done)
    document.body.innerHTML = first.value

    // Frame shows fallback.
    expect(document.getElementById('frame')!.textContent).toBe('Loading…')

    let clientFrame = run({
      loadModule: mock.fn(() => Promise.resolve(Counter)),
    })
    await clientFrame.ready()

    // Counter is hydrated and interactive BEFORE frame resolves.
    let button = document.getElementById('counter') as HTMLButtonElement
    expect(button.textContent).toBe('Count: 0')
    button.click()
    clientFrame.flush()
    expect(button.textContent).toBe('Count: 1')

    // Frame still shows fallback.
    expect(document.getElementById('frame')!.textContent).toBe('Loading…')

    // Now resolve the frame and inject the template.
    resolveFramePromise('<span id="frame">Loaded!</span>')
    let second = await chunks.next()
    invariant(!second.done)
    document.body.insertAdjacentHTML('beforeend', second.value)
    await waitForText('#frame', 'Loaded!')

    // Frame is now rendered.
    expect(document.getElementById('frame')!.textContent).toBe('Loaded!')

    // Counter still works.
    button.click()
    clientFrame.flush()
    expect(button.textContent).toBe('Count: 2')

    clientFrame.dispose()
  })

  it('pending frames resolve independently as their templates arrive', async () => {
    let [fastPromise, resolveFast] = withResolvers<string>()
    let [slowPromise, resolveSlow] = withResolvers<string>()

    let stream = renderToStream(
      <div>
        <Frame src="/fast" fallback={<span id="fast">Loading fast…</span>} />
        <Frame src="/slow" fallback={<span id="slow">Loading slow…</span>} />
      </div>,
      {
        resolveFrame(src: string) {
          if (src === '/fast') return fastPromise
          if (src === '/slow') return slowPromise
          throw new Error(`Unexpected frame src: ${src}`)
        },
      },
    )

    // Get the first chunk (both fallbacks).
    let chunks = readChunks(stream)
    let first = await chunks.next()
    invariant(!first.done)
    document.body.innerHTML = first.value

    expect(document.getElementById('fast')!.textContent).toBe('Loading fast…')
    expect(document.getElementById('slow')!.textContent).toBe('Loading slow…')

    let clientFrame = run({ loadModule: mock.fn() })
    await clientFrame.ready()

    // Resolve the fast frame first.
    resolveFast('<span id="fast">Fast loaded</span>')
    let second = await chunks.next()
    invariant(!second.done)
    document.body.insertAdjacentHTML('beforeend', second.value)
    await waitForText('#fast', 'Fast loaded')

    // Fast frame is rendered; slow frame still shows fallback.
    expect(document.getElementById('fast')!.textContent).toBe('Fast loaded')
    expect(document.getElementById('slow')!.textContent).toBe('Loading slow…')

    // Now resolve the slow frame.
    resolveSlow('<span id="slow">Slow loaded</span>')
    let third = await chunks.next()
    invariant(!third.done)
    document.body.insertAdjacentHTML('beforeend', third.value)
    await waitForText('#slow', 'Slow loaded')

    // Both frames are now rendered.
    expect(document.getElementById('fast')!.textContent).toBe('Fast loaded')
    expect(document.getElementById('slow')!.textContent).toBe('Slow loaded')

    clientFrame.dispose()
  })

  it('pending frames resolve while modules are still loading', async () => {
    // Uses manual HTML because renderToStream + readChunks with a deferred
    // loadModule has a timing issue in the Chromium test environment where
    // the hydration markers aren't found by the tree walker.
    let [modulePromise, resolveModule] = withResolvers<Function>()
    let moduleLoaded = false

    function Counter() {
      return () => <button id="counter">Counter</button>
    }

    document.body.innerHTML =
      '<div>' +
      '<!-- rmx:h:h1 --><button id="counter">Counter</button><!-- /rmx:h -->' +
      '<!-- rmx:f:f1 --><span id="frame">Loading…</span><!-- /rmx:f -->' +
      '</div>' +
      '<script type="application/json" id="rmx-data">' +
      '{"h":{"h1":{"moduleUrl":"/counter.js","exportName":"Counter","props":{}}},' +
      '"f":{"f1":{"status":"pending","src":"/slow"}}}' +
      '</script>'

    let [moduleRequested, markModuleRequested] = withResolvers<void>()
    let loadModuleFn = mock.fn(async () => {
      markModuleRequested()
      let mod = await modulePromise
      moduleLoaded = true
      return mod
    })

    let clientFrame = run({ loadModule: loadModuleFn })

    await moduleRequested

    // loadModule must have been called (hydration marker was found).
    expect(loadModuleFn).toHaveBeenCalled()
    expect(moduleLoaded).toBe(false)

    // Frame still shows fallback (template hasn't arrived).
    expect(document.getElementById('frame')!.textContent).toBe('Loading…')

    // Simulate frame template arriving via MutationObserver.
    let template = document.createElement('template')
    template.id = 'f1'
    template.innerHTML = '<span id="frame">Loaded!</span>'
    document.body.appendChild(template)
    await waitForText('#frame', 'Loaded!')

    // Frame rendered even though module hasn't loaded yet.
    expect(document.getElementById('frame')!.textContent).toBe('Loaded!')
    expect(moduleLoaded).toBe(false)

    // Now resolve the module and let hydration complete.
    resolveModule(Counter)
    await clientFrame.ready()

    expect(moduleLoaded).toBe(true)

    clientFrame.dispose()
  })

  it('hydrates a component inside a nested frame', async () => {
    let [counterHydrated, markCounterHydrated] = withResolvers<void>()
    let Counter = clientEntry(
      '/js/counter.js#Counter',
      function Counter(handle: Handle<{ initialCount: number }>) {
        let count = handle.props.initialCount
        handle.queueTask(() => markCounterHydrated())
        return () => (
          <button
            id="nested-counter"
            mix={[
              on('click', () => {
                count++
                handle.update()
              }),
            ]}
          >
            Count: {count}
          </button>
        )
      },
    )

    // Use renderToStream to produce proper HTML for each level.
    let neverResolve = () => new Promise<string>(() => {})

    // Render inner frame content (hydrated Counter).
    let innerContent = await drain(renderToStream(<Counter initialCount={10} />))

    // Render outer frame content (pending inner frame with fallback).
    let outerStream = renderToStream(
      <div>
        <Frame src="/inner" fallback={<span id="inner">Loading inner…</span>} />
      </div>,
      { resolveFrame: neverResolve },
    )
    let outerChunks = readChunks(outerStream)
    let outerFirst = await outerChunks.next()
    invariant(!outerFirst.done)
    let outerContent = outerFirst.value
    let innerFrameId = getCommentMarkerId(outerContent, 'rmx:f:')

    // Render initial page (pending outer frame with fallback).
    let pageStream = renderToStream(
      <div>
        <Frame src="/outer" fallback={<span id="outer">Loading outer…</span>} />
      </div>,
      { resolveFrame: neverResolve },
    )
    let pageChunks = readChunks(pageStream)
    let pageFirst = await pageChunks.next()
    invariant(!pageFirst.done)
    document.body.innerHTML = pageFirst.value
    let outerFrameId = getCommentMarkerId(pageFirst.value, 'rmx:f:')

    let clientFrame = run({
      loadModule: mock.fn(() => Promise.resolve(Counter)),
    })

    await clientFrame.ready()

    // Outer frame still shows fallback.
    expect(document.getElementById('outer')!.textContent).toBe('Loading outer…')

    // Outer frame template arrives.
    let outerTemplate = document.createElement('template')
    outerTemplate.id = outerFrameId
    outerTemplate.innerHTML = outerContent
    document.body.appendChild(outerTemplate)
    await waitForElement('#inner')

    // Outer frame rendered, inner frame shows fallback.
    expect(document.getElementById('inner')!.textContent).toBe('Loading inner…')

    // Inner frame template arrives.
    let innerTemplate = document.createElement('template')
    innerTemplate.id = innerFrameId
    innerTemplate.innerHTML = innerContent
    document.body.appendChild(innerTemplate)
    await counterHydrated

    // Counter inside the nested frame is hydrated and interactive.
    let button = document.getElementById('nested-counter') as HTMLButtonElement
    expect(button.textContent).toBe('Count: 10')
    button.click()
    clientFrame.flush()
    expect(button.textContent).toBe('Count: 11')

    clientFrame.dispose()
  })

  it('preserves parent context for client entries rendered by a frame', async () => {
    let contextEvents = 0

    let ContextProvider = clientEntry(
      '/js/context-provider.js#ContextProvider',
      function ContextProvider(handle: Handle) {
        let context = new EventTarget()
        context.addEventListener('action', () => {
          contextEvents++
        })
        handle.context.set(context)

        return () => <Frame name="context-frame" src="/context-frame" />
      },
    )

    let FrameEntry = clientEntry(
      '/js/frame-entry.js#FrameEntry',
      function FrameEntry(handle: Handle) {
        return () => (
          <button
            id="context-action"
            mix={[
              on('click', () => {
                handle.context.get(ContextProvider)?.dispatchEvent(new Event('action'))
              }),
            ]}
          >
            Dispatch context event
          </button>
        )
      },
    )

    async function renderFrameEntry(): Promise<string> {
      return await renderFrameContent(<FrameEntry />)
    }

    document.body.innerHTML = await drain(
      renderToStream(<ContextProvider />, {
        resolveFrame: renderFrameEntry,
      }),
    )
    contextEvents = 0

    let app = run({
      loadModule(moduleUrl, exportName) {
        if (moduleUrl === '/js/context-provider.js' && exportName === 'ContextProvider') {
          return ContextProvider
        }
        if (moduleUrl === '/js/frame-entry.js' && exportName === 'FrameEntry') {
          return FrameEntry
        }
        throw new Error(`Unexpected module: ${moduleUrl}#${exportName}`)
      },
      resolveFrame: renderFrameEntry,
    })

    await app.ready()

    let action = document.getElementById('context-action')
    invariant(action)
    action.click()
    expect(contextEvents).toBe(1)

    let contextFrame = app.frames.get('context-frame')
    invariant(contextFrame)
    await contextFrame.reload()

    action = document.getElementById('context-action')
    invariant(action)
    action.click()
    expect(contextEvents).toBe(2)

    app.dispose()
  })

  it('preserves setup-time context when a frame provider module loads after its consumer', async (t) => {
    let contextEvents = 0
    let independentClicks = 0
    let ContextProvider = clientEntry(
      '/js/slow-context-provider.js#ContextProvider',
      function ContextProvider(handle: Handle<Record<string, never>, EventTarget>) {
        let context = new EventTarget()
        context.addEventListener('action', () => {
          contextEvents++
        })
        handle.context.set(context)
        return () => (
          <section>
            <Frame src="/context-frame" />
          </section>
        )
      },
    )
    let FrameEntry = clientEntry(
      '/js/setup-context-entry.js#FrameEntry',
      function FrameEntry(handle: Handle) {
        let context = handle.context.get(ContextProvider)
        return () => (
          <button
            id="setup-context-action"
            mix={on('click', () => context?.dispatchEvent(new Event('action')))}
          >
            Dispatch context event
          </button>
        )
      },
    )

    let [independentHydrated, markIndependentHydrated] = withResolvers<void>()
    let IndependentEntry = clientEntry(
      '/js/independent.js#IndependentEntry',
      function IndependentEntry(handle: Handle) {
        handle.queueTask(() => markIndependentHydrated())
        return () => (
          <button
            id="independent-action"
            mix={on('click', () => {
              independentClicks++
            })}
          >
            Independent action
          </button>
        )
      },
    )

    document.body.innerHTML = await drain(
      renderToStream(
        <>
          <ContextProvider />
          <Frame src="/independent-frame" />
        </>,
        {
          resolveFrame(src) {
            if (src === '/context-frame') return renderFrameContent(<FrameEntry />)
            if (src === '/independent-frame') return renderFrameContent(<IndependentEntry />)
            throw new Error(`Unexpected frame src: ${src}`)
          },
        },
      ),
    )

    let [providerModule, resolveProviderModule] = withResolvers<typeof ContextProvider>()
    let [providerRequested, markProviderRequested] = withResolvers<void>()
    let app = run({
      loadModule(moduleUrl, exportName) {
        if (moduleUrl === '/js/slow-context-provider.js' && exportName === 'ContextProvider') {
          markProviderRequested()
          return providerModule
        }
        if (moduleUrl === '/js/setup-context-entry.js' && exportName === 'FrameEntry') {
          return FrameEntry
        }
        if (moduleUrl === '/js/independent.js' && exportName === 'IndependentEntry') {
          return IndependentEntry
        }
        throw new Error(`Unexpected module: ${moduleUrl}#${exportName}`)
      },
    })
    t.after(() => app.dispose())

    await providerRequested
    // Let the immediately available consumer hydrate while the provider import is pending.
    await independentHydrated
    let independentAction = document.getElementById('independent-action')
    invariant(independentAction instanceof HTMLButtonElement)
    independentAction.click()
    expect(independentClicks).toBe(1)

    resolveProviderModule(ContextProvider)
    await app.ready()

    let action = document.getElementById('setup-context-action')
    invariant(action instanceof HTMLButtonElement)
    action.click()
    expect(contextEvents).toBe(1)
  })

  it('hydrates nested frame content when its owning client entry module is already cached', async (t) => {
    let clicks = 0
    let FrameOwner = clientEntry(
      '/js/cached-frame-owner.js#FrameOwner',
      function FrameOwner(handle: Handle<{ src: string }, string>) {
        handle.context.set(handle.props.src)
        return () => <Frame src={handle.props.src} />
      },
    )
    let FrameButton = clientEntry(
      '/js/frame-button.js#FrameButton',
      function FrameButton(handle: Handle) {
        let src = handle.context.get(FrameOwner)
        return () => (
          <button
            id="cached-frame-button"
            mix={on('click', () => {
              clicks++
            })}
          >
            {src}
          </button>
        )
      },
    )

    async function resolveFrame(src: string): Promise<string> {
      if (src === '/outer') {
        return await drain(renderToStream(<FrameOwner src="/inner" />, { resolveFrame }))
      }
      if (src === '/inner') return await renderFrameContent(<FrameButton />)
      throw new Error(`Unexpected frame src: ${src}`)
    }

    document.body.innerHTML = await drain(
      renderToStream(<FrameOwner src="/outer" />, { resolveFrame }),
    )

    let app = run({
      loadModule(moduleUrl, exportName) {
        if (moduleUrl === '/js/cached-frame-owner.js' && exportName === 'FrameOwner') {
          return FrameOwner
        }
        if (moduleUrl === '/js/frame-button.js' && exportName === 'FrameButton') {
          return FrameButton
        }
        throw new Error(`Unexpected module: ${moduleUrl}#${exportName}`)
      },
      resolveFrame,
    })
    t.after(() => app.dispose())

    await app.ready()

    let button = document.getElementById('cached-frame-button')
    invariant(button instanceof HTMLButtonElement)
    expect(button.textContent).toBe('/inner')
    button.click()
    expect(clicks).toBe(1)
  })

  it('deeply nested frames resolve independently at each level', async () => {
    // Page has outer frame → outer has middle frame → middle has inner frame.
    // Each level resolves independently via MutationObserver.
    let neverResolve = () => new Promise<string>(() => {})

    // Render inner content (leaf — no sub-frames).
    let innerContent = await drain(renderToStream(<p id="inner-content">Inner loaded</p>))

    // Render middle content (pending inner frame with fallback).
    let middleStream = renderToStream(
      <div>
        <p id="middle-content">Middle loaded</p>
        <Frame src="/inner" fallback={<span id="inner">Loading inner…</span>} />
      </div>,
      { resolveFrame: neverResolve },
    )
    let middleChunks = readChunks(middleStream)
    let middleFirst = await middleChunks.next()
    invariant(!middleFirst.done)
    let middleContent = middleFirst.value
    let innerFrameId = getCommentMarkerId(middleContent, 'rmx:f:')

    // Render outer content (pending middle frame with fallback).
    let outerStream = renderToStream(
      <div>
        <p id="outer-content">Outer loaded</p>
        <Frame src="/middle" fallback={<span id="middle">Loading middle…</span>} />
      </div>,
      { resolveFrame: neverResolve },
    )
    let outerChunks = readChunks(outerStream)
    let outerFirst = await outerChunks.next()
    invariant(!outerFirst.done)
    let outerContent = outerFirst.value
    let middleFrameId = getCommentMarkerId(outerContent, 'rmx:f:')

    // Render initial page (pending outer frame with fallback).
    let pageStream = renderToStream(
      <div>
        <h1 id="title">Page</h1>
        <Frame src="/outer" fallback={<span id="outer">Loading outer…</span>} />
      </div>,
      { resolveFrame: neverResolve },
    )
    let pageChunks = readChunks(pageStream)
    let pageFirst = await pageChunks.next()
    invariant(!pageFirst.done)
    document.body.innerHTML = pageFirst.value
    let outerFrameId = getCommentMarkerId(pageFirst.value, 'rmx:f:')

    let clientFrame = run({ loadModule: mock.fn() })
    await clientFrame.ready()

    // Page content is visible, outer frame shows fallback.
    expect(document.getElementById('title')!.textContent).toBe('Page')
    expect(document.getElementById('outer')!.textContent).toBe('Loading outer…')

    // Outer frame template arrives — contains a middle frame.
    let outerTemplate = document.createElement('template')
    outerTemplate.id = outerFrameId
    outerTemplate.innerHTML = outerContent
    document.body.appendChild(outerTemplate)
    await waitForElement('#outer-content')

    // Outer content rendered, middle shows fallback.
    expect(document.getElementById('outer-content')!.textContent).toBe('Outer loaded')
    expect(document.getElementById('middle')!.textContent).toBe('Loading middle…')

    // Middle frame template arrives — contains an inner frame.
    let middleTemplate = document.createElement('template')
    middleTemplate.id = middleFrameId
    middleTemplate.innerHTML = middleContent
    document.body.appendChild(middleTemplate)
    await waitForElement('#middle-content')

    // Middle content rendered, inner shows fallback.
    expect(document.getElementById('middle-content')!.textContent).toBe('Middle loaded')
    expect(document.getElementById('inner')!.textContent).toBe('Loading inner…')

    // Inner frame template arrives.
    let innerTemplate = document.createElement('template')
    innerTemplate.id = innerFrameId
    innerTemplate.innerHTML = innerContent
    document.body.appendChild(innerTemplate)
    await waitForElement('#inner-content')

    // All three levels rendered.
    expect(document.getElementById('outer-content')!.textContent).toBe('Outer loaded')
    expect(document.getElementById('middle-content')!.textContent).toBe('Middle loaded')
    expect(document.getElementById('inner-content')!.textContent).toBe('Inner loaded')

    // Page content preserved throughout.
    expect(document.getElementById('title')!.textContent).toBe('Page')

    clientFrame.dispose()
  })

  it('reloads a frame that is nested inside another frame', async () => {
    let reloadInner: undefined | (() => Promise<AbortSignal>)
    let renderCount = 0
    let [reloadButtonHydrated, markReloadButtonHydrated] = withResolvers<void>()

    let ReloadButton = clientEntry(
      '/js/reload.js#ReloadButton',
      function ReloadButton(handle: Handle) {
        reloadInner = () => handle.frame.reload()
        handle.queueTask(() => markReloadButtonHydrated())
        return () => <button id="reload-btn">Reload</button>
      },
    )

    async function renderInner() {
      renderCount++
      return await drain(
        renderToStream(
          <div>
            <p id="inner-text">Render {renderCount}</p>
            <ReloadButton />
          </div>,
        ),
      )
    }

    // Render outer content with a pending inner frame.
    let outerStream = renderToStream(
      <div>
        <p id="outer-text">Outer</p>
        <Frame src="/inner" fallback={<span id="inner-fallback">Loading…</span>} />
      </div>,
      { resolveFrame: () => new Promise<string>(() => {}) },
    )
    let outerChunks = readChunks(outerStream)
    let outerFirst = await outerChunks.next()
    invariant(!outerFirst.done)
    let outerContent = outerFirst.value
    let innerFrameId = getCommentMarkerId(outerContent, 'rmx:f:')

    // Render page with a blocking outer frame that resolves to the outer content.
    let pageStream = renderToStream(
      <div>
        <Frame src="/outer" />
      </div>,
      { resolveFrame: () => outerContent },
    )
    let pageHtml = await drain(pageStream)
    document.body.innerHTML = pageHtml

    let clientFrame = run({
      loadModule: mock.fn(() => Promise.resolve(ReloadButton)),
      resolveFrame: renderInner,
    })

    await clientFrame.ready()

    // Outer is resolved, inner shows fallback.
    expect(document.getElementById('outer-text')!.textContent).toBe('Outer')
    expect(document.getElementById('inner-fallback')!.textContent).toBe('Loading…')

    // Inner frame template arrives.
    let innerTemplate = document.createElement('template')
    innerTemplate.id = innerFrameId
    innerTemplate.innerHTML = await renderInner()
    document.body.appendChild(innerTemplate)
    await reloadButtonHydrated

    // Inner frame rendered with hydrated ReloadButton.
    expect(document.getElementById('inner-text')!.textContent).toBe('Render 1')
    invariant(reloadInner)

    // Reload the inner frame — only the inner frame should update.
    await reloadInner()

    expect(document.getElementById('inner-text')!.textContent).toBe('Render 2')
    expect(document.getElementById('outer-text')!.textContent).toBe('Outer')

    clientFrame.dispose()
  })

  it('hydrates lazy frames near the viewport once without blocking app.ready()', async (t) => {
    let requests: string[] = []
    let { app, host } = await setupLazyFrame(
      t,
      (src) => {
        requests.push(src)
        return '<p id="lazy-content">Loaded</p>'
      },
      { mode: 'server' },
    )
    expect(requests).toEqual([])
    expect(host.textContent).toBe('Waiting')
    expect(host.children.length).toBe(1)
    expect(host.firstElementChild?.tagName).toBe('P')
    expect(app.frames.get('lazy')?.src).toBe('/lazy')

    let loaded = waitForElement('#lazy-content')
    host.style.top = '0'
    await loaded
    expect(requests).toEqual(['/lazy'])
    expect(host.textContent).toBe('Loaded')

    host.style.top = '100000px'
    await waitForIntersection(host)
    host.style.top = '0'
    await waitForIntersection(host)
    expect(requests).toEqual(['/lazy'])
  })

  it('loads lazy frames within one viewport height or width of the visible area', async (t) => {
    let requests: string[] = []
    let root = createRoot(container, {
      frameInit: {
        resolveFrame(src) {
          requests.push(src)
          return `<p id="${src.slice(1)}">Loaded</p>`
        },
      },
    })
    t.after(() => root.dispose())
    root.render(
      <>
        <section
          id="vertical-host"
          mix={css({ position: 'fixed', top: window.innerHeight * 2 + 50, left: 0 })}
        >
          <Frame src="/vertical-content" loading="lazy" fallback={<p>Waiting</p>} />
        </section>
        <section
          id="horizontal-host"
          mix={css({ position: 'fixed', top: 0, left: window.innerWidth * 2 + 50 })}
        >
          <Frame src="/horizontal-content" loading="lazy" fallback={<p>Waiting</p>} />
        </section>
      </>,
    )
    root.flush()
    let vertical = document.getElementById('vertical-host')
    let horizontal = document.getElementById('horizontal-host')
    invariant(vertical && horizontal)
    await waitForIntersection(vertical)
    expect(requests).toEqual([])

    let verticalLoaded = waitForElement('#vertical-content')
    vertical.style.top = `${window.innerHeight * 2 - 50}px`
    await verticalLoaded
    expect(requests).toEqual(['/vertical-content'])

    let horizontalLoaded = waitForElement('#horizontal-content')
    horizontal.style.left = `${window.innerWidth * 2 - 50}px`
    await horizontalLoaded
    expect(requests).toEqual(['/vertical-content', '/horizontal-content'])
  })

  it('warns and loads a client-created lazy frame without a fallback immediately', async (t) => {
    container.style.cssText = 'position:fixed;top:100000px;left:0'
    let warn = t.mock.method(console, 'warn', () => {})
    let response = Promise.withResolvers<string>()
    let resolveFrame = mock.fn(() => response.promise)
    let root = createRoot(container, { frameInit: { resolveFrame } })
    t.after(() => root.dispose())
    root.render(jsx(Frame, { src: '/empty', loading: 'lazy' }))
    root.flush()
    await waitForIntersection(container)
    expect(resolveFrame).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]?.arguments).toEqual([
      'Frame with loading="lazy" requires a fallback that renders an element. Loading "/empty" immediately.',
    ])
    expect(container.children.length).toBe(0)

    let loaded = waitForElement('#empty-content')
    response.resolve('<p id="empty-content">Loaded</p>')
    await loaded
    expect(container.children.length).toBe(1)
  })

  it('warns and loads a hydrated lazy frame with a text-only fallback immediately', async (t) => {
    function Fallback() {
      return () => 'Waiting'
    }
    document.body.innerHTML = await drain(
      renderToStream(
        <section id="lazy-host">
          <Frame src="/text" loading="lazy" fallback={<Fallback />} />
        </section>,
      ),
    )
    let host = document.getElementById('lazy-host')
    invariant(host)
    host.style.cssText = 'position:fixed;top:100000px;left:0'
    let warn = t.mock.method(console, 'warn', () => {})
    let response = Promise.withResolvers<string>()
    let resolveFrame = mock.fn(() => response.promise)
    let app = run({ loadModule: mock.fn(), resolveFrame })
    t.after(() => app.dispose())
    await app.ready()
    expect(resolveFrame).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]?.arguments).toEqual([
      'Frame with loading="lazy" requires a fallback that renders an element. Loading "/text" immediately.',
    ])
    expect(host.textContent).toBe('Waiting')
    expect(host.children.length).toBe(0)

    let loaded = waitForElement('#text-content')
    response.resolve('<p id="text-content">Loaded</p>')
    await loaded
    expect(host.textContent).toBe('Loaded')
  })

  it('warns and loads a lazy frame when its fallback stops rendering elements', async (t) => {
    container.style.cssText = 'position:fixed;top:100000px;left:0'
    let warn = t.mock.method(console, 'warn', () => {})
    let fallback: Handle | undefined
    let visible = true
    function Fallback(handle: Handle) {
      fallback = handle
      return () => (visible ? <p>Waiting</p> : null)
    }
    let resolveFrame = mock.fn(() => '<p id="removed-fallback-content">Loaded</p>')
    let root = createRoot(container, { frameInit: { resolveFrame } })
    t.after(() => root.dispose())
    root.render(<Frame src="/removed-fallback" loading="lazy" fallback={<Fallback />} />)
    root.flush()
    await waitForIntersection(container)
    expect(resolveFrame).not.toHaveBeenCalled()
    expect(warn.mock.calls.length).toBe(0)
    invariant(fallback)
    let loaded = waitForElement('#removed-fallback-content')
    visible = false
    await fallback.update()
    await waitForIntersection(container)
    expect(resolveFrame).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls.length).toBe(1)
    await loaded
  })

  it('debounces viewport changes before updating the lazy frame loading boundary', async (t) => {
    let originalHeight = Object.getOwnPropertyDescriptor(window, 'innerHeight')
    invariant(originalHeight)
    t.after(() => Object.defineProperty(window, 'innerHeight', originalHeight))
    container.style.cssText = `position:fixed;top:${window.innerHeight * 2.5}px;left:0`
    let resolveFrame = mock.fn(() => '<p id="resized-content">Loaded</p>')
    let root = createRoot(container, { frameInit: { resolveFrame } })
    t.after(() => root.dispose())
    let observe = t.mock.method(IntersectionObserver.prototype, 'observe')
    root.render(<Frame src="/resized-content" loading="lazy" fallback={<p>Waiting</p>} />)
    root.flush()
    await waitForIntersection(container)
    expect(resolveFrame).not.toHaveBeenCalled()

    let loaded = waitForElement('#resized-content')
    let observationCount = observe.mock.calls.length
    let timers = t.useFakeTimers()
    Object.defineProperty(window, 'innerHeight', { value: window.innerHeight * 2 })
    window.dispatchEvent(new Event('resize'))
    timers.advance(50)
    window.dispatchEvent(new Event('resize'))
    timers.advance(99)
    expect(observe.mock.calls.length).toBe(observationCount)
    timers.advance(1)
    expect(observe.mock.calls.length).toBe(observationCount + 1)
    timers.restore()
    await loaded
    expect(resolveFrame).toHaveBeenCalledTimes(1)
  })

  it('shares a visibility observer and cleans up loaded, removed, and disposed lazy frames', async (t) => {
    let OriginalObserver = globalThis.IntersectionObserver
    let observers: IntersectionObserver[] = []
    globalThis.IntersectionObserver = class extends OriginalObserver {
      constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
        super(callback, options)
        observers.push(this)
      }
    }
    t.after(() => {
      globalThis.IntersectionObserver = OriginalObserver
    })
    let firstHost = document.createElement('section')
    let secondHost = document.createElement('section')
    let removedHost = document.createElement('section')
    firstHost.style.cssText =
      secondHost.style.cssText =
      removedHost.style.cssText =
        'position:fixed;top:100000px;left:0'
    container.append(firstHost, secondHost, removedHost)
    let requests: string[] = []
    let frameInit = {
      resolveFrame(src: string) {
        requests.push(src)
        return `<p id="${src.slice(1)}">Loaded</p>`
      },
    }
    let first = createRoot(firstHost, { frameInit })
    let second = createRoot(secondHost, { frameInit })
    let removed = createRoot(removedHost, { frameInit })
    t.after(() => {
      first.dispose()
      second.dispose()
      removed.dispose()
    })
    first.render(<Frame src="/first" loading="lazy" fallback={<p>First</p>} />)
    second.render(<Frame src="/second" loading="lazy" fallback={<p>Second</p>} />)
    removed.render(<Frame src="/removed" loading="lazy" fallback={<p>Removed</p>} />)
    first.flush()
    second.flush()
    removed.flush()
    expect(observers.length).toBe(1)
    let observer = observers[0]
    invariant(observer)
    let disconnect = t.mock.method(observer, 'disconnect')

    let firstLoaded = waitForElement('#first')
    firstHost.style.top = '0'
    await firstLoaded
    expect(requests).toEqual(['/first'])
    expect(disconnect).not.toHaveBeenCalled()

    removed.render(null)
    removed.flush()
    expect(removedHost.childNodes.length).toBe(0)
    removed.render(<Frame src="/disposed" loading="lazy" fallback={<p>Disposed</p>} />)
    removed.flush()
    removed.dispose()
    removedHost.style.top = '0'
    expect(disconnect).not.toHaveBeenCalled()
    let secondLoaded = waitForElement('#second')
    secondHost.style.top = '0'
    await secondLoaded
    expect(requests).toEqual(['/first', '/second'])
    expect(observers.length).toBe(1)
    expect(disconnect).toHaveBeenCalledTimes(1)
  })

  it('loads a lazy frame after its fallback component replaces the observed element', async (t) => {
    container.style.cssText = 'position:fixed;top:100000px;left:0'
    let fallback: Handle | undefined
    let swapped = false
    function Fallback(handle: Handle) {
      fallback = handle
      return () => (swapped ? <section>Waiting</section> : <p>Waiting</p>)
    }
    let resolveFrame = mock.fn(() => '<p id="updated-fallback-content">Loaded</p>')
    let root = createRoot(container, { frameInit: { resolveFrame } })
    t.after(() => root.dispose())
    root.render(<Frame src="/lazy" loading="lazy" fallback={<Fallback />} />)
    root.flush()
    await waitForIntersection(container)
    invariant(fallback)
    swapped = true
    await fallback.update()
    expect(container.querySelector('section')?.textContent).toBe('Waiting')
    expect(resolveFrame).not.toHaveBeenCalled()

    container.style.top = '0'
    await waitForIntersection(container)
    expect(resolveFrame).toHaveBeenCalledTimes(1)
    expect(container.querySelector('#updated-fallback-content')?.textContent).toBe('Loaded')
  })

  it('restarts a pending client-created lazy frame during an ancestor reload', async (t) => {
    await assertPendingLazyFrameRestart(t)
  })

  it('restarts a pending hydrated lazy frame during an ancestor reload', async (t) => {
    await assertPendingLazyFrameRestart(t, 'hydrated')
  })

  it('updates a deferred client frame source and loads when changed to eager', async (t) => {
    container.style.cssText = 'position:fixed;top:100000px;left:0'
    let requests: string[] = []
    let root = createRoot(container, {
      frameInit: {
        resolveFrame(src) {
          requests.push(src)
          return '<p id="eager-content">Loaded</p>'
        },
      },
    })
    t.after(() => root.dispose())
    root.render(<Frame src="/old" loading="lazy" fallback={<p>First</p>} />)
    root.flush()
    await waitForIntersection(container)
    root.render(<Frame src="/new" loading="lazy" fallback={<p>Second</p>} />)
    root.flush()
    await waitForIntersection(container)
    expect(requests).toEqual([])
    expect(container.textContent).toBe('Second')

    let loaded = waitForElement('#eager-content')
    root.render(<Frame src="/new" loading="eager" fallback="Second" />)
    root.flush()
    await loaded
    expect(requests).toEqual(['/new'])
  })

  it('loads an offscreen lazy frame immediately for an explicit reload', async (t) => {
    let requests: string[] = []
    let { frame, host } = await setupLazyFrame(
      t,
      (src) => {
        requests.push(src)
        return '<p>Explicitly loaded</p>'
      },
      { mode: 'server' },
    )
    await frame.reload()
    expect(host.textContent).toBe('Explicitly loaded')
    host.style.top = '0'
    await waitForIntersection(host)
    expect(requests).toEqual(['/lazy'])
  })

  it('preserves explicitly reloaded lazy frame content through parent updates', async (t) => {
    container.style.cssText = 'position:fixed;top:100000px;left:0'
    let parent: Handle | undefined
    function Entry(handle: Handle) {
      parent = handle
      return () => <Frame name="lazy" src="/lazy" loading="lazy" fallback={<p>Waiting</p>} />
    }
    let response = Promise.withResolvers<string>()
    let root = createRoot(container, { frameInit: { resolveFrame: () => response.promise } })
    t.after(() => root.dispose())
    root.render(<Entry />)
    root.flush()
    invariant(parent)
    let frame = parent.frames.get('lazy')
    invariant(frame)

    let reloaded = frame.reload()
    expect(container.textContent).toBe('Waiting')
    response.resolve('<p id="reloaded-content">Loaded</p>')
    await reloaded
    expect(container.querySelector('#reloaded-content')?.textContent).toBe('Loaded')

    await parent.update()
    expect(container.querySelector('#reloaded-content')?.textContent).toBe('Loaded')
  })

  it('loads a lazy frame when a large fallback overlaps the viewport', async (t) => {
    container.style.cssText = 'position:fixed;top:-50000px;left:0'
    let resolveFrame = mock.fn(() => '<p id="large-lazy-content">Loaded</p>')
    let root = createRoot(container, { frameInit: { resolveFrame } })
    t.after(() => root.dispose())
    let loaded = waitForElement('#large-lazy-content')
    root.render(<Frame src="/large" loading="lazy" fallback={<p>Waiting</p>} />)
    root.flush()
    await waitForIntersection(container)
    expect(resolveFrame).not.toHaveBeenCalled()
    root.render(
      <Frame
        src="/large"
        loading="lazy"
        fallback={<section mix={css({ height: '100000px' })}>Waiting</section>}
      />,
    )
    root.flush()
    await loaded
    expect(resolveFrame).toHaveBeenCalledTimes(1)
  })

  it('does not restart a lazy load after replacement during fallback hydration', async (t) => {
    let Fallback = clientEntry('/fallback.js#Fallback', function Fallback() {
      return () => <p>Waiting</p>
    })
    document.body.innerHTML = await drain(
      renderToStream(<Frame name="lazy" src="/lazy" loading="lazy" fallback={<Fallback />} />),
    )
    let requested = Promise.withResolvers<void>()
    let module = Promise.withResolvers<typeof Fallback>()
    let resolveFrame = mock.fn(() => '<p>Unexpected request</p>')
    let app = run({
      async loadModule() {
        requested.resolve()
        return await module.promise
      },
      resolveFrame,
    })
    t.after(() => app.dispose())
    await requested.promise
    let frame = app.frames.get('lazy')
    invariant(frame)
    await frame.replace('<p id="replacement">Replacement</p>')
    module.resolve(Fallback)
    await app.ready()
    await waitForIntersection(document.body)
    await waitForIntersection(document.body)
    expect(resolveFrame).not.toHaveBeenCalled()
    expect(document.getElementById('replacement')?.textContent).toBe('Replacement')
  })

  it('starts an eager load while a server-rendered lazy fallback is still hydrating', async (t) => {
    let loading: 'lazy' | 'eager' = 'lazy'
    let update: (() => void) | undefined
    let Fallback = clientEntry('/fallback.js#Fallback', function Fallback() {
      return () => <p>Waiting</p>
    })
    let Entry = clientEntry('/entry.js#Entry', function Entry(handle: Handle) {
      update = () => void handle.update()
      return () => <Frame src="/lazy" loading={loading} fallback={<Frame src="/fallback" />} />
    })
    document.body.innerHTML = await drain(
      renderToStream(<Entry />, { resolveFrame: () => renderToStream(<Fallback />) }),
    )
    let requested = Promise.withResolvers<void>()
    let module = Promise.withResolvers<typeof Fallback>()
    let resolveFrame = mock.fn(() => '<p id="eager-content">Loaded</p>')
    let app = run({
      async loadModule(url) {
        if (url === '/entry.js') return Entry
        requested.resolve()
        return await module.promise
      },
      resolveFrame,
    })
    t.after(() => {
      module.resolve(Fallback)
      app.dispose()
    })
    await app.ready()
    await requested.promise
    invariant(update)
    loading = 'eager'
    update()
    app.flush()
    await waitForIntersection(document.body)
    expect(resolveFrame).toHaveBeenCalledTimes(1)
    expect(document.getElementById('eager-content')?.textContent).toBe('Loaded')
  })

  it('loads lazy frames eagerly when IntersectionObserver is unavailable', async (t) => {
    let original = globalThis.IntersectionObserver
    Object.defineProperty(globalThis, 'IntersectionObserver', { value: undefined })
    t.after(() => {
      globalThis.IntersectionObserver = original
    })
    let resolveFrame = mock.fn(() => '<p id="unsupported-lazy-content">Loaded</p>')
    let root = createRoot(container, { frameInit: { resolveFrame } })
    t.after(() => root.dispose())
    let loaded = waitForElement('#unsupported-lazy-content')
    root.render(<Frame src="/lazy" loading="lazy" fallback={<p>Waiting</p>} />)
    root.flush()
    await loaded
    expect(resolveFrame).toHaveBeenCalledTimes(1)
  })

  it('keeps lazy frames deferred and refreshes loaded content without blocking ancestor reloads', async (t) => {
    let fallback = <p>Waiting</p>
    let renderPage = () =>
      renderDocumentContent(
        <section id="lazy-host" mix={css({ position: 'fixed', top: '100000px', left: 0 })}>
          <Frame name="lazy" src="/lazy" loading="lazy" fallback={fallback} />
        </section>,
      )
    document.documentElement.innerHTML = await renderPage()
    let requests: string[] = []
    let refresh = Promise.withResolvers<string>()
    let app = run({
      loadModule: mock.fn(),
      resolveFrame(src) {
        requests.push(src)
        if (src !== '/lazy') return renderPage()
        return requests.filter((request) => request === '/lazy').length === 1
          ? '<p id="lazy-content">Loaded</p>'
          : refresh.promise
      },
    })
    t.after(() => app.dispose())
    await app.ready()
    let frame = app.frames.get('lazy')
    invariant(frame)
    let events: string[] = []
    frame.addEventListener('reloadStart', () => events.push('start'))
    frame.addEventListener('reloadComplete', () => events.push('complete'))
    fallback = <span>Waiting</span>
    await app.frames.top.reload({ src: '/page' })
    let host = document.getElementById('lazy-host')
    invariant(host)
    await waitForIntersection(host)
    expect(requests).toEqual(['/page'])
    expect(host.textContent).toBe('Waiting')
    expect(events).toEqual(['start', 'complete'])

    let loaded = waitForElement('#lazy-content')
    host.style.top = '0'
    await loaded
    await waitForIntersection(host)
    expect(events).toEqual(['start', 'complete'])
    await app.frames.top.reload()
    expect(document.getElementById('lazy-host')?.textContent).toBe('Loaded')
    expect(requests).toEqual(['/page', '/lazy', '/page', '/lazy'])
    expect(events).toEqual(['start', 'complete', 'start'])

    let refreshed = new Promise<void>((resolve) => {
      frame.addEventListener('reloadComplete', () => resolve(), { once: true })
    })
    refresh.resolve('<p id="refreshed-content">Refreshed</p>')
    await refreshed
    expect(document.getElementById('lazy-host')?.textContent).toBe('Refreshed')
    expect(events).toEqual(['start', 'complete', 'start', 'complete'])
  })

  it('restarts a pending server-rendered lazy frame during an ancestor reload', async (t) => {
    await assertPendingLazyFrameRestart(t, 'server')
  })

  it('supersedes a pending lazy request with inline eager SSR content', async (t) => {
    await assertEagerSsrTakeover(t, false)
  })

  it('supersedes a pending lazy request with streamed eager SSR content', async (t) => {
    await assertEagerSsrTakeover(t, true)
  })

  it('transfers an explicit lazy reload to eager SSR without duplicating reload events', async (t) => {
    await assertEagerSsrTakeover(t, true, true)
  })

  it('restarts a settled aborted server lazy load when the next ancestor response arrives', async (t) => {
    await assertSettledLazyFrameRestart(t, 'server')
  })

  it('restarts a settled aborted client-created lazy load when the next ancestor response arrives', async (t) => {
    await assertSettledLazyFrameRestart(t, 'client')
  })

  it('restarts a settled aborted hydrated lazy load when the next ancestor response arrives', async (t) => {
    await assertSettledLazyFrameRestart(t, 'hydrated')
  })

  it('resumes an aborted server lazy load after the ancestor reload fails', async (t) => {
    await assertSettledLazyFrameRestart(t, 'server', { failAncestor: true })
  })

  it('resumes an aborted client-created lazy load after the ancestor reload fails', async (t) => {
    await assertSettledLazyFrameRestart(t, 'client', { failAncestor: true })
  })

  it('preempts an initial client-created lazy request with an explicit reload', async (t) => {
    await assertLazyReloadPreemption(t, 'client')
  })

  it('keeps an explicit reload from rearming an aborted client-created lazy request', async (t) => {
    await assertLazyReloadPreemption(t, 'client', { ancestorReload: true })
  })

  it('keeps an explicit reload from rearming an aborted hydrated lazy request', async (t) => {
    await assertLazyReloadPreemption(t, 'hydrated', { ancestorReload: true })
  })

  it('resumes a deferred client-created lazy frame after an aborted targeted navigation', async (t) => {
    let requests: Array<{
      src: string
      signal: AbortSignal
      response: ReturnType<typeof Promise.withResolvers<string>>
    }> = []
    let { frame, host } = await setupLazyFrame(t, (src, options) => {
      invariant(options?.signal)
      let { signal } = options
      let response = Promise.withResolvers<string>()
      signal.addEventListener('abort', () => response.reject(signal.reason), { once: true })
      requests.push({ src, signal, response })
      return response.promise
    })
    expect(requests.length).toBe(0)
    let events: string[] = []
    frame.addEventListener('reloadStart', () => events.push('start'))
    frame.addEventListener('reloadComplete', () => events.push('complete'))

    frame.src = '/targeted'
    let controller = new AbortController()
    let navigation = reloadFrameForNavigation(frame, { signal: controller.signal })
    expect(requests.length).toBe(1)
    controller.abort()
    await navigation.finished
    expect(requests[0]?.signal.aborted).toBe(true)
    expect(events).toEqual(['start', 'complete'])

    host.style.top = '0'
    await waitForIntersection(host)
    expect(requests.length).toBe(2)
    expect(requests[1]?.src).toBe('/targeted')
    expect(requests[1]?.signal.aborted).toBe(false)
    let loaded = waitForElement('#recovered-lazy-content')
    requests[1]?.response.resolve('<p id="recovered-lazy-content">Recovered</p>')
    await loaded
    await waitForIntersection(host)
    expect(host.textContent).toContain('Recovered')
    expect(events).toEqual(['start', 'complete'])
  })

  it('does not resume lazy observation after a frame changes to eager', async (t) => {
    container.style.cssText = 'position:fixed;top:100000px;left:0'
    let loading: 'lazy' | 'eager' = 'lazy'
    let parent: Handle | undefined
    function Entry(handle: Handle) {
      parent = handle
      return () => <Frame name="lazy" src="/lazy" loading={loading} fallback={<p>Waiting</p>} />
    }
    let requests: AbortSignal[] = []
    let root = createRoot(container, {
      frameInit: {
        resolveFrame(_src, options) {
          invariant(options?.signal)
          let { signal } = options
          requests.push(signal)
          return new Promise<string>((_resolve, reject) => {
            signal.addEventListener('abort', () => reject(signal.reason), { once: true })
          })
        },
      },
    })
    t.after(() => root.dispose())
    root.render(<Entry />)
    root.flush()
    invariant(parent)
    let frame = parent.frames.get('lazy')
    invariant(frame)

    loading = 'eager'
    await parent.update()
    expect(requests.length).toBe(1)
    let controller = new AbortController()
    let navigation = reloadFrameForNavigation(frame, { signal: controller.signal })
    expect(requests.length).toBe(2)
    controller.abort()
    await navigation.finished

    container.style.top = '0'
    await waitForIntersection(container)
    expect(requests.length).toBe(2)
    expect(requests.every((signal) => signal.aborted)).toBe(true)
  })

  it('preserves a lazy fallback when navigation aborts before the first streamed content', async (t) => {
    let reading = Promise.withResolvers<void>()
    let stream = new ReadableStream<Uint8Array>({
      pull() {
        if (stream.locked) reading.resolve()
      },
    })
    let response = Promise.withResolvers<string>()
    let requests: string[] = []
    let warn = t.mock.method(console, 'warn', () => {})
    let { frame, host } = await setupLazyFrame(t, (src) => {
      requests.push(src)
      return requests.length === 1 ? new Response(stream) : response.promise
    })
    let fallback = document.getElementById('waiting')
    invariant(fallback)

    frame.src = '/targeted'
    let controller = new AbortController()
    let navigation = reloadFrameForNavigation(frame, { signal: controller.signal })
    await reading.promise
    expect(document.getElementById('waiting')).toBe(fallback)
    controller.abort()
    await navigation.finished
    await waitForIntersection(host)
    expect(document.getElementById('waiting')).toBe(fallback)
    expect(requests).toEqual(['/targeted'])
    expect(warn).not.toHaveBeenCalled()

    host.style.top = '0'
    await waitForIntersection(host)
    expect(requests).toEqual(['/targeted', '/targeted'])
    let loaded = waitForElement('#recovered-stream-content')
    response.resolve('<p id="recovered-stream-content">Recovered</p>')
    await loaded
    expect(fallback.isConnected).toBe(false)
  })

  it('reports failed server-rendered lazy frame requests once', async (t) => {
    let failure = new Error('Frame request failed')
    let errors: unknown[] = []
    let { app, host } = await setupLazyFrame(
      t,
      () => {
        throw failure
      },
      { mode: 'server' },
    )
    app.addEventListener('error', (event) => errors.push(event.error))
    host.style.top = '0'
    await waitForIntersection(host)
    expect(errors).toEqual([failure])
    expect(host.textContent).toBe('Waiting')
  })

  it('reports failed lazy frame requests without retrying on another intersection', async (t) => {
    let failure = new Error('Frame request failed')
    let errors: unknown[] = []
    let resolveFrame = mock.fn(() => {
      throw failure
    })
    let root = createRoot(container, { frameInit: { resolveFrame } })
    t.after(() => root.dispose())
    let reported = Promise.withResolvers<void>()
    root.addEventListener('error', (event) => {
      errors.push(event.error)
      reported.resolve()
    })
    root.render(<Frame src="/failure" loading="lazy" fallback={<p>Waiting</p>} />)
    root.flush()
    await reported.promise
    expect(errors).toEqual([failure])
    expect(container.textContent).toBe('Waiting')
    container.style.cssText = 'position:fixed;top:100000px;left:0'
    await waitForIntersection(container)
    container.style.top = '0'
    await waitForIntersection(container)
    expect(resolveFrame).toHaveBeenCalledTimes(1)
  })

  it('renders a client-created Frame with createRoot frameInit', async () => {
    let rootContainer = document.createElement('div')
    document.body.appendChild(rootContainer)

    let root = createRoot(rootContainer, {
      frameInit: {
        resolveFrame: async () => '<p id="resolved-frame">Resolved frame</p>',
      },
    })

    root.render(<Frame src="/client-frame" fallback={<p id="fallback-frame">Loading…</p>} />)
    root.flush()

    expect(rootContainer.querySelector('#fallback-frame')?.textContent).toBe('Loading…')

    await waitForElement('#resolved-frame')

    expect(rootContainer.querySelector('#resolved-frame')?.textContent).toBe('Resolved frame')
    root.dispose()
  })

  it('renders a client-created Frame with createRangeRoot frameInit', async () => {
    let host = document.createElement('div')
    document.body.appendChild(host)
    let start = document.createComment('start')
    let end = document.createComment('end')
    host.append(start, end)

    let root = createRangeRoot([start, end], {
      frameInit: {
        src: '/range-root',
        resolveFrame: async () => '<p id="resolved-range-frame">Resolved range frame</p>',
        loadModule: async () =>
          function Module() {
            return () => null
          },
      },
    })

    root.render(
      <Frame src="/client-range-frame" fallback={<p id="fallback-range-frame">Loading…</p>} />,
    )
    root.flush()

    expect(host.querySelector('#fallback-range-frame')?.textContent).toBe('Loading…')
    await waitForElement('#resolved-range-frame')
    expect(host.querySelector('#resolved-range-frame')?.textContent).toBe('Resolved range frame')
    root.dispose()
  })

  it('dispatches a clear error for createRoot Frame without frameInit', () => {
    let rootContainer = document.createElement('div')
    document.body.appendChild(rootContainer)

    let root = createRoot(rootContainer)
    let error: unknown
    root.addEventListener('error', (event) => {
      error = (event as ErrorEvent).error
    })

    root.render(<Frame src="/missing-runtime" fallback={<p>Loading…</p>} />)
    root.flush()

    expect(error).toBeInstanceOf(Error)
    expect((error as Error).message).toContain('Cannot render <Frame /> without frame runtime')
  })

  it('dispatches a clear error for createRangeRoot Frame without frameInit', () => {
    let host = document.createElement('div')
    let start = document.createComment('start')
    let end = document.createComment('end')
    host.append(start, end)

    let root = createRangeRoot([start, end])
    let error: unknown
    root.addEventListener('error', (event) => {
      error = (event as ErrorEvent).error
    })

    root.render(<Frame src="/missing-range-runtime" fallback={<p>Loading…</p>} />)
    root.flush()

    expect(error).toBeInstanceOf(Error)
    expect((error as Error).message).toContain('Cannot render <Frame /> without frame runtime')
  })

  it('throws from the root runtime resolveFrame fallback without frameInit', () => {
    let rootContainer = document.createElement('div')
    document.body.appendChild(rootContainer)

    let runtime: { resolveFrame(src: string): unknown } | undefined
    function CaptureRuntime(handle: Handle) {
      runtime = handle.frame.$runtime as { resolveFrame(src: string): unknown }
      return () => null
    }

    let root = createRoot(rootContainer)
    root.render(<CaptureRuntime />)
    root.flush()

    expect(runtime).toBeDefined()
    expect(() => runtime!.resolveFrame('/missing-runtime')).toThrow(
      'Cannot render <Frame /> without frame runtime',
    )
  })

  it('strips doctype markup from client resolveFrame content', async () => {
    let rootContainer = document.createElement('div')
    document.body.appendChild(rootContainer)

    let root = createRoot(rootContainer, {
      frameInit: {
        async resolveFrame() {
          return '<!DOCTYPE html><section id="resolved-frame">Resolved</section>'
        },
      },
    })

    root.render(<Frame src="/doctype-frame" fallback={<p>Loading…</p>} />)
    root.flush()
    await waitForElement('#resolved-frame')

    expect(rootContainer.querySelector('#resolved-frame')?.textContent).toBe('Resolved')
    expect(rootContainer.textContent).not.toContain('DOCTYPE')

    root.dispose()
  })

  it('logs a clear error when hydrating client entries without loadModule', async () => {
    let Counter = clientEntry(
      '/js/counter.js#Counter',
      function Counter(handle: Handle<{ initialCount: number }>) {
        let count = handle.props.initialCount
        return () => <button>{count}</button>
      },
    )

    let html = await drain(renderToStream(<Counter initialCount={2} />))
    let container = document.createElement('div')
    let [errorLogged, markErrorLogged] = withResolvers<void>()
    let consoleError = mock.method(console, 'error', (...values: unknown[]) => {
      if (values.some((value) => String(value).includes('loadModule is required'))) {
        markErrorLogged()
      }
    })

    try {
      let root = createRoot(container, {
        frameInit: {
          resolveFrame: async () => html,
        },
      })

      root.render(<Frame src="/counter-frame" fallback={<p>Loading…</p>} />)
      root.flush()
      await errorLogged

      expect(consoleError).toHaveBeenCalled()
      expect(
        consoleError.mock.calls.some((call) =>
          String(call.arguments[0]).includes('Failed to load module'),
        ),
      ).toBe(true)
      expect(
        consoleError.mock.calls.some((call) =>
          call.arguments.some((value) =>
            String(value).includes(
              'loadModule is required to hydrate client entries inside <Frame />',
            ),
          ),
        ),
      ).toBe(true)
    } finally {
      consoleError.mock.restore!()
    }
  })

  it('logs a clear error when loadModule resolves to a non-function export', async () => {
    let Counter = clientEntry(
      '/js/counter.js#Counter',
      function Counter(handle: Handle<{ initialCount: number }>) {
        let count = handle.props.initialCount
        return () => <button>{count}</button>
      },
    )

    let html = await drain(renderToStream(<Counter initialCount={3} />))
    let container = document.createElement('div')
    let [errorLogged, markErrorLogged] = withResolvers<void>()
    let consoleError = mock.method(console, 'error', (...values: unknown[]) => {
      if (values.some((value) => String(value).includes('is not a function'))) markErrorLogged()
    })

    try {
      let root = createRoot(container, {
        frameInit: {
          resolveFrame: async () => html,
          loadModule: async () => ({ not: 'a function' }) as any,
        },
      })

      root.render(<Frame src="/bad-export-frame" fallback={<p>Loading…</p>} />)
      root.flush()
      await errorLogged

      expect(consoleError).toHaveBeenCalled()
      expect(
        consoleError.mock.calls.some((call) =>
          call.arguments.some((value) => String(value).includes('is not a function')),
        ),
      ).toBe(true)
    } finally {
      consoleError.mock.restore!()
    }
  })

  it('reloads client-created Frame in place when src changes', async () => {
    let rootContainer = document.createElement('div')
    document.body.appendChild(rootContainer)

    let [nextFramePromise, resolveNextFrame] = withResolvers<string>()

    let root = createRoot(rootContainer, {
      frameInit: {
        resolveFrame: async (src) => {
          if (src === '/a') return '<p id="frame-a">A</p>'
          return await nextFramePromise
        },
      },
    })

    root.render(<Frame src="/a" fallback={<p id="fallback-a">Loading A…</p>} />)
    root.flush()
    expect(rootContainer.querySelector('#fallback-a')?.textContent).toBe('Loading A…')

    await waitForElement('#frame-a')
    expect(rootContainer.querySelector('#frame-a')?.textContent).toBe('A')

    let frameA = rootContainer.querySelector('#frame-a')
    invariant(frameA instanceof HTMLParagraphElement)

    root.render(<Frame src="/b" fallback={<p id="fallback-b">Loading B…</p>} />)
    root.flush()

    // src updates should behave like reloads: existing content remains mounted
    // while the new source resolves.
    expect(rootContainer.querySelector('#fallback-b')).toBeNull()
    expect(rootContainer.querySelector('#frame-a')).toBe(frameA)

    resolveNextFrame('<p id="frame-b">B</p>')

    await waitForElement('#frame-b')
    expect(rootContainer.querySelector('#frame-b')?.textContent).toBe('B')
    root.dispose()
  })

  it('renders a client-created Frame after run() from a hydrated entry component', async () => {
    let mounted = false
    let showFrame: undefined | (() => void)

    let PostRunFrame = clientEntry(
      '/js/post-run.js#PostRunFrame',
      function PostRunFrame(handle: Handle) {
        showFrame = () => {
          mounted = true
          handle.update()
        }

        return () => (
          <section>
            {mounted ? (
              <Frame
                src="/post-run-frame"
                fallback={<p id="post-run-fallback">Loading post-run…</p>}
              />
            ) : (
              <p id="before-post-run">Before frame</p>
            )}
          </section>
        )
      },
    )

    let pageHtml = await drain(renderToStream(<PostRunFrame />))
    document.body.innerHTML = pageHtml

    let app = run({
      loadModule(moduleUrl, exportName) {
        if (moduleUrl === '/js/post-run.js' && exportName === 'PostRunFrame') return PostRunFrame
        throw new Error(`Unexpected module: ${moduleUrl}#${exportName}`)
      },
      resolveFrame: async () => '<p id="post-run-loaded">Post-run loaded</p>',
    })

    await app.ready()
    invariant(showFrame)
    showFrame()
    app.flush()

    expect(document.getElementById('post-run-fallback')?.textContent).toBe('Loading post-run…')

    await waitForElement('#post-run-loaded')

    expect(document.getElementById('post-run-loaded')?.textContent).toBe('Post-run loaded')
    app.dispose()
  })

  it('forwards the frame name as the resolve target when mounting a named Frame on the client', async () => {
    // Regression test for #11500: the client fresh-insert path (resolveClientFrame)
    // must forward the frame's name as the third `target` argument, like the reload
    // path (frame.ts) and the server path (server/stream.ts) already do.
    let mounted = false
    let showFrame: undefined | (() => void)

    let NamedFrameMount = clientEntry(
      '/js/named-frame-mount.js#NamedFrameMount',
      function NamedFrameMount(handle: Handle) {
        showFrame = () => {
          mounted = true
          handle.update()
        }

        return () => (
          <section>
            {mounted ? (
              <Frame
                name="probe"
                src="/named-frame"
                fallback={<p id="named-frame-fallback">Loading…</p>}
              />
            ) : (
              <p id="before-named-frame">Before frame</p>
            )}
          </section>
        )
      },
    )

    let pageHtml = await drain(renderToStream(<NamedFrameMount />))
    document.body.innerHTML = pageHtml

    let resolveTargets: Array<string | undefined> = []
    let resolveFrame = mock.fn(async (_src: string, options) => {
      resolveTargets.push(options?.target)
      return '<p id="named-frame-loaded">Loaded</p>'
    })

    let app = run({
      loadModule(moduleUrl, exportName) {
        if (moduleUrl === '/js/named-frame-mount.js' && exportName === 'NamedFrameMount') {
          return NamedFrameMount
        }
        throw new Error(`Unexpected module: ${moduleUrl}#${exportName}`)
      },
      resolveFrame,
    })

    await app.ready()
    expect(resolveFrame).not.toHaveBeenCalled()

    invariant(showFrame)
    showFrame()
    app.flush()

    await waitForElement('#named-frame-loaded')

    expect(document.getElementById('named-frame-loaded')?.textContent).toBe('Loaded')
    expect(resolveFrame).toHaveBeenCalledTimes(1)
    // The fresh-insert path resolves the named frame with its name as `target`.
    expect(resolveTargets).toEqual(['probe'])
    app.dispose()
  })

  it('does not duplicate initially-mounted Frame hydration in a client entry', async () => {
    let MountedFrame = clientEntry('/js/mounted-frame.js#MountedFrame', function MountedFrame() {
      let showFrame = true
      return () =>
        showFrame ? (
          <section>
            <Frame src="/outer" fallback={<p id="outer-fallback">Loading outer…</p>} />
          </section>
        ) : null
    })

    let outerStream = renderToStream(
      <div id="outer-root">
        <Frame src="/nested" fallback={<span id="nested-fallback">Loading nested…</span>} />
      </div>,
      { resolveFrame: () => new Promise<string>(() => {}) },
    )
    let outerChunks = readChunks(outerStream)
    let outerFirst = await outerChunks.next()
    invariant(!outerFirst.done)
    let outerInitialHtml = outerFirst.value
    let nestedFrameId = getCommentMarkerId(outerInitialHtml, 'rmx:f:')

    let [outerPromise, resolveOuter] = withResolvers<string>()
    let pageStream = renderToStream(<MountedFrame />, {
      resolveFrame(src: string) {
        if (src === '/outer') return outerPromise
        throw new Error(`Unexpected src during page render: ${src}`)
      },
    })
    let pageChunks = readChunks(pageStream)
    let pageFirst = await pageChunks.next()
    invariant(!pageFirst.done)
    document.body.innerHTML = pageFirst.value

    expect(document.querySelectorAll('#outer-fallback')).toHaveLength(1)

    let clientResolveFrame = mock.fn(
      async (src: string) => `<p data-client-resolve="${src}">client resolve ${src}</p>`,
    )

    let app = run({
      loadModule(moduleUrl, exportName) {
        if (moduleUrl === '/js/mounted-frame.js' && exportName === 'MountedFrame') {
          return MountedFrame
        }
        throw new Error(`Unexpected module: ${moduleUrl}#${exportName}`)
      },
      resolveFrame: clientResolveFrame,
    })

    await app.ready()
    expect(clientResolveFrame).not.toHaveBeenCalled()

    resolveOuter(outerInitialHtml)
    let pageSecond = await pageChunks.next()
    invariant(!pageSecond.done)
    document.body.insertAdjacentHTML('beforeend', pageSecond.value)
    await waitForElement('#outer-root')

    expect(clientResolveFrame).not.toHaveBeenCalled()
    expect(document.querySelectorAll('#outer-root')).toHaveLength(1)
    expect(document.querySelectorAll('#nested-fallback')).toHaveLength(1)

    let nestedTemplate = document.createElement('template')
    nestedTemplate.id = nestedFrameId
    nestedTemplate.innerHTML = '<span id="nested-loaded">Nested loaded</span>'
    document.body.appendChild(nestedTemplate)
    await waitForElement('#nested-loaded')

    expect(clientResolveFrame).not.toHaveBeenCalled()
    expect(document.querySelectorAll('#nested-loaded')).toHaveLength(1)
    expect(document.querySelectorAll('#nested-fallback')).toHaveLength(0)

    app.dispose()
  })

  it('adopts a Fragment-nested Frame hydration marker at a clientEntry boundary', async () => {
    // Regression test for #11501: a <Frame> that is the first child of a bare
    // Fragment returned by a clientEntry must adopt its server-rendered hydration
    // marker rather than taking the fresh-insert path (which re-fetches src on the
    // client and duplicates the streamed subtree). A host-element wrapper already
    // works (see the test above); this covers the bare-Fragment-first-child case,
    // where the clientEntry boundary's comment-skip would otherwise swallow the
    // frame-start marker.
    let FragmentFrame = clientEntry(
      '/js/fragment-frame.js#FragmentFrame',
      function FragmentFrame() {
        return () => (
          <>
            <Frame name="frag" src="/frag" fallback={<p id="frag-fallback">Loading frag…</p>} />
            <span id="frag-sibling">sibling</span>
          </>
        )
      },
    )

    // Leave the frame pending on the server so the first chunk carries the frame's
    // fallback and its rmx:f start/end markers.
    let [framePromise] = withResolvers<string>()
    let pageStream = renderToStream(<FragmentFrame />, {
      resolveFrame(src: string) {
        if (src === '/frag') return framePromise
        throw new Error(`Unexpected src during page render: ${src}`)
      },
    })
    let pageChunks = readChunks(pageStream)
    let first = await pageChunks.next()
    invariant(!first.done)
    document.body.innerHTML = first.value

    expect(document.querySelectorAll('#frag-fallback')).toHaveLength(1)
    expect(document.querySelectorAll('#frag-sibling')).toHaveLength(1)

    let clientResolveFrame = mock.fn(async (src: string) => `<p data-client="${src}">client</p>`)

    let app = run({
      loadModule(moduleUrl, exportName) {
        if (moduleUrl === '/js/fragment-frame.js' && exportName === 'FragmentFrame') {
          return FragmentFrame
        }
        throw new Error(`Unexpected module: ${moduleUrl}#${exportName}`)
      },
      resolveFrame: clientResolveFrame,
    })

    await app.ready()

    // Marker adopted: no client re-fetch, fallback not duplicated, sibling intact.
    expect(clientResolveFrame).not.toHaveBeenCalled()
    expect(document.querySelectorAll('#frag-fallback')).toHaveLength(1)
    expect(document.querySelectorAll('#frag-sibling')).toHaveLength(1)
    expect(document.querySelectorAll('[data-client]')).toHaveLength(0)

    app.dispose()
  })

  it('renders Frame semantics from entry children during initial hydration', async () => {
    let Card = clientEntry('/js/card.js#Card', function Card(handle: Handle<{ children?: any }>) {
      return () => <section>{handle.props.children}</section>
    })

    let [framePromise, resolveFramePromise] = withResolvers<string>()
    let pageStream = renderToStream(
      <Card>
        <Frame src="/child-frame" fallback={<span id="child-frame">Loading child frame…</span>} />
      </Card>,
      { resolveFrame: () => framePromise },
    )
    let chunks = readChunks(pageStream)
    let first = await chunks.next()
    invariant(!first.done)
    document.body.innerHTML = first.value

    expect(document.getElementById('child-frame')?.textContent).toBe('Loading child frame…')

    let app = run({
      loadModule(moduleUrl, exportName) {
        if (moduleUrl === '/js/card.js' && exportName === 'Card') return Card
        throw new Error(`Unexpected module: ${moduleUrl}#${exportName}`)
      },
    })

    await app.ready()
    expect(document.getElementById('child-frame')?.textContent).toBe('Loading child frame…')

    resolveFramePromise('<span id="child-frame">Loaded child frame</span>')
    let second = await chunks.next()
    invariant(!second.done)
    document.body.insertAdjacentHTML('beforeend', second.value)
    await waitForText('#child-frame', 'Loaded child frame')

    expect(document.getElementById('child-frame')?.textContent).toBe('Loaded child frame')
    app.dispose()
  })

  it('does not dispose managed stylesheets when removing a client-created Frame', async () => {
    let rootContainer = document.createElement('div')
    document.body.appendChild(rootContainer)

    function Shell(handle: Handle) {
      let mounted = true

      return () => (
        <main mix={[css({ color: '#0bf' })]}>
          <button
            id="toggle-frame"
            type="button"
            mix={[
              on('click', () => {
                mounted = !mounted
                handle.update()
              }),
            ]}
          >
            Toggle
          </button>
          {mounted ? (
            <Frame
              src="/style-frame"
              fallback={<div mix={[css({ color: '#f0b' })]}>Loading style frame…</div>}
            />
          ) : null}
        </main>
      )
    }

    let root = createRoot(rootContainer, {
      frameInit: {
        resolveFrame: async () => '<section class="frame-loaded">Frame loaded</section>',
      },
    })

    root.render(<Shell />)
    root.flush()

    let before = document.adoptedStyleSheets.length
    let button = rootContainer.querySelector('#toggle-frame')
    invariant(button instanceof HTMLButtonElement)

    button.click()
    root.flush()

    let after = document.adoptedStyleSheets.length
    expect(after).toBeGreaterThan(0)
    expect(after).toBeGreaterThanOrEqual(before)

    root.dispose()
  })

  it('streams client resolveFrame templates and updates nested placeholders incrementally', async () => {
    let reload: undefined | (() => Promise<AbortSignal>)

    let ReloadButton = clientEntry(
      '/assets/reload-stream.js#ReloadStream',
      function ReloadStream(handle: Handle) {
        reload = () => handle.frame.reload()
        return () => (
          <button id="reload-stream" type="button">
            Reload streamed
          </button>
        )
      },
    )

    async function renderInitial(): Promise<string> {
      return await drain(
        renderToStream(
          <section>
            <p id="outer">Initial outer</p>
            <ReloadButton />
          </section>,
        ),
      )
    }

    let [nestedResolvePromise, resolveNested] = withResolvers<string>()
    let streamedReload = renderToStream(
      <section>
        <p id="outer">Reloaded outer</p>
        <Frame src="/nested" fallback={<span id="nested">Loading nested…</span>} />
        <ReloadButton />
      </section>,
      {
        resolveFrame(src: string) {
          if (src === '/nested') return nestedResolvePromise
          throw new Error(`Unexpected nested src: ${src}`)
        },
      },
    )

    let streamedChunks = readChunks(streamedReload)
    let firstChunk = await streamedChunks.next()
    invariant(!firstChunk.done)
    resolveNested('<span id="nested">Nested loaded</span>')
    let secondChunk = await streamedChunks.next()
    invariant(!secondChunk.done)

    let [secondChunkPromise, releaseSecondChunk] = withResolvers<string>()
    let serverHtml = await drain(
      renderToStream(
        <main>
          <Frame src="/reload-streamed" fallback={<div id="frame-fallback">Loading…</div>} />
        </main>,
        {
          resolveFrame: renderInitial,
        },
      ),
    )
    document.body.innerHTML = serverHtml

    let app = run({
      loadModule(moduleUrl, exportName) {
        if (moduleUrl === '/assets/reload-stream.js' && exportName === 'ReloadStream') {
          return ReloadButton
        }
        throw new Error(`Unexpected module: ${moduleUrl}#${exportName}`)
      },
      resolveFrame(src: string) {
        if (src === '/reload-streamed') {
          return streamFromChunks([firstChunk.value, secondChunkPromise])
        }
        throw new Error(`Unexpected frame src: ${src}`)
      },
    })

    await app.ready()

    invariant(reload)
    let reloadPromise = reload()
    await waitForText('#outer', 'Reloaded outer')

    expect(document.getElementById('outer')?.textContent).toBe('Reloaded outer')
    expect(document.getElementById('nested')?.textContent).toBe('Loading nested…')

    releaseSecondChunk(secondChunk.value)
    await reloadPromise
    await waitForText('#nested', 'Nested loaded')

    expect(document.getElementById('nested')?.textContent).toBe('Nested loaded')
  })

  it('streams nested frame templates after a client-triggered top frame reload', async () => {
    let reloadTop: undefined | (() => Promise<AbortSignal>)

    let ReloadTopButton = clientEntry(
      '/assets/reload-top-stream.js#ReloadTopStream',
      function ReloadTopStream(handle: Handle) {
        reloadTop = () => handle.frames.top.reload()
        return () => (
          <button id="reload-top-stream" type="button">
            Reload top
          </button>
        )
      },
    )

    async function renderControls(): Promise<string> {
      return await drain(
        renderToStream(
          <section>
            <p id="controls">Initial controls</p>
            <ReloadTopButton />
          </section>,
        ),
      )
    }

    let serverHtml = await drain(
      renderToStream(
        <html>
          <body>
            <main>
              <p id="top-state">Initial top</p>
              <Frame src="/controls" fallback={<span id="controls">Loading controls…</span>} />
            </main>
          </body>
        </html>,
        {
          resolveFrame(src: string) {
            if (src === '/controls') return renderControls()
            throw new Error(`Unexpected frame src: ${src}`)
          },
        },
      ),
    )
    let initialDocument = new DOMParser().parseFromString(serverHtml, 'text/html')
    document.documentElement.innerHTML = initialDocument.documentElement.innerHTML

    let [nestedResolvePromise, resolveNested] = withResolvers<string>()
    let streamedReload = renderToStream(
      <html>
        <body>
          <main>
            <p id="top-state">Reloaded top</p>
            <Frame src="/nested" fallback={<span id="nested">Loading nested…</span>} />
          </main>
        </body>
      </html>,
      {
        resolveFrame(src: string) {
          if (src === '/nested') return nestedResolvePromise
          throw new Error(`Unexpected nested src: ${src}`)
        },
      },
    )

    let streamedChunks = readChunks(streamedReload)
    let firstChunk = await streamedChunks.next()
    invariant(!firstChunk.done)
    resolveNested('<span id="nested">Nested loaded</span>')
    let secondChunk = await streamedChunks.next()
    invariant(!secondChunk.done)
    let [secondChunkPromise, releaseSecondChunk] = withResolvers<string>()

    let app = run({
      loadModule(moduleUrl, exportName) {
        if (moduleUrl === '/assets/reload-top-stream.js' && exportName === 'ReloadTopStream') {
          return ReloadTopButton
        }
        throw new Error(`Unexpected module: ${moduleUrl}#${exportName}`)
      },
      resolveFrame(src: string) {
        if (src === document.location.href) {
          return streamFromChunks(['<!DOCTYPE html>', firstChunk.value, secondChunkPromise])
        }
        throw new Error(`Unexpected frame src: ${src}`)
      },
    })

    await app.ready()

    invariant(reloadTop)
    let reloadPromise = reloadTop()
    await waitForText('#top-state', 'Reloaded top')

    expect(document.getElementById('top-state')?.textContent).toBe('Reloaded top')
    expect(document.getElementById('nested')?.textContent).toBe('Loading nested…')

    releaseSecondChunk(secondChunk.value)
    await reloadPromise
    await waitForText('#nested', 'Nested loaded')

    expect(document.getElementById('nested')?.textContent).toBe('Nested loaded')
    app.dispose()
  })

  it('preserves resolved non-blocking child frame content during top frame reloads', async () => {
    async function renderChildFrame(label: string) {
      return await drain(
        renderToStream(
          <section id="child-frame-content">
            <p id="child-frame-label">{label}</p>
            <input id="child-frame-input" />
          </section>,
        ),
      )
    }

    function renderDocument(childContent: string | Promise<string>) {
      return renderToStream(
        <html>
          <head />
          <body>
            <main>
              <p id="top-frame-label">Top frame</p>
              <Frame
                name="child"
                src="/child"
                fallback={<span id="child-frame-fallback">Loading child...</span>}
              />
            </main>
          </body>
        </html>,
        {
          resolveFrame(src: string) {
            if (src === '/child') return childContent
            throw new Error(`Unexpected frame src: ${src}`)
          },
        },
      )
    }

    let initialDocument = new DOMParser().parseFromString(
      await drainWithProtocol(renderDocument(renderChildFrame('Initial child'))),
      'text/html',
    )
    document.documentElement.innerHTML = initialDocument.documentElement.innerHTML

    let [childReloadPromise, resolveChildReload] = withResolvers<string>()
    let streamedReload = renderDocument(childReloadPromise)
    let streamedChunks = readChunks(streamedReload)
    let firstChunk = await streamedChunks.next()
    invariant(!firstChunk.done)
    resolveChildReload(await renderChildFrame('Reloaded child'))
    let secondChunk = await streamedChunks.next()
    invariant(!secondChunk.done)
    let [secondChunkPromise, releaseSecondChunk] = withResolvers<string>()

    let app = run({
      loadModule: mock.fn(),
      resolveFrame(src: string) {
        if (src === document.location.href) {
          return streamFromChunks(['<!DOCTYPE html>', firstChunk.value, secondChunkPromise])
        }
        throw new Error(`Unexpected frame src: ${src}`)
      },
    })

    await app.ready()

    let input = document.getElementById('child-frame-input')
    invariant(input instanceof HTMLInputElement)
    expect(document.getElementById('child-frame-label')?.textContent).toBe('Initial child')
    input.value = 'typed child value'

    let topFrame = app.frames.top
    let reloadPromise = topFrame.reload()
    await waitForFrameMarker(firstChunk.value)

    expect(document.getElementById('child-frame-fallback')).toBeNull()
    expect(document.getElementById('child-frame-input')).toBe(input)
    expect(document.getElementById('child-frame-label')?.textContent).toBe('Initial child')
    expect(input.value).toBe('typed child value')

    releaseSecondChunk(secondChunk.value)
    await reloadPromise
    await waitForText('#child-frame-label', 'Reloaded child')

    expect(document.getElementById('child-frame-fallback')).toBeNull()
    expect(document.getElementById('child-frame-input')).toBe(input)
    expect(document.getElementById('child-frame-label')?.textContent).toBe('Reloaded child')
    expect(input.value).toBe('typed child value')

    app.dispose()
  })

  it('diffs pending child frame fallbacks and ignores stale templates during top frame reloads', async () => {
    let [initialChildPromise] = withResolvers<string>()
    let [reloadedChildPromise] = withResolvers<string>()
    let childReloadStartEvents = 0
    let childReloadCompleteEvents = 0
    let [childReloadCompleted, markChildReloadCompleted] = withResolvers<void>()
    let reloadTopWithPendingChild: undefined | (() => Promise<AbortSignal>)

    let PendingChildFrameObserver = clientEntry(
      '/assets/pending-child-frame-observer.js#PendingChildFrameObserver',
      function PendingChildFrameObserver(handle: Handle) {
        reloadTopWithPendingChild = async () => {
          let childFrame = handle.frames.get('child')
          invariant(childFrame)
          childFrame.addEventListener(
            'reloadStart',
            () => {
              childReloadStartEvents++
            },
            { once: true },
          )
          childFrame.addEventListener(
            'reloadComplete',
            () => {
              childReloadCompleteEvents++
              markChildReloadCompleted()
            },
            { once: true },
          )
          return await handle.frames.top.reload()
        }

        return () => <button id="reload-top-with-pending-child">Reload top</button>
      },
    )

    function renderDocument(childContent: Promise<string>, fallbackLabel: string) {
      return renderToStream(
        <html>
          <head />
          <body>
            <main>
              <p id="top-frame-label">Top frame</p>
              <PendingChildFrameObserver />
              <Frame
                name="child"
                src="/child"
                fallback={
                  <span id="child-frame-fallback" data-label={fallbackLabel}>
                    {fallbackLabel}
                  </span>
                }
              />
            </main>
          </body>
        </html>,
        {
          resolveFrame(src: string) {
            if (src === '/child') return childContent
            throw new Error(`Unexpected frame src: ${src}`)
          },
        },
      )
    }

    let initialChunks = readChunks(renderDocument(initialChildPromise, 'Initial fallback'))
    let initialChunk = await initialChunks.next()
    invariant(!initialChunk.done)
    let initialMarkerId = getCommentMarkerId(initialChunk.value, 'rmx:f:')

    let initialDocument = new DOMParser().parseFromString(initialChunk.value, 'text/html')
    document.documentElement.innerHTML = initialDocument.documentElement.innerHTML

    let reloadedChunks = readChunks(renderDocument(reloadedChildPromise, 'Reloaded fallback'))
    let reloadedChunk = await reloadedChunks.next()
    invariant(!reloadedChunk.done)
    let reloadedMarkerId = getCommentMarkerId(reloadedChunk.value, 'rmx:f:')

    let app = run({
      loadModule(moduleUrl, exportName) {
        if (
          moduleUrl === '/assets/pending-child-frame-observer.js' &&
          exportName === 'PendingChildFrameObserver'
        ) {
          return PendingChildFrameObserver
        }
        throw new Error(`Unexpected module: ${moduleUrl}#${exportName}`)
      },
      resolveFrame(src: string) {
        if (src === document.location.href) {
          return streamFromChunks(['<!DOCTYPE html>', reloadedChunk.value])
        }
        throw new Error(`Unexpected frame src: ${src}`)
      },
    })

    await app.ready()

    let fallback = document.getElementById('child-frame-fallback')
    invariant(fallback instanceof HTMLSpanElement)
    expect(fallback.textContent).toBe('Initial fallback')
    expect(fallback.getAttribute('data-label')).toBe('Initial fallback')

    invariant(reloadTopWithPendingChild)
    let reloadPromise = reloadTopWithPendingChild()
    await reloadPromise

    expect(childReloadStartEvents).toBe(1)
    expect(childReloadCompleteEvents).toBe(0)
    expect(document.getElementById('child-frame-fallback')).toBe(fallback)
    expect(fallback.textContent).toBe('Reloaded fallback')
    expect(fallback.getAttribute('data-label')).toBe('Reloaded fallback')

    let staleTemplate = document.createElement('template')
    staleTemplate.id = initialMarkerId
    staleTemplate.innerHTML = '<span id="stale-child-content">Stale child</span>'
    let staleTemplateObserved = nextDomMutation()
    document.body.appendChild(staleTemplate)
    await staleTemplateObserved

    // No runtime template observer claims the stale template, so it stays in the document.
    expect(staleTemplate.isConnected).toBe(true)
    expect(document.getElementById('stale-child-content')).toBeNull()
    expect(document.getElementById('child-frame-fallback')).toBe(fallback)
    expect(fallback.textContent).toBe('Reloaded fallback')

    let freshTemplate = document.createElement('template')
    freshTemplate.id = reloadedMarkerId
    freshTemplate.innerHTML = '<span id="fresh-child-content">Fresh child</span>'
    document.body.appendChild(freshTemplate)
    await Promise.all([waitForElement('#fresh-child-content'), childReloadCompleted])

    expect(document.getElementById('stale-child-content')).toBeNull()
    expect(document.getElementById('fresh-child-content')?.textContent).toBe('Fresh child')
    expect(document.getElementById('child-frame-fallback')).toBeNull()
    expect(childReloadStartEvents).toBe(1)
    expect(childReloadCompleteEvents).toBe(1)

    app.dispose()
  })

  it('preserves resolved direct child frame content during parent frame reloads', async () => {
    let reloadParent: undefined | (() => Promise<AbortSignal>)

    let ReloadDirectParent = clientEntry(
      '/assets/reload-direct-parent.js#ReloadDirectParent',
      function ReloadDirectParent(handle: Handle) {
        reloadParent = () => handle.frame.reload()
        return () => <button id="reload-direct-parent">Reload parent</button>
      },
    )

    async function renderChildFrame(label: string) {
      return await drain(
        renderToStream(
          <>
            <p id="direct-child-frame-label">{label}</p>
            <input id="direct-child-frame-input" />
          </>,
        ),
      )
    }

    function renderParentFrame(childContent: string | Promise<string>) {
      return renderToStream(
        <>
          <Frame
            name="direct-child"
            src="/direct-child"
            fallback={<span id="direct-child-frame-fallback">Loading child...</span>}
          />
          <p id="direct-parent-sibling">Parent sibling</p>
          <ReloadDirectParent />
        </>,
        {
          resolveFrame(src: string) {
            if (src === '/direct-child') return childContent
            throw new Error(`Unexpected frame src: ${src}`)
          },
        },
      )
    }

    let initialDocument = new DOMParser().parseFromString(
      await drainWithProtocol(
        renderToStream(
          <html>
            <head />
            <body>
              <main>
                <Frame name="direct-parent" src="/direct-parent" />
              </main>
            </body>
          </html>,
          {
            resolveFrame(src: string) {
              if (src === '/direct-parent') {
                return renderParentFrame(renderChildFrame('Initial direct child'))
              }
              throw new Error(`Unexpected frame src: ${src}`)
            },
          },
        ),
      ),
      'text/html',
    )
    document.documentElement.innerHTML = initialDocument.documentElement.innerHTML

    let [childReloadPromise, resolveChildReload] = withResolvers<string>()
    let streamedReload = renderParentFrame(childReloadPromise)
    let streamedChunks = readChunks(streamedReload)
    let firstChunk = await streamedChunks.next()
    invariant(!firstChunk.done)
    resolveChildReload(await renderChildFrame('Reloaded direct child'))
    let secondChunk = await streamedChunks.next()
    invariant(!secondChunk.done)
    let [secondChunkPromise, releaseSecondChunk] = withResolvers<string>()

    let app = run({
      loadModule(moduleUrl, exportName) {
        if (
          moduleUrl === '/assets/reload-direct-parent.js' &&
          exportName === 'ReloadDirectParent'
        ) {
          return ReloadDirectParent
        }
        throw new Error(`Unexpected module: ${moduleUrl}#${exportName}`)
      },
      resolveFrame(src: string) {
        if (src === '/direct-parent') {
          return streamFromChunks([firstChunk.value, secondChunkPromise])
        }
        throw new Error(`Unexpected frame src: ${src}`)
      },
    })

    await app.ready()

    let input = document.getElementById('direct-child-frame-input')
    invariant(input instanceof HTMLInputElement)
    expect(document.getElementById('direct-child-frame-label')?.textContent).toBe(
      'Initial direct child',
    )
    input.value = 'typed direct child value'

    invariant(reloadParent)
    let reloadPromise = reloadParent()
    await waitForFrameMarker(firstChunk.value)

    expect(document.getElementById('direct-child-frame-fallback')).toBeNull()
    expect(document.getElementById('direct-child-frame-input')).toBe(input)
    expect(document.getElementById('direct-child-frame-label')?.textContent).toBe(
      'Initial direct child',
    )
    expect(input.value).toBe('typed direct child value')
    expect(document.getElementById('direct-parent-sibling')?.textContent).toBe('Parent sibling')

    releaseSecondChunk(secondChunk.value)
    await reloadPromise
    await waitForText('#direct-child-frame-label', 'Reloaded direct child')

    expect(document.getElementById('direct-child-frame-fallback')).toBeNull()
    expect(document.getElementById('direct-child-frame-input')).toBe(input)
    expect(document.getElementById('direct-child-frame-label')?.textContent).toBe(
      'Reloaded direct child',
    )
    expect(input.value).toBe('typed direct child value')
    expect(document.getElementById('direct-parent-sibling')?.textContent).toBe('Parent sibling')

    app.dispose()
  })

  it('keeps blocking child frame handles reloadable after top frame reloads', async () => {
    let childReloadCount = 0

    let ReloadBlockingChild = clientEntry(
      '/assets/reload-blocking-child.js#ReloadBlockingChild',
      function ReloadBlockingChild(handle: Handle) {
        let pending = false

        handle.frame.addEventListener('reloadStart', () => {
          pending = true
          handle.update()
        })

        handle.frame.addEventListener('reloadComplete', () => {
          pending = false
          handle.update()
        })

        return () => (
          <button
            id="reload-blocking-child"
            mix={on('click', () => {
              void handle.frame.reload()
            })}
          >
            {pending ? 'Reloading child' : 'Reload child'}
          </button>
        )
      },
    )

    async function renderChildFrame(label: string) {
      return await drain(
        renderToStream(
          <>
            <p id="blocking-child-frame-label">{label}</p>
            <ReloadBlockingChild />
          </>,
        ),
      )
    }

    function renderDocument(childLabel: string) {
      return renderToStream(
        <html>
          <head />
          <body>
            <main>
              <Frame name="blocking-child" src="/blocking-child" />
            </main>
          </body>
        </html>,
        {
          resolveFrame(src: string) {
            if (src === '/blocking-child') return renderChildFrame(childLabel)
            throw new Error(`Unexpected frame src: ${src}`)
          },
        },
      )
    }

    let initialDocument = new DOMParser().parseFromString(
      await drainWithProtocol(renderDocument('Initial blocking child')),
      'text/html',
    )
    document.documentElement.innerHTML = initialDocument.documentElement.innerHTML

    let [topReloadPromise, resolveTopReload] = withResolvers<ReadableStream<Uint8Array>>()

    let app = run({
      loadModule(moduleUrl, exportName) {
        if (
          moduleUrl === '/assets/reload-blocking-child.js' &&
          exportName === 'ReloadBlockingChild'
        ) {
          return ReloadBlockingChild
        }
        throw new Error(`Unexpected module: ${moduleUrl}#${exportName}`)
      },
      resolveFrame(src: string) {
        if (src === document.location.href) {
          return topReloadPromise
        }
        if (src === '/blocking-child') {
          childReloadCount++
          return renderChildFrame(`Reloaded by child frame ${childReloadCount}`)
        }
        throw new Error(`Unexpected frame src: ${src}`)
      },
    })

    await app.ready()

    expect(document.getElementById('blocking-child-frame-label')?.textContent).toBe(
      'Initial blocking child',
    )

    let topReload = app.frames.top.reload()
    await waitForText('#reload-blocking-child', 'Reloading child')

    expect(document.getElementById('reload-blocking-child')?.textContent).toBe('Reloading child')

    resolveTopReload(renderDocument('Reloaded by top frame'))
    await topReload
    await waitForText('#reload-blocking-child', 'Reload child')

    expect(document.getElementById('blocking-child-frame-label')?.textContent).toBe(
      'Reloaded by top frame',
    )
    expect(document.getElementById('reload-blocking-child')?.textContent).toBe('Reload child')

    let reloadChildButton = document.getElementById('reload-blocking-child')
    invariant(reloadChildButton instanceof HTMLButtonElement)
    reloadChildButton.click()
    await waitForText('#blocking-child-frame-label', 'Reloaded by child frame 1')

    expect(document.getElementById('blocking-child-frame-label')?.textContent).toBe(
      'Reloaded by child frame 1',
    )

    app.dispose()
  })

  it('removes direct child frame content during parent frame reloads', async () => {
    let reloadParent: undefined | (() => Promise<AbortSignal>)
    let showChildFrame = true

    let ReloadDirectParent = clientEntry(
      '/assets/remove-direct-child-frame.js#RemoveDirectChildFrame',
      function RemoveDirectChildFrame(handle: Handle) {
        reloadParent = async () => {
          showChildFrame = false
          return await handle.frame.reload()
        }
        return () => <button id="remove-direct-child-frame">Remove child</button>
      },
    )

    function renderParentFrame() {
      return renderToStream(
        <>
          {showChildFrame ? <Frame name="removed-child" src="/removed-child" /> : null}
          <p id="remove-direct-parent-sibling">Parent sibling</p>
          <ReloadDirectParent />
        </>,
        {
          resolveFrame(src: string) {
            if (src === '/removed-child') {
              return '<p id="removed-child-content">Child content</p><input id="removed-child-input" />'
            }
            throw new Error(`Unexpected frame src: ${src}`)
          },
        },
      )
    }

    let initialDocument = new DOMParser().parseFromString(
      await drainWithProtocol(
        renderToStream(
          <html>
            <head />
            <body>
              <main>
                <Frame name="remove-direct-parent" src="/remove-direct-parent" />
              </main>
            </body>
          </html>,
          {
            resolveFrame(src: string) {
              if (src === '/remove-direct-parent') return renderParentFrame()
              throw new Error(`Unexpected frame src: ${src}`)
            },
          },
        ),
      ),
      'text/html',
    )
    document.documentElement.innerHTML = initialDocument.documentElement.innerHTML

    let app = run({
      loadModule(moduleUrl, exportName) {
        if (
          moduleUrl === '/assets/remove-direct-child-frame.js' &&
          exportName === 'RemoveDirectChildFrame'
        ) {
          return ReloadDirectParent
        }
        throw new Error(`Unexpected module: ${moduleUrl}#${exportName}`)
      },
      resolveFrame(src: string) {
        if (src === '/remove-direct-parent') return renderParentFrame()
        throw new Error(`Unexpected frame src: ${src}`)
      },
    })

    await app.ready()

    expect(document.getElementById('removed-child-content')?.textContent).toBe('Child content')
    expect(document.getElementById('remove-direct-parent-sibling')?.textContent).toBe(
      'Parent sibling',
    )

    invariant(reloadParent)
    await reloadParent()

    expect(document.getElementById('removed-child-content')).toBeNull()
    expect(document.getElementById('removed-child-input')).toBeNull()
    expect(document.getElementById('remove-direct-parent-sibling')?.textContent).toBe(
      'Parent sibling',
    )

    app.dispose()
  })

  it('replaces direct child frame content when frame src changes during parent frame reloads', async () => {
    let reloadParent: undefined | (() => Promise<AbortSignal>)
    let childSrc = '/direct-src-a'

    let ReloadDirectParent = clientEntry(
      '/assets/replace-direct-child-frame.js#ReplaceDirectChildFrame',
      function ReplaceDirectChildFrame(handle: Handle) {
        reloadParent = async () => {
          childSrc = '/direct-src-b'
          return await handle.frame.reload()
        }
        return () => <button id="replace-direct-child-frame">Replace child</button>
      },
    )

    function renderParentFrame(childContent: string | Promise<string>) {
      return renderToStream(
        <>
          <Frame
            name="direct-src-child"
            src={childSrc}
            fallback={<span id="direct-src-child-fallback">Loading replacement...</span>}
          />
          <p id="direct-src-parent-sibling">Parent sibling</p>
          <ReloadDirectParent />
        </>,
        {
          resolveFrame(src: string) {
            if (src === childSrc) return childContent
            throw new Error(`Unexpected frame src: ${src}`)
          },
        },
      )
    }

    let initialDocument = new DOMParser().parseFromString(
      await drainWithProtocol(
        renderToStream(
          <html>
            <head />
            <body>
              <main>
                <Frame name="direct-src-parent" src="/direct-src-parent" />
              </main>
            </body>
          </html>,
          {
            resolveFrame(src: string) {
              if (src === '/direct-src-parent') {
                return renderParentFrame(
                  '<p id="direct-src-child-content">Initial child</p><input id="direct-src-child-input" />',
                )
              }
              throw new Error(`Unexpected frame src: ${src}`)
            },
          },
        ),
      ),
      'text/html',
    )
    document.documentElement.innerHTML = initialDocument.documentElement.innerHTML

    let [childReloadPromise, resolveChildReload] = withResolvers<string>()
    let app = run({
      loadModule(moduleUrl, exportName) {
        if (
          moduleUrl === '/assets/replace-direct-child-frame.js' &&
          exportName === 'ReplaceDirectChildFrame'
        ) {
          return ReloadDirectParent
        }
        throw new Error(`Unexpected module: ${moduleUrl}#${exportName}`)
      },
      resolveFrame(src: string) {
        if (src === '/direct-src-parent') {
          return renderParentFrame(childReloadPromise)
        }
        throw new Error(`Unexpected frame src: ${src}`)
      },
    })

    await app.ready()

    let input = document.getElementById('direct-src-child-input')
    invariant(input instanceof HTMLInputElement)
    input.value = 'typed value'
    expect(document.getElementById('direct-src-child-content')?.textContent).toBe('Initial child')

    invariant(reloadParent)
    let reloadPromise = reloadParent()
    await waitForElement('#direct-src-child-fallback')

    expect(document.getElementById('direct-src-child-content')).toBeNull()
    expect(document.getElementById('direct-src-child-input')).toBeNull()
    expect(document.getElementById('direct-src-child-fallback')?.textContent).toBe(
      'Loading replacement...',
    )
    expect(document.getElementById('direct-src-parent-sibling')?.textContent).toBe('Parent sibling')

    resolveChildReload('<p id="direct-src-child-content">Replacement child</p>')
    await reloadPromise
    await waitForText('#direct-src-child-content', 'Replacement child')

    expect(document.getElementById('direct-src-child-fallback')).toBeNull()
    expect(document.getElementById('direct-src-child-content')?.textContent).toBe(
      'Replacement child',
    )
    expect(document.getElementById('direct-src-parent-sibling')?.textContent).toBe('Parent sibling')

    app.dispose()
  })

  it('replaces nested child frame content when frame src changes during parent frame reloads', async () => {
    let reloadParent: undefined | (() => Promise<AbortSignal>)
    let childSrc = '/nested-src-a'

    let ReloadNestedParent = clientEntry(
      '/assets/replace-nested-child-frame.js#ReplaceNestedChildFrame',
      function ReplaceNestedChildFrame(handle: Handle) {
        reloadParent = async () => {
          childSrc = '/nested-src-b'
          return await handle.frame.reload()
        }
        return () => <button id="replace-nested-child-frame">Replace child</button>
      },
    )

    function renderParentFrame(childContent: string | Promise<string>) {
      return renderToStream(
        <>
          <section id="nested-src-child-shell">
            <Frame
              name="nested-src-child"
              src={childSrc}
              fallback={<span id="nested-src-child-fallback">Loading replacement...</span>}
            />
          </section>
          <p id="nested-src-parent-sibling">Parent sibling</p>
          <ReloadNestedParent />
        </>,
        {
          resolveFrame(src: string) {
            if (src === childSrc) return childContent
            throw new Error(`Unexpected frame src: ${src}`)
          },
        },
      )
    }

    let initialDocument = new DOMParser().parseFromString(
      await drainWithProtocol(
        renderToStream(
          <html>
            <head />
            <body>
              <main>
                <Frame name="nested-src-parent" src="/nested-src-parent" />
              </main>
            </body>
          </html>,
          {
            resolveFrame(src: string) {
              if (src === '/nested-src-parent') {
                return renderParentFrame(
                  '<p id="nested-src-child-content">Initial child</p><input id="nested-src-child-input" />',
                )
              }
              throw new Error(`Unexpected frame src: ${src}`)
            },
          },
        ),
      ),
      'text/html',
    )
    document.documentElement.innerHTML = initialDocument.documentElement.innerHTML

    let [childReloadPromise, resolveChildReload] = withResolvers<string>()
    let app = run({
      loadModule(moduleUrl, exportName) {
        if (
          moduleUrl === '/assets/replace-nested-child-frame.js' &&
          exportName === 'ReplaceNestedChildFrame'
        ) {
          return ReloadNestedParent
        }
        throw new Error(`Unexpected module: ${moduleUrl}#${exportName}`)
      },
      resolveFrame(src: string) {
        if (src === '/nested-src-parent') {
          return renderParentFrame(childReloadPromise)
        }
        throw new Error(`Unexpected frame src: ${src}`)
      },
    })

    await app.ready()

    let input = document.getElementById('nested-src-child-input')
    invariant(input instanceof HTMLInputElement)
    input.value = 'typed value'
    expect(document.getElementById('nested-src-child-content')?.textContent).toBe('Initial child')

    invariant(reloadParent)
    let reloadPromise = reloadParent()
    await waitForElement('#nested-src-child-fallback')

    expect(document.getElementById('nested-src-child-content')).toBeNull()
    expect(document.getElementById('nested-src-child-input')).toBeNull()
    expect(document.getElementById('nested-src-child-fallback')?.textContent).toBe(
      'Loading replacement...',
    )
    expect(document.getElementById('nested-src-parent-sibling')?.textContent).toBe('Parent sibling')

    resolveChildReload('<p id="nested-src-child-content">Replacement child</p>')
    await reloadPromise
    await waitForText('#nested-src-child-content', 'Replacement child')

    expect(document.getElementById('nested-src-child-fallback')).toBeNull()
    expect(document.getElementById('nested-src-child-content')?.textContent).toBe(
      'Replacement child',
    )
    expect(document.getElementById('nested-src-child-input')).toBeNull()
    expect(document.getElementById('nested-src-parent-sibling')?.textContent).toBe('Parent sibling')

    app.dispose()
  })

  it('re-resolves a nested clientEntry frame with its target on a non-root ancestor reload', async () => {
    // Regression test for #11502: a <Frame> wrapped in a clientEntry and nested
    // inside a parent (non-root ancestor) frame re-resolves on the *client* when
    // the parent reloads and the clientEntry remounts it (key change). That client
    // re-resolve must carry the frame's name as its `target` (the same
    // resolveClientFrame path as #11500) instead of resolving target-less.
    let reloadParent: undefined | (() => Promise<AbortSignal>)
    let issue = 'a'
    let islandClientTargets: Array<string | undefined> = []

    let CommentsIsland = clientEntry(
      '/assets/comments-island.js#CommentsIsland',
      function CommentsIsland(handle: Handle<{ issue: string }>) {
        return () => (
          <div className="comments-island">
            <Frame
              name="island"
              key={handle.props.issue}
              src={`/comments?issue=${handle.props.issue}`}
              fallback={<span id="island-fallback">Loading island…</span>}
            />
          </div>
        )
      },
    )

    let IslandParent = clientEntry(
      '/assets/island-parent.js#IslandParent',
      function IslandParent(handle: Handle) {
        reloadParent = async () => {
          issue = 'b'
          return await handle.frame.reload()
        }
        return () => <button id="reload-island-parent">Reload detail</button>
      },
    )

    function renderParentFrame() {
      return renderToStream(
        <>
          <section id="island-shell">
            <CommentsIsland issue={issue} />
          </section>
          <IslandParent />
        </>,
        {
          // Server resolves the island in-stream with its target.
          resolveFrame(src: string) {
            if (src.startsWith('/comments')) {
              return `<p id="island-content" data-server-issue="${issue}">island ${issue}</p>`
            }
            throw new Error(`Unexpected frame src during parent render: ${src}`)
          },
        },
      )
    }

    let initialDocument = new DOMParser().parseFromString(
      await drainWithProtocol(
        renderToStream(
          <html>
            <head />
            <body>
              <main>
                <Frame name="detail" src="/detail" />
              </main>
            </body>
          </html>,
          {
            resolveFrame(src: string) {
              if (src === '/detail') return renderParentFrame()
              throw new Error(`Unexpected frame src: ${src}`)
            },
          },
        ),
      ),
      'text/html',
    )
    document.documentElement.innerHTML = initialDocument.documentElement.innerHTML

    let app = run({
      loadModule(moduleUrl, exportName) {
        if (moduleUrl === '/assets/comments-island.js' && exportName === 'CommentsIsland') {
          return CommentsIsland
        }
        if (moduleUrl === '/assets/island-parent.js' && exportName === 'IslandParent') {
          return IslandParent
        }
        throw new Error(`Unexpected module: ${moduleUrl}#${exportName}`)
      },
      resolveFrame(src: string, options) {
        if (src === '/detail') return renderParentFrame()
        if (src.startsWith('/comments')) {
          // The client re-resolve of the nested clientEntry frame on ancestor reload.
          islandClientTargets.push(options?.target)
          return `<p id="island-content" data-client-issue="${issue}">island ${issue} (client)</p>`
        }
        throw new Error(`Unexpected frame src: ${src}`)
      },
    })

    await app.ready()

    // Initial load: the island was server-resolved and adopted (no client re-resolve).
    expect(islandClientTargets).toEqual([])
    expect(document.getElementById('island-content')?.getAttribute('data-server-issue')).toBe('a')

    invariant(reloadParent)
    let reloadPromise = reloadParent()
    await reloadPromise
    await waitForElement('#island-content[data-client-issue]')

    // The ancestor reload remounts the clientEntry's keyed frame, which re-resolves
    // on the client exactly once. That re-resolve must carry the frame's name as its
    // target; pinning the count also guards against a silent marker-adoption regression.
    expect(islandClientTargets).toEqual(['island'])

    app.dispose()
  })

  it('reloads frames inside preserved client entries after server-driven entry rerenders', async () => {
    let reloadTop: undefined | (() => Promise<AbortSignal>)
    let entryFrameEvents: string[] = []
    let [entryFrameReloaded, markEntryFrameReloaded] = withResolvers<void>()
    let entryFrameServerResolveCount = 0

    let EntryWithFrame = clientEntry(
      '/assets/entry-with-frame.js#EntryWithFrame',
      function EntryWithFrame(handle: Handle<{ label: string }>) {
        reloadTop = () => handle.frames.top.reload()
        return () => (
          <section>
            <p id="entry-label">{handle.props.label}</p>
            <Frame
              name="entry-frame"
              src="/entry-frame"
              fallback={<span id="entry-frame">Loading entry frame...</span>}
            />
          </section>
        )
      },
    )

    let EntryFrameObserver = clientEntry(
      '/assets/entry-frame-observer.js#EntryFrameObserver',
      function EntryFrameObserver(handle: Handle) {
        let listening = false
        return () => {
          handle.queueTask(() => {
            if (!listening) {
              let entryFrame = handle.frames.get('entry-frame')
              invariant(entryFrame, 'Expected entry frame handle')
              entryFrame.addEventListener('reloadStart', () => entryFrameEvents.push('start'), {
                signal: handle.signal,
              })
              entryFrame.addEventListener(
                'reloadComplete',
                () => {
                  entryFrameEvents.push('complete')
                  markEntryFrameReloaded()
                },
                {
                  signal: handle.signal,
                },
              )
              listening = true
            }
          })

          return null
        }
      },
    )

    async function renderPage(label: string, frameLabel: string): Promise<string> {
      return await drain(renderPageStream(label, frameLabel))
    }

    function renderPageStream(label: string, frameLabel: string): ReadableStream<Uint8Array> {
      return renderToStream(
        <html>
          <body>
            <main>
              <EntryFrameObserver />
              <EntryWithFrame label={label} />
            </main>
          </body>
        </html>,
        {
          resolveFrame(src: string) {
            if (src === '/entry-frame') {
              entryFrameServerResolveCount++
              return `<span id="entry-frame">${frameLabel}</span>`
            }
            throw new Error(`Unexpected frame src during server render: ${src}`)
          },
        },
      )
    }

    let serverHtml = await renderPage('Initial entry', 'Initial entry frame')
    let initialDocument = new DOMParser().parseFromString(serverHtml, 'text/html')
    document.documentElement.innerHTML = initialDocument.documentElement.innerHTML

    let entryFrameResolveCount = 0

    let app = run({
      loadModule(moduleUrl, exportName) {
        if (moduleUrl === '/assets/entry-with-frame.js' && exportName === 'EntryWithFrame') {
          return EntryWithFrame
        }
        if (
          moduleUrl === '/assets/entry-frame-observer.js' &&
          exportName === 'EntryFrameObserver'
        ) {
          return EntryFrameObserver
        }
        throw new Error(`Unexpected module: ${moduleUrl}#${exportName}`)
      },
      async resolveFrame(src: string) {
        if (src === document.location.href) {
          return renderPageStream('Reloaded entry', 'Unused streamed entry frame')
        }
        if (src === '/entry-frame') {
          entryFrameResolveCount++
          return '<span id="entry-frame">Reloaded entry frame</span>'
        }
        throw new Error(`Unexpected frame src: ${src}`)
      },
    })

    await app.ready()

    expect(document.getElementById('entry-label')?.textContent).toBe('Initial entry')
    expect(document.getElementById('entry-frame')?.textContent).toBe('Initial entry frame')
    expect(entryFrameEvents).toEqual([])
    expect(entryFrameServerResolveCount).toBe(1)
    expect(entryFrameResolveCount).toBe(0)

    invariant(reloadTop)
    await Promise.all([reloadTop(), entryFrameReloaded])

    expect(document.getElementById('entry-label')?.textContent).toBe('Reloaded entry')
    expect(document.getElementById('entry-frame')?.textContent).toBe('Reloaded entry frame')
    expect(entryFrameEvents).toEqual(['start', 'complete'])
    expect(entryFrameServerResolveCount).toBe(2)
    expect(entryFrameResolveCount).toBe(1)
    app.dispose()
  })

  it('reloads blocking frames inside preserved client entries after server-driven entry rerenders', async () => {
    let reloadTop: undefined | (() => Promise<AbortSignal>)
    let serverFrameResolveCount = 0
    let clientFrameResolveCount = 0

    let EntryWithFrame = clientEntry(
      '/assets/entry-with-server-frame.js#EntryWithServerFrame',
      function EntryWithServerFrame(handle: Handle<{ label: string }>) {
        reloadTop = () => handle.frames.top.reload()
        return () => (
          <section>
            <p id="entry-label">{handle.props.label}</p>
            <Frame name="entry-frame" src="/entry-frame" />
          </section>
        )
      },
    )

    async function renderPage(label: string, frameLabel: string): Promise<string> {
      return await drain(renderPageStream(label, frameLabel))
    }

    async function renderPageWithProtocol(label: string, frameLabel: string): Promise<string> {
      return await drainWithProtocol(renderPageStream(label, frameLabel))
    }

    function renderPageStream(label: string, frameLabel: string): ReadableStream<Uint8Array> {
      return renderToStream(
        <html>
          <body>
            <main>
              <EntryWithFrame label={label} />
            </main>
          </body>
        </html>,
        {
          resolveFrame(src: string) {
            if (src === '/entry-frame') {
              serverFrameResolveCount++
              return `<span id="entry-frame">${frameLabel}</span>`
            }
            throw new Error(`Unexpected frame src during server render: ${src}`)
          },
        },
      )
    }

    let serverHtml = await renderPage('Initial entry', 'Initial entry frame')
    let initialDocument = new DOMParser().parseFromString(serverHtml, 'text/html')
    document.documentElement.innerHTML = initialDocument.documentElement.innerHTML

    let app = run({
      loadModule(moduleUrl, exportName) {
        if (
          moduleUrl === '/assets/entry-with-server-frame.js' &&
          exportName === 'EntryWithServerFrame'
        ) {
          return EntryWithFrame
        }
        throw new Error(`Unexpected module: ${moduleUrl}#${exportName}`)
      },
      async resolveFrame(src: string) {
        if (src === document.location.href) {
          return streamFromChunks([
            await renderPageWithProtocol('Reloaded entry', 'Server-provided entry frame'),
          ])
        }
        if (src === '/entry-frame') {
          clientFrameResolveCount++
          return '<span id="entry-frame">Reloaded entry frame</span>'
        }
        throw new Error(`Unexpected frame src: ${src}`)
      },
    })

    await app.ready()

    expect(document.getElementById('entry-label')?.textContent).toBe('Initial entry')
    expect(document.getElementById('entry-frame')?.textContent).toBe('Initial entry frame')
    expect(serverFrameResolveCount).toBe(1)
    expect(clientFrameResolveCount).toBe(0)

    invariant(reloadTop)
    await reloadTop()
    await waitForText('#entry-frame', 'Reloaded entry frame')

    expect(document.getElementById('entry-label')?.textContent).toBe('Reloaded entry')
    expect(document.getElementById('entry-frame')?.textContent).toBe('Reloaded entry frame')
    expect(serverFrameResolveCount).toBe(2)
    expect(clientFrameResolveCount).toBe(1)
    app.dispose()
  })

  it('reloads nested frames inside blocking frames rendered by preserved client entries', async () => {
    let reloadTop: undefined | (() => Promise<AbortSignal>)
    let renderClientOnlyFrame = false
    let blockingFrameServerResolveCount = 0
    let blockingFrameClientResolveCount = 0
    let clientOnlyFrameClientResolveCount = 0

    let ClientOnlyFrameEntry = clientEntry(
      '/assets/blocking-frame-client-only-entry.js#BlockingFrameClientOnlyEntry',
      function BlockingFrameClientOnlyEntry(handle: Handle<{ label: string }>) {
        return () => {
          handle.queueTask(() => {
            if (renderClientOnlyFrame) return
            renderClientOnlyFrame = true
            void handle.update()
          })

          return (
            <section>
              <p id="blocking-entry-label">{handle.props.label}</p>
              {renderClientOnlyFrame ? (
                <Frame
                  name="blocking-client-only-frame"
                  src="/blocking-client-only-frame"
                  fallback={
                    <span id="blocking-client-only-frame">Loading blocking client frame...</span>
                  }
                />
              ) : null}
            </section>
          )
        }
      },
    )

    let EntryWithBlockingFrame = clientEntry(
      '/assets/entry-with-blocking-frame.js#EntryWithBlockingFrame',
      function EntryWithBlockingFrame(handle: Handle<{ label: string }>) {
        reloadTop = () => handle.frames.top.reload()
        return () => (
          <section>
            <p id="entry-label">{handle.props.label}</p>
            <Frame name="blocking-frame" src="/blocking-frame" />
          </section>
        )
      },
    )

    async function renderBlockingFrame(label: string): Promise<string> {
      let previousRenderClientOnlyFrame = renderClientOnlyFrame
      renderClientOnlyFrame = false
      return await drain(
        renderToStream(<ClientOnlyFrameEntry label={label} />, {
          resolveFrame(src: string) {
            throw new Error(`Unexpected blocking frame src during server render: ${src}`)
          },
        }),
      ).finally(() => {
        renderClientOnlyFrame = previousRenderClientOnlyFrame
      })
    }

    async function renderPage(label: string, blockingLabel: string): Promise<string> {
      return await drain(renderPageStream(label, blockingLabel))
    }

    async function renderPageWithProtocol(label: string, blockingLabel: string): Promise<string> {
      return await drainWithProtocol(renderPageStream(label, blockingLabel))
    }

    function renderPageStream(label: string, blockingLabel: string): ReadableStream<Uint8Array> {
      return renderToStream(
        <html>
          <body>
            <main>
              <EntryWithBlockingFrame label={label} />
            </main>
          </body>
        </html>,
        {
          resolveFrame(src: string) {
            if (src === '/blocking-frame') {
              blockingFrameServerResolveCount++
              return renderBlockingFrame(blockingLabel)
            }
            throw new Error(`Unexpected frame src during server render: ${src}`)
          },
        },
      )
    }

    let serverHtml = await renderPage('Initial entry', 'Initial blocking entry')
    let initialDocument = new DOMParser().parseFromString(serverHtml, 'text/html')
    document.documentElement.innerHTML = initialDocument.documentElement.innerHTML

    let app = run({
      loadModule(moduleUrl, exportName) {
        if (
          moduleUrl === '/assets/entry-with-blocking-frame.js' &&
          exportName === 'EntryWithBlockingFrame'
        ) {
          return EntryWithBlockingFrame
        }
        if (
          moduleUrl === '/assets/blocking-frame-client-only-entry.js' &&
          exportName === 'BlockingFrameClientOnlyEntry'
        ) {
          return ClientOnlyFrameEntry
        }
        throw new Error(`Unexpected module: ${moduleUrl}#${exportName}`)
      },
      async resolveFrame(src: string) {
        if (src === document.location.href) {
          return streamFromChunks([
            await renderPageWithProtocol('Reloaded entry', 'Reloaded blocking entry'),
          ])
        }
        if (src === '/blocking-frame') {
          blockingFrameClientResolveCount++
          return await renderBlockingFrame('Reloaded blocking entry from browser')
        }
        if (src === '/blocking-client-only-frame') {
          clientOnlyFrameClientResolveCount++
          return `<span id="blocking-client-only-frame">Blocking client-only frame ${clientOnlyFrameClientResolveCount}</span>`
        }
        throw new Error(`Unexpected frame src: ${src}`)
      },
    })

    await app.ready()
    app.flush()
    await waitForText('#blocking-client-only-frame', 'Blocking client-only frame 1')

    expect(document.getElementById('entry-label')?.textContent).toBe('Initial entry')
    expect(document.getElementById('blocking-entry-label')?.textContent).toBe(
      'Initial blocking entry',
    )
    expect(document.getElementById('blocking-client-only-frame')?.textContent).toBe(
      'Blocking client-only frame 1',
    )
    expect(blockingFrameServerResolveCount).toBe(1)
    expect(blockingFrameClientResolveCount).toBe(0)
    expect(clientOnlyFrameClientResolveCount).toBe(1)

    invariant(reloadTop)
    await reloadTop()
    await waitForText('#blocking-client-only-frame', 'Blocking client-only frame 2')

    expect(document.getElementById('entry-label')?.textContent).toBe('Reloaded entry')
    expect(document.getElementById('blocking-entry-label')?.textContent).toBe(
      'Reloaded blocking entry from browser',
    )
    expect(document.getElementById('blocking-client-only-frame')?.textContent).toBe(
      'Blocking client-only frame 2',
    )
    expect(blockingFrameServerResolveCount).toBe(2)
    expect(blockingFrameClientResolveCount).toBe(1)
    expect(clientOnlyFrameClientResolveCount).toBe(2)
    app.dispose()
  })

  it('reloads all frames rendered by preserved client entries when they share a src', async () => {
    let reloadTop: undefined | (() => Promise<AbortSignal>)
    let renderClientOnlyFrame = false
    let serverFrameResolveCount = 0
    let clientFrameResolveCount = 0

    let EntryWithSharedFrame = clientEntry(
      '/assets/entry-with-shared-frame.js#EntryWithSharedFrame',
      function EntryWithSharedFrame(handle: Handle<{ label: string }>) {
        reloadTop = () => handle.frames.top.reload()
        return () => {
          handle.queueTask(() => {
            if (renderClientOnlyFrame) return
            renderClientOnlyFrame = true
            void handle.update()
          })

          return (
            <section>
              <p id="entry-label">{handle.props.label}</p>
              <Frame
                src="/shared-frame"
                fallback={<span id="server-shared-frame">Loading server frame...</span>}
              />
              {renderClientOnlyFrame ? (
                <Frame
                  src="/shared-frame"
                  fallback={<span id="client-shared-frame">Loading client frame...</span>}
                />
              ) : null}
            </section>
          )
        }
      },
    )

    async function renderPage(label: string, serverFrameLabel: string): Promise<string> {
      let previousRenderClientOnlyFrame = renderClientOnlyFrame
      renderClientOnlyFrame = false
      try {
        return await drain(renderPageStream(label, serverFrameLabel))
      } finally {
        renderClientOnlyFrame = previousRenderClientOnlyFrame
      }
    }

    async function renderPageWithProtocol(
      label: string,
      serverFrameLabel: string,
    ): Promise<string> {
      let previousRenderClientOnlyFrame = renderClientOnlyFrame
      renderClientOnlyFrame = false
      try {
        return await drainWithProtocol(renderPageStream(label, serverFrameLabel))
      } finally {
        renderClientOnlyFrame = previousRenderClientOnlyFrame
      }
    }

    function renderPageStream(label: string, serverFrameLabel: string): ReadableStream<Uint8Array> {
      return renderToStream(
        <html>
          <body>
            <main>
              <EntryWithSharedFrame label={label} />
            </main>
          </body>
        </html>,
        {
          resolveFrame(src: string) {
            if (src === '/shared-frame') {
              serverFrameResolveCount++
              return `<span id="server-shared-frame">${serverFrameLabel}</span>`
            }
            throw new Error(`Unexpected frame src during server render: ${src}`)
          },
        },
      )
    }

    let serverHtml = await renderPage('Initial entry', 'Initial server frame')
    let initialDocument = new DOMParser().parseFromString(serverHtml, 'text/html')
    document.documentElement.innerHTML = initialDocument.documentElement.innerHTML

    let app = run({
      loadModule(moduleUrl, exportName) {
        if (
          moduleUrl === '/assets/entry-with-shared-frame.js' &&
          exportName === 'EntryWithSharedFrame'
        ) {
          return EntryWithSharedFrame
        }
        throw new Error(`Unexpected module: ${moduleUrl}#${exportName}`)
      },
      async resolveFrame(src: string) {
        if (src === document.location.href) {
          return streamFromChunks([
            await renderPageWithProtocol('Reloaded entry', 'Reloaded server frame'),
          ])
        }
        if (src === '/shared-frame') {
          clientFrameResolveCount++
          return `<span data-shared-frame="client">Client shared frame ${clientFrameResolveCount}</span>`
        }
        throw new Error(`Unexpected frame src: ${src}`)
      },
    })

    await app.ready()
    app.flush()
    await waitForText('[data-shared-frame="client"]', 'Client shared frame 1')

    expect(document.getElementById('entry-label')?.textContent).toBe('Initial entry')
    expect(document.getElementById('server-shared-frame')?.textContent).toBe('Initial server frame')
    expect(
      Array.from(document.querySelectorAll('[data-shared-frame="client"]')).map(
        (node) => node.textContent,
      ),
    ).toEqual(['Client shared frame 1'])
    expect(serverFrameResolveCount).toBe(1)
    expect(clientFrameResolveCount).toBe(1)

    invariant(reloadTop)
    await reloadTop()
    await waitForTexts('[data-shared-frame="client"]', [
      'Client shared frame 2',
      'Client shared frame 3',
    ])

    expect(document.getElementById('entry-label')?.textContent).toBe('Reloaded entry')
    expect(
      Array.from(document.querySelectorAll('[data-shared-frame="client"]')).map(
        (node) => node.textContent,
      ),
    ).toEqual(['Client shared frame 2', 'Client shared frame 3'])
    expect(serverFrameResolveCount).toBe(2)
    expect(clientFrameResolveCount).toBe(3)
    app.dispose()
  })

  it('reloads frames inside nested frames rendered by preserved client entries', async () => {
    let reloadTop: undefined | (() => Promise<AbortSignal>)
    let renderClientOnlyFrame = false
    let outerFrameServerResolveCount = 0
    let middleFrameServerResolveCount = 0
    let outerFrameClientResolveCount = 0
    let middleFrameClientResolveCount = 0
    let clientOnlyFrameClientResolveCount = 0

    let ClientOnlyFrameEntry = clientEntry(
      '/assets/nested-client-only-frame-entry.js#NestedClientOnlyFrameEntry',
      function NestedClientOnlyFrameEntry(handle: Handle<{ label: string }>) {
        return () => {
          handle.queueTask(() => {
            if (renderClientOnlyFrame) return
            renderClientOnlyFrame = true
            void handle.update()
          })

          return (
            <section>
              <p id="middle-entry-label">{handle.props.label}</p>
              {renderClientOnlyFrame ? (
                <Frame
                  name="client-only-inner-frame"
                  src="/client-only-inner-frame"
                  fallback={<span id="client-only-inner-frame">Loading client-only frame...</span>}
                />
              ) : null}
            </section>
          )
        }
      },
    )

    let NestedEntryWithMiddleFrame = clientEntry(
      '/assets/nested-entry-with-middle-frame.js#NestedEntryWithMiddleFrame',
      function NestedEntryWithMiddleFrame(handle: Handle<{ label: string }>) {
        return () => (
          <section>
            <p id="nested-entry-label">{handle.props.label}</p>
            <Frame
              name="middle-frame"
              src="/middle-frame"
              fallback={<span id="middle-frame">Loading middle frame...</span>}
            />
          </section>
        )
      },
    )

    let EntryWithOuterFrame = clientEntry(
      '/assets/entry-with-outer-frame.js#EntryWithOuterFrame',
      function EntryWithOuterFrame(handle: Handle<{ label: string }>) {
        reloadTop = () => handle.frames.top.reload()
        return () => (
          <section>
            <p id="entry-label">{handle.props.label}</p>
            <Frame
              name="outer-frame"
              src="/outer-frame"
              fallback={<span id="outer-frame">Loading outer frame...</span>}
            />
          </section>
        )
      },
    )

    async function renderMiddleFrame(label: string): Promise<string> {
      let previousRenderClientOnlyFrame = renderClientOnlyFrame
      renderClientOnlyFrame = false
      return await drain(
        renderToStream(<ClientOnlyFrameEntry label={label} />, {
          resolveFrame(src: string) {
            throw new Error(`Unexpected nested frame src during server render: ${src}`)
          },
        }),
      ).finally(() => {
        renderClientOnlyFrame = previousRenderClientOnlyFrame
      })
    }

    async function renderOuterFrame(label: string, middleLabel: string): Promise<string> {
      return await drain(
        renderToStream(<NestedEntryWithMiddleFrame label={label} />, {
          resolveFrame(src: string) {
            if (src === '/middle-frame') {
              middleFrameServerResolveCount++
              return renderMiddleFrame(middleLabel)
            }
            throw new Error(`Unexpected outer frame src during server render: ${src}`)
          },
        }),
      )
    }

    async function renderPage(
      label: string,
      nestedLabel: string,
      middleLabel: string,
    ): Promise<string> {
      return await drain(renderPageStream(label, nestedLabel, middleLabel))
    }

    async function renderPageWithProtocol(
      label: string,
      nestedLabel: string,
      middleLabel: string,
    ): Promise<string> {
      return await drainWithProtocol(renderPageStream(label, nestedLabel, middleLabel))
    }

    function renderPageStream(
      label: string,
      nestedLabel: string,
      middleLabel: string,
    ): ReadableStream<Uint8Array> {
      return renderToStream(
        <html>
          <body>
            <main>
              <EntryWithOuterFrame label={label} />
            </main>
          </body>
        </html>,
        {
          resolveFrame(src: string) {
            if (src === '/outer-frame') {
              outerFrameServerResolveCount++
              return renderOuterFrame(nestedLabel, middleLabel)
            }
            throw new Error(`Unexpected frame src during server render: ${src}`)
          },
        },
      )
    }

    let serverHtml = await renderPage(
      'Initial entry',
      'Initial nested entry',
      'Initial middle entry',
    )
    let initialDocument = new DOMParser().parseFromString(serverHtml, 'text/html')
    document.documentElement.innerHTML = initialDocument.documentElement.innerHTML

    let app = run({
      loadModule(moduleUrl, exportName) {
        if (
          moduleUrl === '/assets/entry-with-outer-frame.js' &&
          exportName === 'EntryWithOuterFrame'
        ) {
          return EntryWithOuterFrame
        }
        if (
          moduleUrl === '/assets/nested-entry-with-middle-frame.js' &&
          exportName === 'NestedEntryWithMiddleFrame'
        ) {
          return NestedEntryWithMiddleFrame
        }
        if (
          moduleUrl === '/assets/nested-client-only-frame-entry.js' &&
          exportName === 'NestedClientOnlyFrameEntry'
        ) {
          return ClientOnlyFrameEntry
        }
        throw new Error(`Unexpected module: ${moduleUrl}#${exportName}`)
      },
      async resolveFrame(src: string) {
        if (src === document.location.href) {
          return streamFromChunks([
            await renderPageWithProtocol(
              'Reloaded entry',
              'Reloaded nested entry',
              'Reloaded middle entry',
            ),
          ])
        }
        if (src === '/outer-frame') {
          outerFrameClientResolveCount++
          return await renderOuterFrame(
            'Reloaded nested entry from browser',
            'Reloaded middle entry from browser',
          )
        }
        if (src === '/middle-frame') {
          middleFrameClientResolveCount++
          return await renderMiddleFrame('Reloaded middle entry from browser')
        }
        if (src === '/client-only-inner-frame') {
          clientOnlyFrameClientResolveCount++
          return `<span id="client-only-inner-frame">Client-only inner frame ${clientOnlyFrameClientResolveCount}</span>`
        }
        throw new Error(`Unexpected frame src: ${src}`)
      },
    })

    await app.ready()
    app.flush()
    await waitForText('#client-only-inner-frame', 'Client-only inner frame 1')

    expect(document.getElementById('entry-label')?.textContent).toBe('Initial entry')
    expect(document.getElementById('nested-entry-label')?.textContent).toBe('Initial nested entry')
    expect(document.getElementById('middle-entry-label')?.textContent).toBe('Initial middle entry')
    expect(document.getElementById('client-only-inner-frame')?.textContent).toBe(
      'Client-only inner frame 1',
    )
    expect(outerFrameServerResolveCount).toBe(1)
    expect(middleFrameServerResolveCount).toBe(1)
    expect(outerFrameClientResolveCount).toBe(0)
    expect(middleFrameClientResolveCount).toBe(0)
    expect(clientOnlyFrameClientResolveCount).toBe(1)

    invariant(reloadTop)
    await reloadTop()
    await waitForDom(
      () =>
        document.getElementById('nested-entry-label')?.textContent ===
          'Reloaded nested entry from browser' &&
        document.getElementById('middle-entry-label')?.textContent ===
          'Reloaded middle entry from browser' &&
        document.getElementById('client-only-inner-frame')?.textContent ===
          'Client-only inner frame 2',
    )

    expect(document.getElementById('entry-label')?.textContent).toBe('Reloaded entry')
    expect(document.getElementById('nested-entry-label')?.textContent).toBe(
      'Reloaded nested entry from browser',
    )
    expect(document.getElementById('middle-entry-label')?.textContent).toBe(
      'Reloaded middle entry from browser',
    )
    expect(document.getElementById('client-only-inner-frame')?.textContent).toBe(
      'Client-only inner frame 2',
    )
    expect(outerFrameServerResolveCount).toBe(2)
    expect(middleFrameServerResolveCount).toBe(3)
    expect(outerFrameClientResolveCount).toBe(1)
    expect(middleFrameClientResolveCount).toBe(1)
    expect(clientOnlyFrameClientResolveCount).toBe(2)
    app.dispose()
  })

  it('does not wait for frames inside preserved client entries to finish reloading', async () => {
    let reloadTop: undefined | (() => Promise<AbortSignal>)
    let entryFrameEvents: string[] = []
    let [entryFrameReloaded, markEntryFrameReloaded] = withResolvers<void>()

    let EntryWithPendingFrame = clientEntry(
      '/assets/entry-with-pending-frame.js#EntryWithPendingFrame',
      function EntryWithPendingFrame(handle: Handle<{ label: string }>) {
        reloadTop = () => handle.frames.top.reload()
        handle.queueTask(() => {
          let entryFrame = handle.frames.get('entry-frame')
          invariant(entryFrame, 'Expected entry frame handle')
          entryFrame.addEventListener('reloadStart', () => entryFrameEvents.push('start'), {
            signal: handle.signal,
          })
          entryFrame.addEventListener(
            'reloadComplete',
            () => {
              entryFrameEvents.push('complete')
              markEntryFrameReloaded()
            },
            { signal: handle.signal },
          )
        })
        return () => (
          <section>
            <p id="entry-label">{handle.props.label}</p>
            <Frame
              name="entry-frame"
              src="/entry-frame"
              fallback={<span id="entry-frame">Loading entry frame...</span>}
            />
          </section>
        )
      },
    )

    async function renderPage(label: string, frameLabel: string): Promise<string> {
      return await drain(renderPageStream(label, frameLabel))
    }

    async function renderPageWithProtocol(label: string, frameLabel: string): Promise<string> {
      return await drainWithProtocol(renderPageStream(label, frameLabel))
    }

    function renderPageStream(label: string, frameLabel: string): ReadableStream<Uint8Array> {
      return renderToStream(
        <html>
          <body>
            <main>
              <EntryWithPendingFrame label={label} />
            </main>
          </body>
        </html>,
        {
          resolveFrame(src: string) {
            if (src === '/entry-frame') {
              return `<span id="entry-frame">${frameLabel}</span>`
            }
            throw new Error(`Unexpected frame src during server render: ${src}`)
          },
        },
      )
    }

    let serverHtml = await renderPage('Initial entry', 'Initial entry frame')
    let initialDocument = new DOMParser().parseFromString(serverHtml, 'text/html')
    document.documentElement.innerHTML = initialDocument.documentElement.innerHTML

    let [entryFrameContentPromise, resolveEntryFrameContent] = withResolvers<string>()

    let app = run({
      loadModule(moduleUrl, exportName) {
        if (
          moduleUrl === '/assets/entry-with-pending-frame.js' &&
          exportName === 'EntryWithPendingFrame'
        ) {
          return EntryWithPendingFrame
        }
        throw new Error(`Unexpected module: ${moduleUrl}#${exportName}`)
      },
      async resolveFrame(src: string) {
        if (src === document.location.href) {
          return streamFromChunks([
            await renderPageWithProtocol('Reloaded entry', 'Unused streamed entry frame'),
          ])
        }
        if (src === '/entry-frame') {
          return entryFrameContentPromise
        }
        throw new Error(`Unexpected frame src: ${src}`)
      },
    })

    await app.ready()

    invariant(reloadTop)
    // The entry frame content is still unresolved, so this only settles if the top reload doesn't
    // wait for it.
    await reloadTop()

    expect(document.getElementById('entry-label')?.textContent).toBe('Reloaded entry')
    expect(document.getElementById('entry-frame')?.textContent).toBe('Initial entry frame')
    expect(entryFrameEvents).toEqual(['start'])

    resolveEntryFrameContent('<span id="entry-frame">Reloaded entry frame</span>')
    await Promise.all([waitForText('#entry-frame', 'Reloaded entry frame'), entryFrameReloaded])

    expect(document.getElementById('entry-frame')?.textContent).toBe('Reloaded entry frame')
    expect(entryFrameEvents).toEqual(['start', 'complete'])
    app.dispose()
  })

  it('restarts pending frames inside preserved client entries during ancestor reloads', async () => {
    let reloadTop: undefined | (() => Promise<AbortSignal>)
    let renderClientFrame = false

    let EntryWithPendingFrame = clientEntry(
      '/assets/entry-with-initially-pending-frame.js#EntryWithInitiallyPendingFrame',
      function EntryWithInitiallyPendingFrame(handle: Handle<{ label: string }>) {
        reloadTop = () => handle.frames.top.reload()
        return () => {
          handle.queueTask(() => {
            if (renderClientFrame) return
            renderClientFrame = true
            void handle.update()
          })

          return (
            <section>
              <p id="entry-label">{handle.props.label}</p>
              {renderClientFrame ? (
                <Frame
                  name="entry-frame"
                  src="/entry-frame"
                  fallback={<span id="entry-frame">Loading entry frame...</span>}
                />
              ) : null}
            </section>
          )
        }
      },
    )

    async function renderPageWithProtocol(label: string): Promise<string> {
      let previousRenderClientFrame = renderClientFrame
      renderClientFrame = false
      try {
        return await drainWithProtocol(
          renderToStream(
            <html>
              <body>
                <main>
                  <EntryWithPendingFrame label={label} />
                </main>
              </body>
            </html>,
          ),
        )
      } finally {
        renderClientFrame = previousRenderClientFrame
      }
    }

    let initialDocument = new DOMParser().parseFromString(
      await renderPageWithProtocol('Initial entry'),
      'text/html',
    )
    document.documentElement.innerHTML = initialDocument.documentElement.innerHTML

    let entryFrameSignals: AbortSignal[] = []
    let entryFrameResolvers: Array<(content: string) => void> = []
    let entryFrameRequests = [withResolvers<void>(), withResolvers<void>()]

    let app = run({
      loadModule(moduleUrl, exportName) {
        if (
          moduleUrl === '/assets/entry-with-initially-pending-frame.js' &&
          exportName === 'EntryWithInitiallyPendingFrame'
        ) {
          return EntryWithPendingFrame
        }
        throw new Error(`Unexpected module: ${moduleUrl}#${exportName}`)
      },
      async resolveFrame(src: string, options) {
        let signal = options?.signal
        if (src === document.location.href) {
          return streamFromChunks([await renderPageWithProtocol('Reloaded entry')])
        }
        if (src === '/entry-frame') {
          invariant(signal, 'Expected entry frame resolve signal')
          let [contentPromise, resolveContent] = withResolvers<string>()
          entryFrameSignals.push(signal)
          entryFrameResolvers.push(resolveContent)
          entryFrameRequests[entryFrameSignals.length - 1]?.[1]()
          return contentPromise
        }
        throw new Error(`Unexpected frame src: ${src}`)
      },
    })

    await app.ready()
    await entryFrameRequests[0]![0]

    expect(entryFrameSignals).toHaveLength(1)
    expect(document.getElementById('entry-frame')?.textContent).toBe('Loading entry frame...')

    invariant(reloadTop)
    await reloadTop()
    await entryFrameRequests[1]![0]

    expect(entryFrameSignals).toHaveLength(2)
    expect(entryFrameSignals[0]?.aborted).toBe(true)
    expect(entryFrameSignals[1]?.aborted).toBe(false)

    let renderedText = recordRenderedText()
    entryFrameResolvers[0]?.('<span id="entry-frame">Stale entry frame</span>')

    expect(document.getElementById('entry-label')?.textContent).toBe('Reloaded entry')
    expect(document.getElementById('entry-frame')?.textContent).toBe('Loading entry frame...')

    // The stale resolution settles before the fresh one, so it would render first if not ignored.
    entryFrameResolvers[1]?.('<span id="entry-frame">Reloaded entry frame</span>')
    await waitForText('#entry-frame', 'Reloaded entry frame')

    expect(renderedText.stop().some((text) => text.includes('Stale entry frame'))).toBe(false)
    expect(document.getElementById('entry-frame')?.textContent).toBe('Reloaded entry frame')
    app.dispose()
  })

  it('cancels an inherited frame reload when a client update changes its src', async () => {
    let reloadTop: undefined | (() => Promise<AbortSignal>)
    let changeFrameSrc: undefined | (() => Promise<AbortSignal>)
    let frameSrc = '/entry-frame-a'

    let EntryWithChangingFrame = clientEntry(
      '/assets/entry-with-racing-frame.js#EntryWithRacingFrame',
      function EntryWithRacingFrame(handle: Handle<{ label: string }>) {
        reloadTop = () => handle.frames.top.reload()
        changeFrameSrc = async () => {
          frameSrc = '/entry-frame-b'
          return await handle.update()
        }
        return () => (
          <section>
            <p id="entry-label">{handle.props.label}</p>
            <Frame
              name="entry-frame"
              src={frameSrc}
              fallback={<span id="entry-frame">Loading entry frame...</span>}
            />
          </section>
        )
      },
    )

    async function renderPageWithProtocol(label: string, frameLabel: string): Promise<string> {
      return await drainWithProtocol(
        renderToStream(
          <html>
            <body>
              <main>
                <EntryWithChangingFrame label={label} />
              </main>
            </body>
          </html>,
          {
            resolveFrame(src: string) {
              if (src === '/entry-frame-a') {
                return `<span id="entry-frame">${frameLabel}</span>`
              }
              throw new Error(`Unexpected frame src during server render: ${src}`)
            },
          },
        ),
      )
    }

    let initialDocument = new DOMParser().parseFromString(
      await renderPageWithProtocol('Initial entry', 'Initial entry frame'),
      'text/html',
    )
    document.documentElement.innerHTML = initialDocument.documentElement.innerHTML

    let inheritedFrameSignal: AbortSignal | undefined
    let [inheritedFrameContentPromise, resolveInheritedFrameContent] = withResolvers<string>()
    let [inheritedFrameRequested, markInheritedFrameRequested] = withResolvers<void>()
    let [updatedFrameContentPromise, resolveUpdatedFrameContent] = withResolvers<string>()
    let [updatedFrameRequested, markUpdatedFrameRequested] = withResolvers<void>()

    let app = run({
      loadModule(moduleUrl, exportName) {
        if (
          moduleUrl === '/assets/entry-with-racing-frame.js' &&
          exportName === 'EntryWithRacingFrame'
        ) {
          return EntryWithChangingFrame
        }
        throw new Error(`Unexpected module: ${moduleUrl}#${exportName}`)
      },
      async resolveFrame(src: string, options) {
        let signal = options?.signal
        if (src === document.location.href) {
          return streamFromChunks([
            await renderPageWithProtocol('Reloaded entry', 'Unused streamed entry frame'),
          ])
        }
        if (src === '/entry-frame-a') {
          inheritedFrameSignal = signal
          markInheritedFrameRequested()
          return inheritedFrameContentPromise
        }
        if (src === '/entry-frame-b') {
          markUpdatedFrameRequested()
          return updatedFrameContentPromise
        }
        throw new Error(`Unexpected frame src: ${src}`)
      },
    })

    await app.ready()

    invariant(reloadTop)
    invariant(changeFrameSrc)
    let clientChangeFrameSrc = changeFrameSrc
    await Promise.all([reloadTop(), inheritedFrameRequested])

    expect(inheritedFrameSignal?.aborted).toBe(false)

    await Promise.all([clientChangeFrameSrc(), updatedFrameRequested])

    expect(inheritedFrameSignal?.aborted).toBe(true)

    // The stale resolution settles before the fresh one, so it would render first if not ignored.
    let renderedText = recordRenderedText()
    resolveInheritedFrameContent('<span id="entry-frame">Stale inherited frame</span>')
    resolveUpdatedFrameContent('<span id="entry-frame">Updated entry frame</span>')
    await waitForText('#entry-frame', 'Updated entry frame')

    expect(renderedText.stop().some((text) => text.includes('Stale inherited frame'))).toBe(false)
    expect(document.getElementById('entry-frame')?.textContent).toBe('Updated entry frame')
    app.dispose()
  })

  it('ignores stale frame reloads from superseded preserved client entry rerenders', async () => {
    let reloadTop: undefined | (() => Promise<AbortSignal>)

    let EntryWithPendingFrame = clientEntry(
      '/assets/entry-with-superseded-frame.js#EntryWithSupersededFrame',
      function EntryWithSupersededFrame(handle: Handle<{ label: string }>) {
        reloadTop = () => handle.frames.top.reload()
        return () => (
          <section>
            <p id="entry-label">{handle.props.label}</p>
            <Frame
              name="entry-frame"
              src="/entry-frame"
              fallback={<span id="entry-frame">Loading entry frame...</span>}
            />
          </section>
        )
      },
    )

    async function renderPage(label: string, frameLabel: string): Promise<string> {
      return await drain(renderPageStream(label, frameLabel))
    }

    async function renderPageWithProtocol(label: string, frameLabel: string): Promise<string> {
      return await drainWithProtocol(renderPageStream(label, frameLabel))
    }

    function renderPageStream(label: string, frameLabel: string): ReadableStream<Uint8Array> {
      return renderToStream(
        <html>
          <body>
            <main>
              <EntryWithPendingFrame label={label} />
            </main>
          </body>
        </html>,
        {
          resolveFrame(src: string) {
            if (src === '/entry-frame') {
              return `<span id="entry-frame">${frameLabel}</span>`
            }
            throw new Error(`Unexpected frame src during server render: ${src}`)
          },
        },
      )
    }

    let serverHtml = await renderPage('Initial entry', 'Initial entry frame')
    let initialDocument = new DOMParser().parseFromString(serverHtml, 'text/html')
    document.documentElement.innerHTML = initialDocument.documentElement.innerHTML

    let topReloadCount = 0
    let [secondTopContentPromise, resolveSecondTopContent] = withResolvers<string>()
    let entryFrameResolvers: Array<(content: string) => void> = []
    let entryFrameSignals: AbortSignal[] = []
    let entryFrameRequests = [withResolvers<void>(), withResolvers<void>()]

    let app = run({
      loadModule(moduleUrl, exportName) {
        if (
          moduleUrl === '/assets/entry-with-superseded-frame.js' &&
          exportName === 'EntryWithSupersededFrame'
        ) {
          return EntryWithPendingFrame
        }
        throw new Error(`Unexpected module: ${moduleUrl}#${exportName}`)
      },
      async resolveFrame(src: string, options) {
        let signal = options?.signal
        if (src === document.location.href) {
          topReloadCount++
          if (topReloadCount === 1) {
            return streamFromChunks([
              await renderPageWithProtocol('First reload', 'Unused first streamed entry frame'),
            ])
          }
          if (topReloadCount === 2) {
            return streamFromChunks([secondTopContentPromise])
          }
          throw new Error(`Unexpected top reload count: ${topReloadCount}`)
        }
        if (src === '/entry-frame') {
          invariant(signal, 'Expected entry frame reload signal')
          let [entryFrameContentPromise, resolveEntryFrameContent] = withResolvers<string>()
          entryFrameSignals.push(signal)
          entryFrameResolvers.push(resolveEntryFrameContent)
          entryFrameRequests[entryFrameSignals.length - 1]?.[1]()
          return entryFrameContentPromise
        }
        throw new Error(`Unexpected frame src: ${src}`)
      },
    })

    await app.ready()

    invariant(reloadTop)
    let clientReloadTop = reloadTop
    await Promise.all([clientReloadTop(), entryFrameRequests[0]![0]])

    expect(document.getElementById('entry-label')?.textContent).toBe('First reload')
    expect(document.getElementById('entry-frame')?.textContent).toBe('Initial entry frame')
    expect(entryFrameResolvers).toHaveLength(1)

    // Starting the second top reload synchronously aborts the first reload's entry frame request.
    let secondReloadPromise = clientReloadTop()
    expect(entryFrameSignals[0]?.aborted).toBe(true)
    let renderedText = recordRenderedText()
    entryFrameResolvers[0]?.('<span id="entry-frame">Stale entry frame</span>')

    expect(document.getElementById('entry-label')?.textContent).toBe('First reload')
    expect(document.getElementById('entry-frame')?.textContent).toBe('Initial entry frame')

    resolveSecondTopContent(
      await renderPageWithProtocol('Second reload', 'Unused second streamed entry frame'),
    )
    await Promise.all([secondReloadPromise, entryFrameRequests[1]![0]])

    expect(document.getElementById('entry-label')?.textContent).toBe('Second reload')
    expect(document.getElementById('entry-frame')?.textContent).toBe('Initial entry frame')
    expect(entryFrameResolvers).toHaveLength(2)

    entryFrameResolvers[1]?.('<span id="entry-frame">Second entry frame</span>')
    await waitForText('#entry-frame', 'Second entry frame')

    expect(renderedText.stop().some((text) => text.includes('Stale entry frame'))).toBe(false)
    expect(document.getElementById('entry-frame')?.textContent).toBe('Second entry frame')
    app.dispose()
  })

  it('reports reload failures for frames inside preserved client entries', async () => {
    let reloadTop: undefined | (() => Promise<AbortSignal>)
    let entryFrameEvents: string[] = []
    let [entryFrameReloaded, markEntryFrameReloaded] = withResolvers<void>()
    let [errorForwarded, markErrorForwarded] = withResolvers<void>()
    let reloadError = new TypeError('Failed to reload entry frame')

    let EntryWithFailingFrame = clientEntry(
      '/assets/entry-with-failing-frame.js#EntryWithFailingFrame',
      function EntryWithFailingFrame(handle: Handle<{ label: string }>) {
        reloadTop = () => handle.frames.top.reload()
        handle.queueTask(() => {
          let entryFrame = handle.frames.get('entry-frame')
          invariant(entryFrame, 'Expected entry frame handle')
          entryFrame.addEventListener('reloadStart', () => entryFrameEvents.push('start'), {
            signal: handle.signal,
          })
          entryFrame.addEventListener(
            'reloadComplete',
            () => {
              entryFrameEvents.push('complete')
              markEntryFrameReloaded()
            },
            { signal: handle.signal },
          )
        })
        return () => (
          <section>
            <p id="entry-label">{handle.props.label}</p>
            <Frame
              name="entry-frame"
              src="/entry-frame"
              fallback={<span id="entry-frame">Loading entry frame...</span>}
            />
          </section>
        )
      },
    )

    async function renderPage(label: string, frameLabel: string): Promise<string> {
      return await drain(renderPageStream(label, frameLabel))
    }

    async function renderPageWithProtocol(label: string, frameLabel: string): Promise<string> {
      return await drainWithProtocol(renderPageStream(label, frameLabel))
    }

    function renderPageStream(label: string, frameLabel: string): ReadableStream<Uint8Array> {
      return renderToStream(
        <html>
          <body>
            <main>
              <EntryWithFailingFrame label={label} />
            </main>
          </body>
        </html>,
        {
          resolveFrame(src: string) {
            if (src === '/entry-frame') {
              return `<span id="entry-frame">${frameLabel}</span>`
            }
            throw new Error(`Unexpected frame src during server render: ${src}`)
          },
        },
      )
    }

    let serverHtml = await renderPage('Initial entry', 'Initial entry frame')
    let initialDocument = new DOMParser().parseFromString(serverHtml, 'text/html')
    document.documentElement.innerHTML = initialDocument.documentElement.innerHTML
    let reloadedPage = await renderPageWithProtocol('Reloaded entry', 'Unused streamed entry frame')

    let app = run({
      loadModule(moduleUrl, exportName) {
        if (
          moduleUrl === '/assets/entry-with-failing-frame.js' &&
          exportName === 'EntryWithFailingFrame'
        ) {
          return EntryWithFailingFrame
        }
        throw new Error(`Unexpected module: ${moduleUrl}#${exportName}`)
      },
      resolveFrame(src: string) {
        if (src === document.location.href) {
          return streamFromChunks([reloadedPage])
        }
        if (src === '/entry-frame') {
          throw reloadError
        }
        throw new Error(`Unexpected frame src: ${src}`)
      },
    })
    let forwarded: unknown
    app.addEventListener('error', (event) => {
      forwarded = event.error
      markErrorForwarded()
    })

    await app.ready()

    invariant(reloadTop)
    await Promise.all([reloadTop(), errorForwarded, entryFrameReloaded])

    expect(forwarded).toBe(reloadError)
    expect(document.getElementById('entry-label')?.textContent).toBe('Reloaded entry')
    expect(document.getElementById('entry-frame')?.textContent).toBe('Initial entry frame')
    expect(entryFrameEvents).toEqual(['start', 'complete'])
    app.dispose()
  })

  it('does not reload client-created frames during ordinary client updates', async () => {
    let updateEntry: undefined | (() => Promise<AbortSignal>)
    let renderCount = 0
    let entryFrameResolveCount = 0

    let EntryWithFrame = clientEntry(
      '/assets/entry-with-client-update.js#EntryWithClientUpdate',
      function EntryWithClientUpdate(handle: Handle) {
        updateEntry = () => handle.update()
        return () => (
          <section>
            <p id="entry-render-count">Entry render: {renderCount++}</p>
            <Frame
              name="entry-frame"
              src="/entry-frame"
              fallback={<span id="entry-frame">Loading entry frame...</span>}
            />
          </section>
        )
      },
    )

    let serverHtml = await drain(
      renderToStream(
        <html>
          <body>
            <main>
              <EntryWithFrame />
            </main>
          </body>
        </html>,
        {
          resolveFrame(src: string) {
            if (src === '/entry-frame') {
              return '<span id="entry-frame">Initial entry frame</span>'
            }
            throw new Error(`Unexpected frame src during server render: ${src}`)
          },
        },
      ),
    )
    let initialDocument = new DOMParser().parseFromString(serverHtml, 'text/html')
    document.documentElement.innerHTML = initialDocument.documentElement.innerHTML

    let app = run({
      loadModule(moduleUrl, exportName) {
        if (
          moduleUrl === '/assets/entry-with-client-update.js' &&
          exportName === 'EntryWithClientUpdate'
        ) {
          return EntryWithFrame
        }
        throw new Error(`Unexpected module: ${moduleUrl}#${exportName}`)
      },
      resolveFrame(src: string) {
        if (src === '/entry-frame') {
          entryFrameResolveCount++
          return '<span id="entry-frame">Reloaded entry frame</span>'
        }
        throw new Error(`Unexpected frame src: ${src}`)
      },
    })

    await app.ready()

    expect(document.getElementById('entry-render-count')?.textContent).toBe('Entry render: 1')
    expect(document.getElementById('entry-frame')?.textContent).toBe('Initial entry frame')
    expect(entryFrameResolveCount).toBe(0)

    invariant(updateEntry)
    await updateEntry()

    expect(document.getElementById('entry-render-count')?.textContent).toBe('Entry render: 2')
    expect(document.getElementById('entry-frame')?.textContent).toBe('Initial entry frame')
    expect(entryFrameResolveCount).toBe(0)

    // An update-triggered reload would resolve before this explicit one, so only one resolve proves
    // the update didn't reload the frame.
    let entryFrame = app.frames.get('entry-frame')
    invariant(entryFrame)
    await entryFrame.reload()
    expect(entryFrameResolveCount).toBe(1)
    expect(document.getElementById('entry-frame')?.textContent).toBe('Reloaded entry frame')
    app.dispose()
  })

  it('keeps resolved client frame content after rerendering while resolution is pending', async () => {
    let rootContainer = document.createElement('div')
    document.body.appendChild(rootContainer)
    let [contentPromise, resolveContent] = withResolvers<string>()

    let root = createRoot(rootContainer, {
      frameInit: {
        resolveFrame() {
          return contentPromise
        },
      },
    })

    root.render(<Frame src="/pending" fallback={<p id="fallback">Loading first…</p>} />)
    root.flush()
    root.render(<Frame src="/pending" fallback={<p id="fallback">Loading second…</p>} />)
    root.flush()

    resolveContent('<p id="result">Resolved content</p>')
    await waitForElement('#result')

    expect(rootContainer.querySelector('#result')?.textContent).toBe('Resolved content')
    expect(rootContainer.querySelector('#fallback')).toBe(null)

    root.render(<Frame src="/pending" fallback={<p id="fallback">Loading third…</p>} />)
    root.flush()

    expect(rootContainer.querySelector('#result')?.textContent).toBe('Resolved content')
    expect(rootContainer.querySelector('#fallback')).toBe(null)
    root.dispose()
  })

  it('reloads a committed client frame in place when src changes while a sub-frame is loading', async (t) => {
    let rootContainer = document.createElement('div')
    document.body.appendChild(rootContainer)
    t.after(() => rootContainer.remove())

    let SlowEntry = clientEntry('/assets/slow-entry.js#SlowEntry', function SlowEntry() {
      return () => <p id="slow">Slow</p>
    })
    let firstContent = await drain(
      renderToStream(
        <section id="first">
          <Frame src="/sub" />
        </section>,
        { resolveFrame: () => renderFrameContent(<SlowEntry />) },
      ),
    )
    // The parent commits before its sub-frame is ready, because the sub-frame's client entry
    // module is still loading.
    let [slowModule, resolveSlowModule] = withResolvers<Function>()
    let [slowModuleRequested, markSlowModuleRequested] = withResolvers<void>()
    let [secondContent, resolveSecondContent] = withResolvers<string>()
    let root = createRoot(rootContainer, {
      frameInit: {
        resolveFrame(src) {
          if (src === '/first') return firstContent
          if (src === '/second') return secondContent
          throw new Error(`Unexpected frame src: ${src}`)
        },
        loadModule() {
          markSlowModuleRequested()
          return slowModule
        },
      },
    })
    t.after(() => root.dispose())
    let fallback = <p id="fallback">Loading...</p>

    root.render(<Frame src="/first" fallback={fallback} />)
    root.flush()
    await slowModuleRequested
    expect(rootContainer.querySelector('#first')).not.toBe(null)

    let renderedText = recordRenderedText(rootContainer)
    root.render(<Frame src="/second" fallback={fallback} />)
    root.flush()
    resolveSecondContent('<p id="second">Second</p>')
    await waitForText('#second', 'Second', rootContainer)

    expect(renderedText.stop().some((text) => text.includes('Loading...'))).toBe(false)
    expect(rootContainer.querySelector('#first')).toBe(null)
    resolveSlowModule(SlowEntry)
  })

  it('loads new client-created frame src values during server-driven entry rerenders', async () => {
    let reloadTop: undefined | (() => Promise<AbortSignal>)
    let frameSrc = '/entry-frame-a'
    let entryFrameEvents: string[] = []
    let entryFrameReloads = [withResolvers<void>(), withResolvers<void>()]
    let entryFrameReloadCount = 0

    let EntryWithChangingFrame = clientEntry(
      '/assets/entry-with-changing-frame.js#EntryWithChangingFrame',
      function EntryWithChangingFrame(handle: Handle<{ label: string }>) {
        let listening = false
        reloadTop = () => handle.frames.top.reload()
        return () => {
          handle.queueTask(() => {
            if (listening) return
            let entryFrame = handle.frames.get('entry-frame')
            invariant(entryFrame, 'Expected entry frame handle')
            entryFrame.addEventListener('reloadStart', () => entryFrameEvents.push('start'), {
              signal: handle.signal,
            })
            entryFrame.addEventListener(
              'reloadComplete',
              () => {
                entryFrameEvents.push('complete')
                entryFrameReloads[entryFrameReloadCount++]?.[1]()
              },
              { signal: handle.signal },
            )
            listening = true
          })

          return (
            <section>
              <p id="entry-label">{handle.props.label}</p>
              <Frame
                name="entry-frame"
                src={frameSrc}
                fallback={<span id="entry-frame">Loading entry frame...</span>}
              />
            </section>
          )
        }
      },
    )

    async function renderPage(label: string, frameLabel: string): Promise<string> {
      return await drain(renderPageStream(label, frameLabel))
    }

    async function renderPageWithProtocol(label: string, frameLabel: string): Promise<string> {
      return await drainWithProtocol(renderPageStream(label, frameLabel))
    }

    function renderPageStream(label: string, frameLabel: string): ReadableStream<Uint8Array> {
      return renderToStream(
        <html>
          <body>
            <main>
              <EntryWithChangingFrame label={label} />
            </main>
          </body>
        </html>,
        {
          resolveFrame(src: string) {
            if (src === frameSrc) {
              return `<span id="entry-frame">${frameLabel}</span>`
            }
            throw new Error(`Unexpected frame src during server render: ${src}`)
          },
        },
      )
    }

    let serverHtml = await renderPage('Initial entry', 'Initial entry frame')
    let initialDocument = new DOMParser().parseFromString(serverHtml, 'text/html')
    document.documentElement.innerHTML = initialDocument.documentElement.innerHTML

    let resolvedClientFrameSrcs: string[] = []
    let topReloadCount = 0

    let app = run({
      loadModule(moduleUrl, exportName) {
        if (
          moduleUrl === '/assets/entry-with-changing-frame.js' &&
          exportName === 'EntryWithChangingFrame'
        ) {
          return EntryWithChangingFrame
        }
        throw new Error(`Unexpected module: ${moduleUrl}#${exportName}`)
      },
      async resolveFrame(src: string) {
        if (src === document.location.href) {
          topReloadCount++
          frameSrc = topReloadCount === 1 ? '/entry-frame-b' : '/entry-frame-c'
          return streamFromChunks([
            await renderPageWithProtocol('Reloaded entry', 'Unused streamed entry frame'),
          ])
        }
        if (src === '/entry-frame-b' || src === '/entry-frame-c') {
          resolvedClientFrameSrcs.push(src)
          return '<span id="entry-frame">Reloaded entry frame</span>'
        }
        throw new Error(`Unexpected frame src: ${src}`)
      },
    })

    await app.ready()

    expect(document.getElementById('entry-label')?.textContent).toBe('Initial entry')
    expect(document.getElementById('entry-frame')?.textContent).toBe('Initial entry frame')
    expect(resolvedClientFrameSrcs).toEqual([])
    expect(entryFrameEvents).toEqual([])

    invariant(reloadTop)
    let clientReloadTop = reloadTop
    await Promise.all([clientReloadTop(), entryFrameReloads[0]![0]])

    expect(document.getElementById('entry-label')?.textContent).toBe('Reloaded entry')
    expect(document.getElementById('entry-frame')?.textContent).toBe('Reloaded entry frame')
    expect(resolvedClientFrameSrcs).toEqual(['/entry-frame-b'])
    expect(entryFrameEvents).toEqual(['start', 'complete'])

    await Promise.all([clientReloadTop(), entryFrameReloads[1]![0]])

    expect(resolvedClientFrameSrcs).toEqual(['/entry-frame-b', '/entry-frame-c'])
    expect(entryFrameEvents).toEqual(['start', 'complete', 'start', 'complete'])
    app.dispose()
  })

  it('cancels stale client frame streams when src changes', async () => {
    let rootContainer = document.createElement('div')
    document.body.appendChild(rootContainer)

    let [slowChunkPromise, resolveSlowChunk] = withResolvers<string>()
    let [fastChunkPromise, resolveFastChunk] = withResolvers<string>()

    function Shell(handle: Handle) {
      let src = '/slow'
      return () => (
        <main>
          <button
            id="switch-src"
            type="button"
            mix={[
              on('click', () => {
                src = '/fast'
                handle.update()
              }),
            ]}
          >
            Switch
          </button>
          <Frame src={src} fallback={<p id="fallback">Loading…</p>} />
        </main>
      )
    }

    let root = createRoot(rootContainer, {
      frameInit: {
        resolveFrame(src: string) {
          if (src === '/slow') {
            return streamFromChunks([slowChunkPromise])
          }
          if (src === '/fast') {
            return streamFromChunks([fastChunkPromise])
          }
          throw new Error(`Unexpected src: ${src}`)
        },
      },
    })

    root.render(<Shell />)
    root.flush()

    expect(rootContainer.querySelector('#fallback')?.textContent).toBe('Loading…')

    let switchButton = rootContainer.querySelector('#switch-src')
    invariant(switchButton instanceof HTMLButtonElement)
    switchButton.click()
    root.flush()

    // Both streams take the same path, and the stale one gets its chunk first, so it would render
    // before the current one if it weren't cancelled.
    let renderedText = recordRenderedText(rootContainer)
    resolveSlowChunk('<p id="result">Slow result</p>')
    resolveFastChunk('<p id="result">Fast result</p>')
    await waitForText('#result', 'Fast result', rootContainer)

    expect(renderedText.stop().some((text) => text.includes('Slow result'))).toBe(false)
    expect(rootContainer.querySelector('#result')?.textContent).toBe('Fast result')
    root.dispose()
  })

  it('renders RemixNode results from client resolveFrame', async () => {
    let rootContainer = document.createElement('div')
    document.body.appendChild(rootContainer)

    let root = createRoot(rootContainer, {
      frameInit: {
        resolveFrame(src: string) {
          if (src === '/html') {
            return '<div id="stale">Stale content</div>'
          }

          if (src === '/error') {
            return (
              <section id="frame-error">
                <h2>Frame Error</h2>
                <p>Retry the page.</p>
              </section>
            )
          }

          throw new Error(`Unexpected src: ${src}`)
        },
      },
    })

    root.render(<Frame src="/html" fallback={<p id="fallback">Loading…</p>} />)
    root.flush()
    await waitForElement('#stale')

    expect(rootContainer.querySelector('#stale')?.textContent).toBe('Stale content')

    root.render(<Frame src="/error" fallback={<p id="fallback">Loading…</p>} />)
    root.flush()
    await waitForElement('#frame-error')

    expect(rootContainer.querySelector('#frame-error h2')?.textContent).toBe('Frame Error')
    expect(rootContainer.querySelector('#frame-error p')?.textContent).toBe('Retry the page.')
    expect(rootContainer.querySelector('#stale')).toBeNull()

    root.dispose()
  })
})
