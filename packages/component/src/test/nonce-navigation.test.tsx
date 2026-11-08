import { expect } from '@remix-run/assert'
import { describe, it, type TestContext } from '@remix-run/test'

import { Frame } from '../runtime/frame.ts'
import { invariant } from '../runtime/invariant.ts'
import { renderToStream, renderToString } from '../server/stream.ts'
import { drain, renderNonceDocument } from './utils.ts'

describe('CSP frame navigation', () => {
  it('does not trust nonce metadata without a CSP response header', async (t) => {
    let doc = await navigateUnderCsp(t, 'named', { responseCsp: false })
    let styled = doc.querySelector('#styled')
    invariant(styled)
    expect(doc.defaultView?.getComputedStyle(styled).color).toBe('rgb(0, 0, 0)')
    expect(doc.querySelector<HTMLStyleElement>('#authorized-style')?.nonce).toBe('response-nonce')
  })

  it('respects CSP when adopting marked styles during initial hydration', async (t) => {
    expectMarkedStyles(await navigateUnderCsp(t, 'initial', { markedStyles: true }))
  })

  it('respects CSP when adopting marked styles during document navigation', async (t) => {
    expectMarkedStyles(await navigateUnderCsp(t, 'document', { markedStyles: true }))
  })

  it('keeps authorized styles working in client-created frames', async (t) => {
    expectMarkedStyles(await navigateUnderCsp(t, 'client', { markedStyles: true }))
  })

  it('respects CSP when adopting marked styles from streamed templates', async (t) => {
    expectMarkedStyles(
      await navigateUnderCsp(t, 'named', { markedStyles: true, nestedTemplate: true }),
    )
  })

  it('does not adopt marked styles forbidden by another enforcing policy', async (t) => {
    let doc = await navigateUnderCsp(t, 'named', {
      markedStyles: true,
      additionalStylePolicy: "style-src-elem 'none'",
    })
    let styled = doc.querySelector('#styled')
    invariant(styled)
    expect(doc.defaultView?.getComputedStyle(styled).color).toBe('rgb(0, 0, 0)')
    expect(doc.querySelector<HTMLStyleElement>('#authorized-style')?.sheet).toBeNull()
  })
})

function expectMarkedStyles(doc: Document): void {
  let styled = doc.querySelector('#styled')
  let unnonced = doc.querySelector('#unnonced')
  let forged = doc.querySelector('#forged')
  invariant(styled && unnonced && forged)
  expect(doc.defaultView?.getComputedStyle(styled).color).toBe('rgb(65, 43, 21)')
  expect(doc.querySelector('#authorized-style')).toBeNull()
  expect(doc.defaultView?.getComputedStyle(unnonced).color).toBe('rgb(0, 0, 0)')
  expect(doc.defaultView?.getComputedStyle(forged).color).toBe('rgb(0, 0, 0)')
  expect(doc.querySelector<HTMLStyleElement>('#unnonced-style')?.sheet).toBeNull()
  expect(doc.querySelector<HTMLStyleElement>('#forged-style')?.sheet).toBeNull()
}

async function navigateUnderCsp(
  t: TestContext,
  target: 'document' | 'named' | 'initial' | 'client',
  options: {
    nestedTemplate?: boolean
    responseCsp?: boolean
    markedStyles?: boolean
    additionalStylePolicy?: string
  } = {},
) {
  let initialContent = <p id="initial">Initial frame</p>
  let nextContent = (
    <section>
      <style
        id="authorized-style"
        nonce={target === 'initial' ? 'document-nonce' : 'response-nonce'}
        data-rmx-style={options.markedStyles ? 'authorized' : undefined}
      >
        {'#styled { color: rgb(65, 43, 21); }'}
      </style>
      <p id="styled">Styled</p>
      <meta name="rmx-nonce" nonce="forged-nonce" />
      <style
        id="forged-style"
        nonce="forged-nonce"
        data-rmx-style={options.markedStyles ? 'forged' : undefined}
      >
        {'#forged { color: rgb(255, 0, 0); }'}
      </style>
      <p id="forged">Forged</p>
      <style id="unnonced-style" data-rmx-style={options.markedStyles ? 'unnonced' : undefined}>
        {'#unnonced { color: rgb(255, 0, 0); }'}
      </style>
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
  let runHref = new URL('../runtime/run.ts', import.meta.url).href
  let frameHref = new URL('../runtime/frame.ts', import.meta.url).href
  let jsxHref = new URL('../runtime/core/vnode.ts', import.meta.url).href
  let message = crypto.randomUUID()
  let responseHeaders =
    options.responseCsp === false
      ? {}
      : {
          'Content-Security-Policy':
            "script-src 'nonce-response-nonce'; style-src 'nonce-response-nonce'",
        }
  let bootstrap = `
    import { run } from ${JSON.stringify(runHref)}
    import { Frame } from ${JSON.stringify(frameHref)}
    import { jsx } from ${JSON.stringify(jsxHref)}
    let app = run({
      resolveFrame() {
        return new Response(${JSON.stringify(nextHtml).replace(/</g, '\\u003c')}, {
          headers: ${JSON.stringify(responseHeaders)},
        })
      },
      async loadModule(href, name) { return (await import(href))[name] },
    })
    try {
      await app.ready()
      ${
        target === 'initial'
          ? ''
          : target === 'client'
            ? `let styledReady = new Promise(resolve => {
                let observer = new MutationObserver(() => {
                  if (!document.querySelector('#styled')) return
                  observer.disconnect()
                  resolve()
                })
                observer.observe(document.body, { childList: true, subtree: true })
              })
              await app.frames.top.replace(jsx(Frame, { src: '/next' }))
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
          {options.additionalStylePolicy ? (
            <meta httpEquiv="Content-Security-Policy" content={options.additionalStylePolicy} />
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
        nonce: 'document-nonce',
        resolveFrame: () => renderToStream(target === 'initial' ? nextContent : initialContent),
      },
    ),
  )
  let doc = await renderNonceDocument(t, html, message)
  expect(doc.documentElement.dataset.error).toBeUndefined()
  return doc
}
