import { createRouter } from '@remix-run/fetch-router'
import { logger } from '@remix-run/logger-middleware'
import { staticFiles } from '@remix-run/static-middleware'
import { css, renderToHTMLStream } from '@remix-run/dom'
import { routes } from './routes.ts'
import { SimpleCounter } from './assets/simple-counter.tsx'
import { FrameReloadButton } from './assets/frame-reload-button.tsx'
import { HydrationBadge } from './assets/hydration-badge.tsx'

let middleware = []
if (process.env.NODE_ENV === 'development') {
  middleware.push(logger())
}
middleware.push(
  staticFiles('./public', {
    cacheControl: 'no-store',
    etag: false,
    lastModified: false,
    index: false,
  }),
)
export let router = createRouter({ middleware })

let pageStyle = {
  fontFamily:
    'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, Apple Color Emoji, Segoe UI Emoji',
  margin: '0',
  padding: '24px',
  background: '#0b1020',
  color: '#edf2ff',
}

let cardStyle = {
  border: '1px solid rgba(255,255,255,0.14)',
  borderRadius: '12px',
  padding: '16px',
  background: 'rgba(255,255,255,0.04)',
}

let navLinkStyle = {
  color: '#c7d5ff',
  textDecoration: 'underline',
  fontSize: '14px',
}

router.get(routes.home, async (context) => {
  let content = (
    <div mix={[css(cardStyle)]}>
      <p mix={[css({ marginTop: '0' })]}>
        A focused demo for the new DOM runtime APIs: <code>renderToHTMLStream</code> on the server
        and <code>boot(document, ...)</code> on the client.
      </p>
      <ul mix={[css({ marginBottom: '0', display: 'grid', gap: '8px' })]}>
        <li>
          <a mix={[css(navLinkStyle)]} href={routes.simpleHydration.href()}>
            Simple hydration
          </a>
        </li>
        <li>
          <a mix={[css(navLinkStyle)]} href={routes.oooStreaming.href()}>
            Basic out-of-order frame streaming
          </a>
        </li>
        <li>
          <a mix={[css(navLinkStyle)]} href={routes.nestedFrames.href()}>
            Nested frames
          </a>
        </li>
        <li>
          <a mix={[css(navLinkStyle)]} href={routes.frameReload.href()}>
            Frame reload from client entry
          </a>
        </li>
      </ul>
    </div>
  )
  return htmlResponse(
    renderToHTMLStream(renderPage('DOM Boot + Frames Demo', content), {
      resolveFrame: (src, signal) =>
        resolveFrameViaRouter(context.request, src, signal),
      onError(error) {
        console.error(error)
      },
    }),
  )
})

router.get(routes.simpleHydration, async () => {
  let content = (
    <div mix={[css(cardStyle)]}>
      <p mix={[css({ marginTop: '0' })]}>
        This page SSRs a client entry counter and hydrates it after boot.
      </p>
      <div mix={[css({ display: 'flex', gap: '12px', alignItems: 'center' })]}>
        <SimpleCounter setup={1} label="Count" />
        <HydrationBadge />
      </div>
    </div>
  )
  return htmlResponse(
    renderToHTMLStream(renderPage('Simple hydration', content), {
      onError(error) {
        console.error(error)
      },
    }),
  )
})

router.get(routes.oooStreaming, async (context) => {
  let content = (
    <div mix={[css({ ...cardStyle, display: 'grid', gap: '14px' })]}>
      <p mix={[css({ margin: '0' })]}>
        Both frames start together. The second resolves faster, so it should appear first even
        though it is rendered later in the tree.
      </p>
      <div mix={[css({ ...cardStyle, background: 'rgba(255,255,255,0.02)' })]}>
        <h2 mix={[css({ marginTop: '0' })]}>Slow frame A</h2>
        <frame
          src={routes.frames.slowA.href()}
          fallback={<p mix={[css({ color: '#b5c5f9', marginBottom: '0' })]}>Loading frame A…</p>}
        />
      </div>
      <div mix={[css({ ...cardStyle, background: 'rgba(255,255,255,0.02)' })]}>
        <h2 mix={[css({ marginTop: '0' })]}>Fast frame B</h2>
        <frame
          src={routes.frames.slowB.href()}
          fallback={<p mix={[css({ color: '#b5c5f9', marginBottom: '0' })]}>Loading frame B…</p>}
        />
      </div>
    </div>
  )
  return htmlResponse(
    renderToHTMLStream(renderPage('Basic out-of-order frame streaming', content), {
      resolveFrame: (src, signal) =>
        resolveFrameViaRouter(context.request, src, signal),
      onError(error) {
        console.error(error)
      },
    }),
  )
})

router.get(routes.nestedFrames, async (context) => {
  let content = (
    <div mix={[css({ ...cardStyle, display: 'grid', gap: '12px' })]}>
      <p mix={[css({ marginTop: '0' })]}>
        The outer frame renders first, then it streams a nested frame with its own async boundary.
      </p>
      <frame
        src={routes.frames.nestedOuter.href()}
        fallback={
          <p mix={[css({ color: '#b5c5f9', marginBottom: '0' })]}>Loading outer frame…</p>
        }
      />
    </div>
  )
  return htmlResponse(
    renderToHTMLStream(renderPage('Nested frames', content), {
      resolveFrame: (src, signal) =>
        resolveFrameViaRouter(context.request, src, signal),
      onError(error) {
        console.error(error)
      },
    }),
  )
})

router.get(routes.frameReload, async (context) => {
  let content = (
    <div mix={[css(cardStyle)]}>
      <p mix={[css({ marginTop: '0' })]}>
        This frame contains client entry buttons that call <code>handle.frame.reload()</code> and{' '}
        <code>handle.frames.top.reload()</code>. Top-frame reloads fetch full-document HTML and apply
        it with document-aware diffing.
      </p>
      <frame
        src={routes.frames.reloadableClock.href()}
        fallback={
          <p mix={[css({ color: '#b5c5f9', marginBottom: '0' })]}>Loading clock frame…</p>
        }
      />
    </div>
  )
  return htmlResponse(
    renderToHTMLStream(renderPage('Frame reload from client entry', content), {
      resolveFrame: (src, signal) =>
        resolveFrameViaRouter(context.request, src, signal),
      onError(error) {
        console.error(error)
      },
    }),
  )
})

router.get(routes.frames.slowA, async () => {
  await delay(2000)
  return htmlResponse(
    renderToHTMLStream(
      <div mix={[css({ display: 'grid', gap: '8px' })]}>
        <strong>Frame A resolved</strong>
        <span mix={[css({ color: '#b5c5f9' })]}>{new Date().toLocaleTimeString()}</span>
      </div>,
      { onError: console.error },
    ),
  )
})

router.get(routes.frames.slowB, async () => {
  await delay(450)
  return htmlResponse(
    renderToHTMLStream(
      <div mix={[css({ display: 'grid', gap: '8px' })]}>
        <strong>Frame B resolved first</strong>
        <span mix={[css({ color: '#b5c5f9' })]}>{new Date().toLocaleTimeString()}</span>
      </div>,
      { onError: console.error },
    ),
  )
})

router.get(routes.frames.nestedOuter, async (context) => {
  await delay(600)
  return htmlResponse(
    renderToHTMLStream(
      <div mix={[css({ ...cardStyle, background: 'rgba(255,255,255,0.02)' })]}>
        <h3 mix={[css({ marginTop: '0' })]}>Outer frame body</h3>
        <SimpleCounter setup={10} label="Outer counter" />
        <div mix={[css({ height: '12px' })]} />
        <frame
          src={routes.frames.nestedInner.href()}
          fallback={<p mix={[css({ color: '#b5c5f9', marginBottom: '0' })]}>Loading inner frame…</p>}
        />
      </div>,
      {
        resolveFrame: (src, signal) =>
          resolveFrameViaRouter(context.request, src, signal),
        onError: console.error,
      },
    ),
  )
})

router.get(routes.frames.nestedInner, async () => {
  await delay(1500)
  return htmlResponse(
    renderToHTMLStream(
      <div mix={[css({ ...cardStyle, background: 'rgba(255,255,255,0.02)' })]}>
        <strong>Inner frame body</strong>
        <div mix={[css({ marginTop: '8px' })]}>
          <SimpleCounter setup={100} label="Inner counter" />
        </div>
      </div>,
      { onError: console.error },
    ),
  )
})

router.get(routes.frames.reloadableClock, async () => {
  await delay(350)
  let serverTime = new Date().toLocaleTimeString()
  return htmlResponse(
    renderToHTMLStream(
      <div mix={[css({ ...cardStyle, background: 'rgba(255,255,255,0.02)', display: 'grid', gap: '10px' })]}>
        <div>
          <div mix={[css({ fontSize: '13px', color: '#b5c5f9' })]}>Server time</div>
          <div mix={[css({ fontSize: '20px', fontVariantNumeric: 'tabular-nums' })]}>
            {serverTime}
          </div>
        </div>
        <SimpleCounter setup={0} label="Frame counter" serverTime={serverTime} />
        <div mix={[css({ display: 'flex', gap: '10px', alignItems: 'center' })]}>
          <FrameReloadButton />
          <FrameReloadButton target="top" />
        </div>
      </div>,
      { onError: console.error },
    ),
  )
})

function renderPage(title: string, content: unknown) {
  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title}</title>
        <script async type="module" src="/assets/entry.js" />
      </head>
      <body mix={[css(pageStyle)]}>
        <div mix={[css({ maxWidth: '900px', margin: '0 auto', display: 'grid', gap: '16px' })]}>
          <h1 mix={[css({ margin: '0', letterSpacing: '-0.02em' })]}>{title}</h1>
          <nav mix={[css({ display: 'flex', flexWrap: 'wrap', gap: '10px' })]}>
            <a mix={[css(navLinkStyle)]} href={routes.home.href()}>
              Home
            </a>
            <a mix={[css(navLinkStyle)]} href={routes.simpleHydration.href()}>
              Simple hydration
            </a>
            <a mix={[css(navLinkStyle)]} href={routes.oooStreaming.href()}>
              OOO frame streaming
            </a>
            <a mix={[css(navLinkStyle)]} href={routes.nestedFrames.href()}>
              Nested frames
            </a>
            <a mix={[css(navLinkStyle)]} href={routes.frameReload.href()}>
              Frame reload
            </a>
          </nav>
          {content as any}
        </div>
      </body>
    </html>
  )
}

function htmlResponse(stream: ReadableStream<Uint8Array>) {
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}

async function resolveFrameViaRouter(request: Request, src: string, signal?: AbortSignal) {
  let url = new URL(src, request.url)
  let headers = new Headers(request.headers)
  headers.delete('accept-encoding')
  headers.set('accept', 'text/html')
  let response = await router.fetch(
    new Request(url, {
      method: 'GET',
      headers,
      signal: signal ?? request.signal,
    }),
  )
  if (!response.ok) {
    return `<pre>Frame error: ${response.status} ${response.statusText}</pre>`
  }
  if (response.body) return response.body
  return await response.text()
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
