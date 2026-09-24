import { expect } from '@remix-run/assert'
import { describe, it, type TestContext } from '@remix-run/test'

import { clientEntry } from '../runtime/client-entries.ts'
import { Frame } from '../runtime/component.ts'
import { invariant } from '../runtime/invariant.ts'
import { ImportMap, renderToStream, renderToString } from '../server/stream.ts'
import { css } from '../style/css-mixin.ts'
import { drain } from './utils.ts'

describe('CSP nonces', () => {
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
          </body>
        </html>,
        {
          nonce: 'document-nonce',
          resolveFrame() {
            return renderToStream(<Island />, {
              nonce: 'frame-response-nonce',
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
})

async function renderLateEntryUnderCsp(
  t: TestContext,
  options: {
    nonce: string | undefined
    initialImportMap?: boolean
    importMapNonce?: string
    reloadDocument?: boolean
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
            content={`script-src 'self' data: 'nonce-${policyNonce}'; style-src 'nonce-${policyNonce}'`}
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
  return {
    hydrated: doc.documentElement.dataset.hydrated === 'true',
    error: doc.documentElement.dataset.error,
    nonce: doc.documentElement.dataset.nonce,
    metadataNonces: Array.from(
      doc.head.querySelectorAll<HTMLMetaElement>('meta[name="rmx-nonce"]'),
      (meta) => meta.nonce,
    ),
  }
}
