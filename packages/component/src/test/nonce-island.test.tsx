import { expect } from '@remix-run/assert'
import { describe, it, type TestContext } from '@remix-run/test'

import { clientEntry } from '../runtime/client-entries.ts'
import { Frame, type Handle } from '../runtime/component.ts'
import { invariant } from '../runtime/invariant.ts'
import { ImportMap, renderToStream, renderToString } from '../server/stream.ts'
import { drain, readChunks } from './utils.ts'

describe('island response nonces', () => {
  it('keeps resource nonces correct through hydration, updates, and replacement', async (t) => {
    let doc = await exerciseIsland(t)
    expect(JSON.parse(doc.documentElement.dataset.snapshots ?? 'null')).toEqual([
      { nonce: 'document-nonce', color: 'rgb(12, 34, 56)', note: 'response-nonce' },
      { nonce: 'document-nonce', color: 'rgb(12, 34, 56)', note: 'response-nonce' },
      { nonce: 'document-nonce', color: 'rgb(65, 43, 21)', note: 'response-nonce' },
      { nonce: 'document-nonce', color: 'rgb(21, 43, 65)', note: 'response-nonce' },
    ])
    expect(doc.querySelector<HTMLScriptElement>('#island-data')?.nonce).toBe('document-nonce')
    expect(doc.querySelector<HTMLLinkElement>('#island-link')?.nonce).toBe('document-nonce')
    expect(doc.querySelector('#island-data')?.textContent).toBe('response-nonce')
    expect(doc.querySelector<HTMLElement>('#island-target')?.nonce).toBe('response-nonce')
    expect(doc.querySelector<HTMLStyleElement>('#forged-style')?.nonce).toBe('forged-nonce')
    expect(doc.querySelector('#missing-style')?.hasAttribute('nonce')).toBe(false)
    let target = doc.querySelector('#island-target')
    invariant(target)
    expect(doc.defaultView?.getComputedStyle(target).backgroundColor).toBe('rgba(0, 0, 0, 0)')
    expect(doc.defaultView?.getComputedStyle(target).borderTopWidth).toBe('0px')
    expect(JSON.parse(doc.documentElement.dataset.mixinNonces ?? 'null')).toEqual([
      'document-nonce',
      'forged-nonce',
      'document-nonce',
    ])
  })

  it('keeps island styles working after document navigation', async (t) => {
    let doc = await exerciseIsland(t, { documentReload: true })
    expect(doc.querySelector<HTMLStyleElement>('#island-style')?.nonce).toBe('document-nonce')
    expect(doc.documentElement.dataset.finalColor).toBe('rgb(21, 43, 65)')
  })

  it('retains earlier nonce aliases when a cached island is preserved inside a nested frame', async (t) => {
    let doc = await exerciseIsland(t, { nestedFrame: 'resolved', reloadAgain: true })
    expect(doc.documentElement.dataset.setups).toBe('1')
    expect(doc.querySelector<HTMLStyleElement>('#island-style')?.nonce).toBe('document-nonce')
    expect(doc.querySelector<HTMLStyleElement>('#current-style')?.nonce).toBe('document-nonce')
    expect(doc.querySelector('#island-target')?.getAttribute('data-note')).toBe('second-nonce')
    let target = doc.querySelector('#island-target')
    invariant(target)
    expect(doc.defaultView?.getComputedStyle(target).color).toBe('rgb(98, 76, 54)')
    expect(doc.defaultView?.getComputedStyle(target).outlineColor).toBe('rgb(98, 76, 54)')
  })

  it('carries the trusted nonce through streamed frame template cloning', async (t) => {
    let doc = await exerciseIsland(t, { nestedFrame: 'streamed' })
    expect(doc.querySelector<HTMLStyleElement>('#island-style')?.nonce).toBe('document-nonce')
    expect(doc.documentElement.dataset.finalColor).toBe('rgb(21, 43, 65)')
  })

  it('carries the trusted nonce through buffered frame templates', async (t) => {
    let doc = await exerciseIsland(t, { nestedFrame: 'streamed', bufferedTemplates: true })
    expect(doc.querySelector<HTMLStyleElement>('#island-style')?.nonce).toBe('document-nonce')
    expect(doc.documentElement.dataset.finalColor).toBe('rgb(21, 43, 65)')
  })

  it('keeps a missing startup nonce missing for frames created later', async (t) => {
    let doc = await exerciseIsland(t, { startup: 'missing-nonce' })
    expect(doc.querySelector<HTMLStyleElement>('#island-style')?.nonce).toBe('response-nonce')
    expect(doc.documentElement.dataset.finalColor).toBe('rgb(0, 0, 0)')
  })

  it('keeps the startup nonce across standalone roots', async (t) => {
    let doc = await exerciseIsland(t, { startup: 'standalone' })
    expect(doc.querySelector<HTMLStyleElement>('#island-style')?.nonce).toBe('document-nonce')
    expect(doc.documentElement.dataset.finalColor).toBe('rgb(21, 43, 65)')
  })

  it('does not use an authored import map nonce as the document render nonce', async (t) => {
    let doc = await exerciseIsland(t, { startup: 'import-map-only' })
    expect(doc.querySelector<HTMLStyleElement>('#island-style')?.nonce).toBe('response-nonce')
    expect(doc.documentElement.dataset.finalColor).toBe('rgb(0, 0, 0)')
  })

  it('does not trust response metadata without an enforcing CSP header', async (t) => {
    let doc = await exerciseIsland(t, { enforceResponseCsp: false })
    expect(doc.querySelector<HTMLStyleElement>('#island-style')?.nonce).toBe('response-nonce')
    expect(doc.documentElement.dataset.finalColor).toBe('rgb(0, 0, 0)')
  })
})

async function exerciseIsland(
  t: TestContext,
  options: {
    reloadAgain?: boolean
    documentReload?: boolean
    bufferedTemplates?: boolean
    nestedFrame?: 'resolved' | 'streamed'
    enforceResponseCsp?: boolean
    startup?: 'missing-nonce' | 'standalone' | 'import-map-only'
  } = {},
): Promise<Document> {
  let Island = clientEntry(
    '/nonce-island.js#Island',
    function Island(handle: Handle<{ nonce: string }>) {
      return () => (
        <section>
          <style id="island-style" nonce={handle.props.nonce}>
            {'#island-target { color: rgb(12, 34, 56); }'}
          </style>
          <p id="island-target" data-note={handle.props.nonce}>
            Island
          </p>
        </section>
      )
    },
  )
  async function renderResponse(nonce: string): Promise<string[]> {
    let island = await renderToString(<Island nonce={nonce} />, { nonce })
    if (options.documentReload)
      return [`<!doctype html><html><head></head><body>${island}</body></html>`]
    if (!options.nestedFrame) return [island]
    let stream = renderToStream(
      <Frame
        src="/nested"
        fallback={options.nestedFrame === 'streamed' ? <p>Loading</p> : undefined}
      />,
      { nonce, resolveFrame: () => island },
    )
    let chunks: string[] = []
    for await (let chunk of readChunks(stream)) chunks.push(chunk)
    return options.bufferedTemplates ? [chunks.join('')] : chunks
  }
  let responses = [await renderResponse('response-nonce')]
  if (options.reloadAgain) responses.push(await renderResponse('second-nonce'))
  let runHref = new URL('../runtime/run.ts', import.meta.url).href
  let jsxHref = new URL('../runtime/jsx.ts', import.meta.url).href
  let vdomHref = new URL('../runtime/vdom.ts', import.meta.url).href
  let componentHref = new URL('../runtime/component.ts', import.meta.url).href
  let mixinHref = new URL('../runtime/mixins/mixin.ts', import.meta.url).href
  let message = crypto.randomUUID()
  let bootstrap = `
    import { run } from ${JSON.stringify(runHref)}
    import { jsx } from ${JSON.stringify(jsxHref)}
    import { createRoot } from ${JSON.stringify(vdomHref)}
    import { Frame } from ${JSON.stringify(componentHref)}
    import { createMixin } from ${JSON.stringify(mixinHref)}
    let responses = ${JSON.stringify(responses).replace(/</g, '\\u003c')}
    let options = ${JSON.stringify(options)}
    let snapshots = []
    let setups = 0
    let responseIndex = 0
    let { promise: islandReady, resolve: markIslandReady } = Promise.withResolvers()
    let frame
    let change, changeMixin
    function read() {
      let style = document.querySelector('#island-style')
      let target = document.querySelector('#island-target')
      return { nonce: style.nonce, color: getComputedStyle(target).color, note: target.dataset.note }
    }
    let withNonce = createMixin(handle => {
      let nonce
      changeMixin = async value => { nonce = value; await handle.update() }
      return (initial, props) => jsx(handle.element, { ...props, nonce: nonce ?? initial })
    })
    let runtimeOptions = {
      resolveFrame() {
        let nonce = responseIndex === 0 ? 'response-nonce' : 'second-nonce'
        let chunks = responses[responseIndex++].values()
        let encoder = new TextEncoder()
        let body = new ReadableStream({
          pull(controller) {
            let next = chunks.next()
            if (next.done) controller.close()
            else controller.enqueue(encoder.encode(next.value))
          },
        })
        return new Response(body, {
          headers: options.enforceResponseCsp === false ? {} : {
            'Content-Security-Policy': "script-src 'nonce-" + nonce + "'; style-src 'nonce-" + nonce + "'",
          },
        })
      },
      async loadModule() {
        snapshots.push(read())
        await Promise.resolve()
        return function Island(handle) {
          setups++
          handle.queueTask(markIslandReady)
          let capturedNonce = handle.props.nonce
          let step = 0
          change = async next => { step = next; await handle.update() }
          return () => {
            let color = ['rgb(12, 34, 56)', 'rgb(65, 43, 21)', 'rgb(21, 43, 65)', 'rgb(98, 76, 54)'][step]
            return jsx('section', { children: [
              jsx('style', {
                id: 'island-style', nonce: capturedNonce,
                children: '#island-target { color: ' + color + '; }',
              }, step >= 2 ? 'replacement' : 'original'),
              jsx('p', { id: 'island-target', nonce: handle.props.nonce, 'data-note': handle.props.nonce, children: 'Island' }),
              jsx('style', { id: 'current-style', nonce: handle.props.nonce, children: '#island-target { outline-color: ' + color + '; }' }),
              jsx('style', { id: 'forged-style', nonce: 'forged-nonce', children: '#island-target { background: red; }' }),
              jsx('style', { id: 'missing-style', children: '#island-target { border: 10px solid red; }' }),
              jsx('script', { id: 'island-data', type: 'application/json', nonce: handle.props.nonce, children: handle.props.nonce }),
              jsx('link', { id: 'island-link', rel: 'author', nonce: handle.props.nonce }),
              jsx('style', { id: 'mixed-style', mix: [withNonce(capturedNonce)] }),
            ] })
          }
        }
      },
    }
    try {
      if (options.startup === 'standalone') {
        document.body.replaceChildren()
        let root = createRoot(document.body, { frameInit: runtimeOptions })
        document.querySelector('meta[name="rmx-nonce"]').nonce = 'forged-nonce'
        root.dispose()
        root = createRoot(document.body, { frameInit: runtimeOptions })
        root.render(jsx(Frame, { src: '/next' }))
        await islandReady
      } else {
        let app = run(runtimeOptions)
        await app.ready()
        frame = options.documentReload ? app.frames.top : app.frames.get('child')
        if (options.startup === 'missing-nonce') {
          let meta = document.createElement('meta')
          meta.name = 'rmx-nonce'
          meta.nonce = 'document-nonce'
          document.head.append(meta)
          await app.frames.top.replace(jsx(Frame, { src: '/next' }))
          await islandReady
        } else {
          frame.src = '/next'
          await frame.reload()
        }
      }
      snapshots.push(read())
      await change(1)
      snapshots.push(read())
      await change(2)
      snapshots.push(read())
      if (options.reloadAgain) {
        await frame.reload()
        await change(3)
      }
      let mixinNonces = [document.querySelector('#mixed-style').nonce]
      await changeMixin('forged-nonce')
      mixinNonces.push(document.querySelector('#mixed-style').nonce)
      await changeMixin('response-nonce')
      mixinNonces.push(document.querySelector('#mixed-style').nonce)
      document.documentElement.dataset.mixinNonces = JSON.stringify(mixinNonces)
      document.documentElement.dataset.snapshots = JSON.stringify(snapshots)
      document.documentElement.dataset.finalColor = read().color
      document.documentElement.dataset.setups = setups
    } catch (error) {
      document.documentElement.dataset.error = String(error)
    }
    parent.postMessage(${JSON.stringify(message)}, ${JSON.stringify(location.origin)})
  `
  let html = await drain(
    renderToStream(
      <html>
        <head>
          <meta
            httpEquiv="Content-Security-Policy"
            content="script-src 'self' 'nonce-document-nonce'; style-src 'nonce-document-nonce'"
          />
          {options.startup === 'import-map-only' ? (
            <ImportMap nonce="document-nonce" value={{}} />
          ) : null}
          <script type="module" nonce="document-nonce">
            {bootstrap}
          </script>
        </head>
        <body>
          <Frame name="child" src="/child" />
        </body>
      </html>,
      {
        nonce:
          options.startup === 'missing-nonce' || options.startup === 'import-map-only'
            ? undefined
            : 'document-nonce',
        resolveFrame: () => 'Initial',
      },
    ),
  )
  let iframe = document.createElement('iframe')
  t.after(() => iframe.remove())
  let completed = new Promise<void>((resolve) => {
    window.addEventListener(
      'message',
      function onMessage(event: MessageEvent) {
        if (event.source !== iframe.contentWindow || event.data !== message) return
        window.removeEventListener('message', onMessage)
        resolve()
      },
      { signal: t.signal },
    )
  })
  iframe.srcdoc = html
  document.body.append(iframe)
  await completed
  let doc = iframe.contentDocument
  invariant(doc)
  expect(doc.documentElement.dataset.error).toBeUndefined()
  return doc
}
