import { expect } from '@remix-run/assert'
import { describe, it, type TestContext } from '@remix-run/test'

import { clientEntry } from '../runtime/client-entries.ts'
import { Frame } from '../runtime/component.ts'
import { invariant } from '../runtime/invariant.ts'
import { ImportMap, renderToStream, renderToString } from '../server/stream.ts'
import { css } from '../style/css-mixin.ts'
import { drain } from './utils.ts'

describe('CSP nonces', () => {
  it('loads generated module preloads under nonce-only CSP', async (t) => {
    let doc = await renderPreloadUnderCsp(t)

    expect(doc.documentElement.dataset.preloadStatus).toBe('load')
    expect(doc.head.querySelector<HTMLLinkElement>('link[rel="modulepreload"]')?.nonce).toBe(
      'document-nonce',
    )
  })

  it('loads blocking frame preloads under the document nonce', async (t) => {
    let doc = await renderPreloadUnderCsp(t, { blockingFrame: true })

    expect(doc.documentElement.dataset.preloadStatus).toBe('load')
    expect(doc.head.querySelector<HTMLLinkElement>('link[rel="modulepreload"]')?.nonce).toBe(
      'document-nonce',
    )
    expect(doc.body.querySelector('link[rel="modulepreload"]')).toBeNull()
  })

  it('applies renderToString CSS mixin styles under CSP before hydration', async (t) => {
    let html = await renderToString(
      <html>
        <head>
          <meta httpEquiv="Content-Security-Policy" content="style-src 'nonce-document-nonce'" />
        </head>
        <body>
          <p mix={[css({ color: 'rgb(12, 34, 56)' })]}>Styled</p>
        </body>
      </html>,
      { nonce: 'document-nonce' },
    )
    let iframe = document.createElement('iframe')
    t.after(() => iframe.remove())
    let loaded = new Promise<void>((resolve) => {
      iframe.addEventListener('load', () => resolve(), { once: true, signal: t.signal })
    })
    iframe.srcdoc = html
    document.body.append(iframe)
    await loaded

    let frameWindow = iframe.contentWindow
    invariant(frameWindow)
    let paragraph = frameWindow.document.querySelector('p')
    invariant(paragraph)
    expect(frameWindow.getComputedStyle(paragraph).color).toBe('rgb(12, 34, 56)')
  })

  it('hoists import maps and preloads from blocking frames rendered with a nonce', async () => {
    let Island = clientEntry('/island.js#Island', function Island() {
      return () => <p>Island</p>
    })
    let html = await drain(
      renderToStream(
        <html>
          <head>
            <ImportMap value={{ imports: { app: '/app.js' } }} />
          </head>
          <body>
            <Frame src="/child" />
            <Frame src="/sibling" />
          </body>
        </html>,
        {
          nonce: 'document-nonce',
          resolveFrame(src) {
            return renderToStream(<Island />, {
              nonce: src === '/child' ? 'frame-response-nonce' : 'sibling-response-nonce',
              resolveClientEntry() {
                return {
                  href: '/island.js',
                  exportName: 'Island',
                  importMap: { imports: { '/island.js': '/island.hash.js' } },
                  preloads: ['/island.hash.js'],
                }
              },
            })
          },
        },
      ),
    )
    let doc = new DOMParser().parseFromString(html, 'text/html')
    let map = doc.head.querySelector<HTMLScriptElement>('script[type="importmap"]')

    expect(JSON.parse(map?.textContent ?? '{}')).toEqual({
      imports: { app: '/app.js', '/island.js': '/island.hash.js' },
    })
    expect(map?.nonce).toBe('document-nonce')
    expect(doc.querySelectorAll('script[type="importmap"]')).toHaveLength(1)
    expect(doc.head.querySelector('link[rel="modulepreload"]')?.getAttribute('href')).toBe(
      '/island.hash.js',
    )
    expect(doc.head.querySelector<HTMLLinkElement>('link[rel="modulepreload"]')?.nonce).toBe(
      'document-nonce',
    )
    expect(doc.querySelectorAll('link[rel="modulepreload"]')).toHaveLength(1)
    expect(doc.body.querySelector('script[type="importmap"], link[rel="modulepreload"]')).toBeNull()
  })

  it('hydrates the first late client entry under CSP without an authored import map', async (t) => {
    let result = await renderLateEntryUnderCsp(t, { nonce: 'document-nonce' })

    expect(result).toEqual({
      hydrated: true,
      error: '',
      nonce: 'document-nonce',
      metadataNonces: ['document-nonce'],
    })
  })

  it('hydrates the first late client entry under CSP with an empty authored import map', async (t) => {
    let result = await renderLateEntryUnderCsp(t, {
      nonce: 'document-nonce',
      initialImportMap: true,
    })

    expect(result).toEqual({
      hydrated: true,
      error: '',
      nonce: 'document-nonce',
      metadataNonces: ['document-nonce'],
    })
  })

  it('prefers an authored import map nonce over document nonce metadata', async (t) => {
    let result = await renderLateEntryUnderCsp(t, {
      nonce: 'document-nonce',
      initialImportMap: true,
      importMapNonce: 'authored-nonce',
    })

    expect(result).toEqual({
      hydrated: true,
      error: '',
      nonce: 'authored-nonce',
      metadataNonces: ['document-nonce'],
    })
  })

  it('uses an authored import map nonce without a render nonce option', async (t) => {
    let result = await renderLateEntryUnderCsp(t, {
      nonce: undefined,
      initialImportMap: true,
      importMapNonce: 'authored-nonce',
    })

    expect(result).toEqual({
      hydrated: true,
      error: '',
      nonce: 'authored-nonce',
      metadataNonces: [],
    })
  })

  it('preserves the original nonce metadata across a document frame reload', async (t) => {
    let result = await renderLateEntryUnderCsp(t, {
      nonce: 'document-nonce',
      reloadDocument: true,
    })

    expect(result).toEqual({
      hydrated: true,
      error: '',
      nonce: 'document-nonce',
      metadataNonces: ['document-nonce'],
    })
  })

  it('loads late preloads with the original document nonce after a document reload', async (t) => {
    let result = await renderLateEntryUnderCsp(t, {
      nonce: 'document-nonce',
      reloadDocument: true,
      preload: true,
    })

    expect(result.preload).toEqual({ status: 'load', nonce: 'document-nonce' })
    expect(result.hydrated).toBe(true)
    expect(result.error).toBe('')
  })

  it('loads late preloads with an authored import map nonce without a render nonce', async (t) => {
    let result = await renderLateEntryUnderCsp(t, {
      nonce: undefined,
      initialImportMap: true,
      importMapNonce: 'authored-nonce',
      preload: true,
    })

    expect(result.preload).toEqual({ status: 'load', nonce: 'authored-nonce' })
    expect(result.hydrated).toBe(true)
    expect(result.error).toBe('')
  })
})

async function renderPreloadUnderCsp(t: TestContext, options?: { blockingFrame?: boolean }) {
  let Island = clientEntry('/island.js#Island', function Island() {
    return () => 'Island'
  })
  let moduleHref = 'data:text/javascript,export%20default%20null'
  let completionMessage = crypto.randomUUID()
  function resolveClientEntry() {
    return { href: moduleHref, exportName: 'default', preloads: [moduleHref] }
  }
  let html = await drain(
    renderToStream(
      <html>
        <head>
          <meta httpEquiv="Content-Security-Policy" content="script-src 'nonce-document-nonce'" />
          <script nonce="document-nonce">{`
            function onPreload(event) {
              if (!event.target.matches?.('link[data-rmx-module-preload]')) return
              document.documentElement.dataset.preloadStatus = event.type
              parent.postMessage(${JSON.stringify(completionMessage)}, ${JSON.stringify(location.origin)})
            }
            document.addEventListener('load', onPreload, true)
            document.addEventListener('error', onPreload, true)
          `}</script>
        </head>
        <body>{options?.blockingFrame ? <Frame src="/child" /> : <Island />}</body>
      </html>,
      {
        nonce: 'document-nonce',
        resolveClientEntry,
        resolveFrame() {
          return renderToStream(<Island />, {
            nonce: 'frame-response-nonce',
            resolveClientEntry,
          })
        },
      },
    ),
  )

  return renderNonceDocument(t, html, completionMessage)
}

async function renderLateEntryUnderCsp(
  t: TestContext,
  options: {
    nonce: string | undefined
    initialImportMap?: boolean
    importMapNonce?: string
    reloadDocument?: boolean
    preload?: boolean
  },
) {
  let policyNonce = options.importMapNonce ?? options.nonce
  let Island = clientEntry('late-island#Island', function Island() {
    return () => 'Island'
  })
  let moduleHref = `data:text/javascript,${encodeURIComponent(
    `export function Island(handle) {
      handle.queueTask(() => { document.querySelector('main').dataset.hydrated = 'true' })
      return () => 'Island'
    }`,
  )}`
  let frameHtml = await drain(
    renderToStream(<Island />, {
      nonce: 'frame-response-nonce',
      resolveClientEntry() {
        return {
          href: 'late-island',
          exportName: 'Island',
          importMap: { imports: { 'late-island': moduleHref } },
          preloads: options.preload ? [moduleHref] : undefined,
        }
      },
    }),
  )
  let documentHtml = options.reloadDocument
    ? await drain(
        renderToStream(
          <html>
            <head />
            <body>
              <main>
                <Frame name="late" src="/late" />
              </main>
            </body>
          </html>,
          { nonce: 'navigation-response-nonce', resolveFrame: () => '<p>Next page</p>' },
        ),
      )
    : ''
  let runHref = new URL('../runtime/run.ts', import.meta.url).href
  let completionMessage = crypto.randomUUID()
  let bootstrap = `
    import { run } from ${JSON.stringify(runHref)}
    let error = ''
    let preloaded = ${options.preload === true} ? new Promise((resolve) => {
      function onPreload(event) {
        if (!event.target.matches?.('link[data-rmx-module-preload]')) return
        document.documentElement.dataset.preloadStatus = event.type
        document.documentElement.dataset.preloadNonce = event.target.nonce
        resolve()
      }
      document.addEventListener('load', onPreload, true)
      document.addEventListener('error', onPreload, true)
    }) : Promise.resolve()
    let app = run({
      resolveFrame(src) {
        if (src === '/next') return ${JSON.stringify(documentHtml).replace(/</g, '\\u003c')}
        return ${JSON.stringify(frameHtml).replace(/</g, '\\u003c')}
      },
      async loadModule(href, name) {
        try { return (await import(href))[name] }
        catch (cause) { error = String(cause); throw cause }
      },
    })
    app.addEventListener('error', (event) => { error = String(event.error) })
    try {
      await app.ready()
      if (${options.reloadDocument === true}) {
        app.frames.top.src = '/next'
        await app.frames.top.reload()
      }
      await app.frames.get('late').reload()
    } catch (cause) {
      error = String(cause)
    }
    await preloaded
    document.documentElement.dataset.error = error
    document.documentElement.dataset.hydrated = document.querySelector('main').dataset.hydrated ?? ''
    let maps = document.head.querySelectorAll('script[data-rmx-import-map]')
    document.documentElement.dataset.nonce = maps.item(maps.length - 1)?.nonce ?? ''
    parent.postMessage(${JSON.stringify(completionMessage)}, ${JSON.stringify(location.origin)})
    app.dispose()
  `
  let html = await drain(
    renderToStream(
      <html>
        <head>
          <meta
            httpEquiv="Content-Security-Policy"
            content={`script-src ${options.preload ? '' : "'self' data: "}'nonce-${policyNonce}'; style-src 'nonce-${policyNonce}'`}
          />
          {options.initialImportMap && <ImportMap nonce={options.importMapNonce} value={{}} />}
          <script type="module" nonce={policyNonce}>
            {bootstrap}
          </script>
        </head>
        <body>
          <main>
            <Frame name="late" src="/late" />
          </main>
        </body>
      </html>,
      { nonce: options.nonce, resolveFrame: () => '<p>Initial page</p>' },
    ),
  )
  let initialDocument = new DOMParser().parseFromString(html, 'text/html')
  expect(initialDocument.querySelectorAll('script[data-rmx-import-map]')).toHaveLength(
    options.initialImportMap ? 1 : 0,
  )
  let doc = await renderNonceDocument(t, html, completionMessage)
  return {
    hydrated: doc.documentElement.dataset.hydrated === 'true',
    error: doc.documentElement.dataset.error,
    nonce: doc.documentElement.dataset.nonce,
    metadataNonces: Array.from(
      doc.head.querySelectorAll<HTMLMetaElement>('meta[name="rmx-nonce"]'),
      (meta) => meta.nonce,
    ),
    ...(options.preload
      ? {
          preload: {
            status: doc.documentElement.dataset.preloadStatus,
            nonce: doc.documentElement.dataset.preloadNonce,
          },
        }
      : {}),
  }
}

async function renderNonceDocument(t: TestContext, html: string, completionMessage: string) {
  // Each document needs fresh CSP and import-map state, including real script execution.
  let iframe = document.createElement('iframe')
  t.after(() => iframe.remove())
  let completed = new Promise<void>((resolve) => {
    function onMessage(event: MessageEvent) {
      if (event.source !== iframe.contentWindow || event.data !== completionMessage) return
      window.removeEventListener('message', onMessage)
      resolve()
    }
    window.addEventListener('message', onMessage, { signal: t.signal })
  })
  iframe.srcdoc = html
  document.body.append(iframe)
  await completed

  let doc = iframe.contentDocument
  invariant(doc)
  return doc
}
