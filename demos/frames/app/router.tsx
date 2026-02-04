import { createRouter } from 'remix/fetch-router'
import { logger } from 'remix/logger-middleware'
import { staticFiles } from 'remix/static-middleware'
import { renderToStream } from 'remix/component/server'
import { Frame } from 'remix/component'

import { routes } from './routes.ts'
import { Counter } from './assets/counter.tsx'
import { ReloadTime } from './assets/reload-time.tsx'

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

function App() {
  return () => (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Frames + fetch-router demo</title>
      </head>
      <body
        css={{
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, Apple Color Emoji, Segoe UI Emoji',
          margin: 0,
          padding: 24,
          background: '#0b1020',
          color: '#e9eefc',
        }}
      >
        <div css={{ maxWidth: 980, margin: '0 auto' }}>
          <h1 css={{ margin: 0, letterSpacing: '-0.02em' }}>Full-stack Frames</h1>
          <p css={{ marginTop: 8, color: '#b9c6ff' }}>
            Server routes are handled by <code>remix/fetch-router</code>; UI is streamed with{' '}
            <code>remix/component</code> Frames and hydrated islands.
          </p>
          <p css={{ marginTop: 0, marginBottom: 16 }}>
            <a href="/time" css={{ color: '#b9c6ff', textDecoration: 'underline' }}>
              Server time demo
            </a>
          </p>

          <div
            css={{
              display: 'grid',
              gridTemplateColumns: '320px 1fr',
              gap: 16,
              alignItems: 'start',
              marginTop: 24,
            }}
          >
            <aside
              css={{
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 12,
                padding: 16,
                background: 'rgba(255,255,255,0.04)',
              }}
            >
              <h2 css={{ marginTop: 0, fontSize: 16 }}>Sidebar (Frame)</h2>
              <Frame
                src="/frames/sidebar"
                fallback={<div css={{ color: '#9aa8e8' }}>Loading sidebar…</div>}
              />
            </aside>

            <main
              css={{
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 12,
                padding: 16,
                background: 'rgba(255,255,255,0.04)',
              }}
            >
              <h2 css={{ marginTop: 0, fontSize: 16 }}>Main</h2>
              <p css={{ color: '#b9c6ff', marginTop: 0 }}>
                The counter below is a hydrated island.
              </p>
              <Counter setup={0} label="Clicks" />

              <div css={{ height: 16 }} />

              <h3 css={{ margin: 0, fontSize: 14, color: '#cfd8ff' }}>Activity (Frame)</h3>
              <Frame
                src="/frames/activity"
                fallback={<div css={{ color: '#9aa8e8' }}>Loading activity…</div>}
              />
            </main>
          </div>

          <script type="module" src="/assets/entry.js" />
        </div>
      </body>
    </html>
  )
}

router.get(routes.home, async (context: any) => {
  let stream = renderToStream(<App />, {
    resolveFrame: (src: string) => resolveFrameViaRouter(context.request, src),
    onError(error) {
      console.error(error)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
})

router.get(routes.time, async (context: any) => {
  function TimePage() {
    return () => (
      <html>
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Server time</title>
          <script async type="module" src="/assets/entry.js" />
        </head>
        <body
          css={{
            fontFamily:
              'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, Apple Color Emoji, Segoe UI Emoji',
            margin: 0,
            padding: 24,
            background: '#0b1020',
            color: '#e9eefc',
          }}
        >
          <div css={{ maxWidth: 720, margin: '0 auto' }}>
            <a href="/" css={{ color: '#b9c6ff', textDecoration: 'underline' }}>
              ← Back
            </a>

            <h1 css={{ marginTop: 16, marginBottom: 8, letterSpacing: '-0.02em' }}>
              Server time (Frame reload)
            </h1>
            <p css={{ marginTop: 0, color: '#b9c6ff' }}>
              The frame below renders the current server time. Click “Refresh” to call{' '}
              <code>frame.reload()</code> from a hydrated island inside the frame.
            </p>

            <div
              css={{
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 12,
                padding: 16,
                background: 'rgba(255,255,255,0.04)',
              }}
            >
              <Frame
                src="/frames/time"
                fallback={<div css={{ color: '#9aa8e8' }}>Loading server time…</div>}
              />
            </div>
          </div>
        </body>
      </html>
    )
  }

  let stream = renderToStream(<TimePage />, {
    resolveFrame: (src: string) => resolveFrameViaRouter(context.request, src),
    onError(error) {
      console.error(error)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
})

router.get(routes.frames.sidebar, async () => {
  await new Promise((resolve) => setTimeout(resolve, 400))

  let stream = renderToStream(
    <div>
      <p style={{ marginTop: 0, color: '#b9c6ff' }}>
        This content is rendered by <code>/frames/sidebar</code>.
      </p>
      <ul style={{ margin: 0, paddingLeft: '18px', color: '#e9eefc' }}>
        <li>Streams in after initial HTML</li>
        <li>Can contain hydrated islands</li>
        <li>Can nest frames</li>
      </ul>
    </div>,
    { onError: console.error },
  )

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
})

router.get(routes.frames.activity, async () => {
  await new Promise((resolve) => setTimeout(resolve, 800))

  let stream = renderToStream(
    <div>
      <p style={{ marginTop: 0, color: '#b9c6ff' }}>
        Rendered by <code>/frames/activity</code> at <time>{new Date().toLocaleTimeString()}</time>.
      </p>
      <p style={{ margin: 0, color: '#9aa8e8' }}>
        Try reloading the page to see the frame stream again.
      </p>
    </div>,
    { onError: console.error },
  )

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
})

router.get(routes.frames.time, async () => {
  // Artificial delay so the frame fallback/pending UI is visible.
  await new Promise((resolve) => setTimeout(resolve, 1200))

  let now = new Date()
  let stream = renderToStream(
    <div>
      <div
        css={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div>
          <div css={{ fontSize: 13, color: '#b9c6ff' }}>Server time</div>
          <div css={{ fontSize: 18, fontVariantNumeric: 'tabular-nums' }}>
            {now.toLocaleTimeString()}
          </div>
        </div>
        <ReloadTime />
      </div>
    </div>,
    { onError: console.error },
  )

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
})

async function resolveFrameViaRouter(request: Request, src: string) {
  let url = new URL(src, request.url)

  // IMPORTANT: this is a server-internal fetch to get *HTML*, so do not forward
  // Accept-Encoding — otherwise compression middleware could return compressed bytes.
  let headers = new Headers(request.headers)
  headers.delete('accept-encoding')
  headers.set('accept', 'text/html')

  let res = await router.fetch(
    new Request(url, {
      method: 'GET',
      headers,
      signal: request.signal,
    }),
  )

  if (!res.ok) {
    return `<pre>Frame error: ${res.status} ${res.statusText}</pre>`
  }

  if (res.body) {
    return res.body
  }

  return await res.text()
}
