import { expect } from '@remix-run/assert'
import { describe, it, type TestContext } from '@remix-run/test'

import { Frame } from '../runtime/component.ts'
import { invariant } from '../runtime/invariant.ts'
import { ImportMap, renderToStream, renderToString } from '../server/stream.ts'
import { drain } from './utils.ts'

describe('CSP frame navigation', () => {
  it('keeps authored styles working across document navigation', async (t) => {
    let doc = await navigateUnderCsp(t, 'document')

    let styled = doc.querySelector('#styled')
    invariant(styled)
    expect(doc.defaultView?.getComputedStyle(styled).color).toBe('rgb(65, 43, 21)')
    expect(doc.querySelector<HTMLStyleElement>('#authorized-style')?.nonce).toBe('document-nonce')
    expect(doc.head.querySelector<HTMLMetaElement>('meta[name="rmx-nonce"]')?.nonce).toBe(
      'document-nonce',
    )
  })

  it('keeps authored styles working across named frame reloads', async (t) => {
    let doc = await navigateUnderCsp(t, 'named')

    let styled = doc.querySelector('#styled')
    invariant(styled)
    expect(doc.defaultView?.getComputedStyle(styled).color).toBe('rgb(65, 43, 21)')
    expect(doc.querySelector<HTMLStyleElement>('#authorized-style')?.nonce).toBe('document-nonce')
  })

  it('keeps authored styles working in client-created frames', async (t) => {
    let doc = await navigateUnderCsp(t, 'client')
    let styled = doc.querySelector('#styled')
    invariant(styled)
    expect(doc.defaultView?.getComputedStyle(styled).color).toBe('rgb(65, 43, 21)')
  })

  it('rebases styles inside streamed non-blocking frame templates', async (t) => {
    let doc = await navigateUnderCsp(t, 'named', { nestedTemplate: true })
    let styled = doc.querySelector('#styled')
    invariant(styled)
    expect(doc.defaultView?.getComputedStyle(styled).color).toBe('rgb(65, 43, 21)')
  })

  it('uses the original render nonce when an import map has its own nonce', async (t) => {
    let doc = await navigateUnderCsp(t, 'named', { separateImportMapNonce: true })
    let styled = doc.querySelector('#styled')
    invariant(styled)
    expect(doc.defaultView?.getComputedStyle(styled).color).toBe('rgb(65, 43, 21)')
  })

  it('does not trust nonce metadata without an enforcing CSP response header', async (t) => {
    let doc = await navigateUnderCsp(t, 'named', { responsePolicy: null })
    let styled = doc.querySelector('#styled')
    invariant(styled)
    expect(doc.defaultView?.getComputedStyle(styled).color).toBe('rgb(0, 0, 0)')
    expect(doc.querySelector<HTMLStyleElement>('#authorized-style')?.nonce).toBe('response-nonce')
  })

  it('leaves styles blocked when the response has conflicting nonces', async (t) => {
    let doc = await navigateUnderCsp(t, 'named', {
      responsePolicy: "script-src 'nonce-other'; style-src 'nonce-response-nonce'",
    })
    let styled = doc.querySelector('#styled')
    invariant(styled)
    expect(doc.defaultView?.getComputedStyle(styled).color).toBe('rgb(0, 0, 0)')
    expect(doc.querySelector<HTMLStyleElement>('#authorized-style')?.nonce).toBe('response-nonce')
  })

  it('leaves unnonced styles and styles with a different nonce blocked', async (t) => {
    let doc = await navigateUnderCsp(t, 'named')
    let unnonced = doc.querySelector('#unnonced')
    let forged = doc.querySelector('#forged')
    invariant(unnonced && forged)

    expect(doc.defaultView?.getComputedStyle(unnonced).color).toBe('rgb(0, 0, 0)')
    expect(doc.defaultView?.getComputedStyle(forged).color).toBe('rgb(0, 0, 0)')
    expect(doc.querySelector<HTMLStyleElement>('#forged-style')?.nonce).toBe('forged-nonce')
    expect(doc.querySelector('#unnonced-style')?.hasAttribute('nonce')).toBe(false)
  })
})

async function navigateUnderCsp(
  t: TestContext,
  target: 'document' | 'named' | 'client',
  options: {
    nestedTemplate?: boolean
    separateImportMapNonce?: boolean
    responsePolicy?: string | null
  } = {},
) {
  let initialContent = <p id="initial">Initial frame</p>
  let nextContent = (
    <section>
      <style id="authorized-style" nonce="response-nonce">
        {'#styled { color: rgb(65, 43, 21); }'}
      </style>
      <p id="styled">Styled</p>
      <meta name="rmx-nonce" nonce="forged-nonce" />
      <style id="forged-style" nonce="forged-nonce">
        {'#forged { color: rgb(255, 0, 0); }'}
      </style>
      <p id="forged">Forged</p>
      <style id="unnonced-style">{'#unnonced { color: rgb(255, 0, 0); }'}</style>
      <p id="unnonced">Unnonced</p>
    </section>
  )
  let nextHtml = await renderToString(
    target === 'document' ? (
      <html>
        <head />
        <body>{nextContent}</body>
      </html>
    ) : (
      nextContent
    ),
    { nonce: 'response-nonce' },
  )
  if (options.nestedTemplate) {
    let nestedHtml = nextHtml
    nextHtml = await new Response(
      renderToStream(<Frame src="/nested" fallback={<p>Loading</p>} />, {
        nonce: 'response-nonce',
        resolveFrame: async () => nestedHtml,
      }),
    ).text()
  }
  let componentHref = new URL('../runtime/component.ts', import.meta.url).href
  let jsxHref = new URL('../runtime/jsx.ts', import.meta.url).href
  let runHref = new URL('../runtime/run.ts', import.meta.url).href
  let message = crypto.randomUUID()
  let responsePolicy =
    options.responsePolicy === undefined
      ? "script-src 'nonce-response-nonce'; style-src 'nonce-response-nonce'"
      : options.responsePolicy
  let bootstrap = `
    import { run } from ${JSON.stringify(runHref)}
    import { Frame } from ${JSON.stringify(componentHref)}
    import { jsx } from ${JSON.stringify(jsxHref)}
    let app = run({
      resolveFrame() {
        return new Response(${JSON.stringify(nextHtml).replace(/</g, '\\u003c')}, {
          headers: ${JSON.stringify(responsePolicy === null ? {} : { 'Content-Security-Policy': responsePolicy })},
        })
      },
      async loadModule(href, name) { return (await import(href))[name] },
    })
    try {
      await app.ready()
      ${
        target === 'client'
          ? `let styledReady = new Promise(resolve => {
          let observer = new MutationObserver(() => {
            if (!document.querySelector('#styled')) return
            observer.disconnect()
            resolve()
          })
          observer.observe(document.body, {childList: true, subtree: true})
        })
        await app.frames.top.replace(jsx(Frame, {src: '/next'}))
        await styledReady`
          : `let frame = ${target === 'document' ? 'app.frames.top' : "app.frames.get('child')"}
          frame.src = '/next'
          await frame.reload()`
      }
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
          {options.separateImportMapNonce ? <ImportMap nonce="map-nonce" value={{}} /> : null}
          <script type="module" nonce="document-nonce">
            {bootstrap}
          </script>
        </head>
        <body>
          <Frame name="child" src="/child" />
        </body>
      </html>,
      { nonce: 'document-nonce', resolveFrame: () => renderToStream(initialContent) },
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
