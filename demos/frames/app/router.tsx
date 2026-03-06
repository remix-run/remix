import { createRouter } from 'remix/fetch-router'
import { logger } from 'remix/logger-middleware'
import { staticFiles } from 'remix/static-middleware'
import { renderToStream } from 'remix/component/server'
import { Frame } from 'remix/component'

import { routes } from './routes.ts'
import { Counter } from './assets/counter.tsx'
import { ReloadTime } from './assets/reload-time.tsx'
import { ReloadScope } from './assets/reload-scope.tsx'
import { ClientFrameExample } from './assets/client-frame-example.tsx'
import { ClientMountedPageExample } from './assets/client-mounted-page-example.tsx'
import { StateSearchPage } from './assets/state-search-page.tsx'
import { searchUnitedStates } from './us-states.ts'

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
        <script async type="module" src="/assets/entry.js" />
      </head>
      <body
        style={{
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, Apple Color Emoji, Segoe UI Emoji',
          margin: 0,
          padding: 24,
          background: '#0b1020',
          color: '#e9eefc',
        }}
      >
        <div style={{ maxWidth: 980, margin: '0 auto' }}>
          <h1 style={{ margin: 0, letterSpacing: '-0.02em' }}>Full-stack Frames</h1>
          <p style={{ marginTop: 8, color: '#b9c6ff' }}>
            Server routes are handled by <code>remix/fetch-router</code>; UI is streamed with{' '}
            <code>remix/component</code> Frames and client entries.
          </p>
          <p style={{ marginTop: 0, marginBottom: 16 }}>
            <a href="/time" style={{ color: '#b9c6ff', textDecoration: 'underline' }}>
              Server time demo
            </a>
            {' · '}
            <a href="/reload-scope" style={{ color: '#b9c6ff', textDecoration: 'underline' }}>
              Frame vs top reload demo
            </a>
            {' · '}
            <a href="/state-search" style={{ color: '#b9c6ff', textDecoration: 'underline' }}>
              Dynamic src search demo
            </a>
            {' · '}
            <a href="/client-mounted" style={{ color: '#b9c6ff', textDecoration: 'underline' }}>
              Client-mounted nested frame demo
            </a>
          </p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '320px 1fr',
              gap: 16,
              alignItems: 'start',
              marginTop: 24,
            }}
          >
            <aside
              style={{
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 12,
                padding: 16,
                background: 'rgba(255,255,255,0.04)',
              }}
            >
              <h2 style={{ marginTop: 0, fontSize: 16 }}>Sidebar (Frame)</h2>
              <Frame
                src="/frames/sidebar"
                fallback={<div style={{ color: '#9aa8e8' }}>Loading sidebar…</div>}
              />
            </aside>

            <main
              style={{
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 12,
                padding: 16,
                background: 'rgba(255,255,255,0.04)',
              }}
            >
              <h2 style={{ marginTop: 0, fontSize: 16 }}>Main</h2>
              <p style={{ color: '#b9c6ff', marginTop: 0 }}>The counter below is a client entry.</p>
              <Counter setup={0} label="Clicks" />
              <ClientFrameExample />

              <div style={{ height: 16 }} />

              <h3 style={{ margin: 0, fontSize: 14, color: '#cfd8ff' }}>Activity (Frame)</h3>
              <Frame
                src="/frames/activity"
                fallback={<div style={{ color: '#9aa8e8' }}>Loading activity…</div>}
              />
            </main>
          </div>
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

router.get(routes.clientMounted, async (context: any) => {
  function ClientMountedPage() {
    return () => (
      <html>
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Client-mounted nested frame</title>
          <script async type="module" src="/assets/entry.js" />
        </head>
        <body
          style={{
            fontFamily:
              'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, Apple Color Emoji, Segoe UI Emoji',
            margin: 0,
            padding: 24,
            background: '#0b1020',
            color: '#e9eefc',
          }}
        >
          <div style={{ maxWidth: 760, margin: '0 auto' }}>
            <a href="/" style={{ color: '#b9c6ff', textDecoration: 'underline' }}>
              ← Back
            </a>
            <h1 style={{ marginTop: 16, marginBottom: 8, letterSpacing: '-0.02em' }}>
              Client-mounted nested non-blocking frame
            </h1>
            <p style={{ marginTop: 0, color: '#b9c6ff' }}>
              Mount the outer frame, then watch the nested frame fallback render before its server
              content streams in.
            </p>
            <ClientMountedPageExample />
          </div>
        </body>
      </html>
    )
  }

  let stream = renderToStream(<ClientMountedPage />, {
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
          style={{
            fontFamily:
              'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, Apple Color Emoji, Segoe UI Emoji',
            margin: 0,
            padding: 24,
            background: '#0b1020',
            color: '#e9eefc',
          }}
        >
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <a href="/" style={{ color: '#b9c6ff', textDecoration: 'underline' }}>
              ← Back
            </a>

            <h1 style={{ marginTop: 16, marginBottom: 8, letterSpacing: '-0.02em' }}>
              Server time (Frame reload)
            </h1>
            <p style={{ marginTop: 0, color: '#b9c6ff' }}>
              The frame below renders the current server time. Click “Refresh” to call{' '}
              <code>frame.reload()</code> from a client entry inside the frame.
            </p>

            <div
              style={{
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 12,
                padding: 16,
                background: 'rgba(255,255,255,0.04)',
              }}
            >
              <Frame
                src={routes.frames.time.href()}
                fallback={<div style={{ color: '#9aa8e8' }}>Loading server time…</div>}
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

router.get(routes.reloadScope, async (context: any) => {
  function ReloadScopePage() {
    let pageNow = new Date()

    return () => (
      <html>
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Frame vs top reload</title>
          <script async type="module" src="/assets/entry.js" />
        </head>
        <body
          style={{
            fontFamily:
              'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, Apple Color Emoji, Segoe UI Emoji',
            margin: 0,
            padding: 24,
            background: '#0b1020',
            color: '#e9eefc',
          }}
        >
          <div style={{ maxWidth: 760, margin: '0 auto' }}>
            <a href="/" style={{ color: '#b9c6ff', textDecoration: 'underline' }}>
              ← Back
            </a>
            <h1 style={{ marginTop: 16, marginBottom: 8, letterSpacing: '-0.02em' }}>
              Frame reload vs top reload
            </h1>
            <p style={{ marginTop: 0, color: '#b9c6ff' }}>
              Reload only this frame, or reload the entire runtime tree from inside the same client
              entry.
            </p>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 13, color: '#b9c6ff' }}>Page server time</div>
              <div style={{ fontSize: 20, fontVariantNumeric: 'tabular-nums' }}>
                {pageNow.toLocaleTimeString()}
              </div>
            </div>
            <div
              style={{
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 12,
                padding: 16,
                background: 'rgba(255,255,255,0.04)',
              }}
            >
              <Frame
                src={routes.frames.reloadScope.href()}
                fallback={<div style={{ color: '#9aa8e8' }}>Loading reload controls…</div>}
              />
            </div>
          </div>
        </body>
      </html>
    )
  }

  let stream = renderToStream(<ReloadScopePage />, {
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

router.get(routes.stateSearch, async (context: any) => {
  let url = new URL(context.request.url)
  let initialQuery = url.searchParams.get('query') ?? ''

  function StateSearchRoutePage() {
    return () => (
      <html>
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Dynamic Frame src search</title>
          <script async type="module" src="/assets/entry.js" />
        </head>
        <body
          style={{
            fontFamily:
              'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, Apple Color Emoji, Segoe UI Emoji',
            margin: 0,
            padding: 24,
            background: '#0b1020',
            color: '#e9eefc',
          }}
        >
          <div style={{ maxWidth: 760, margin: '0 auto' }}>
            <a href="/" style={{ color: '#b9c6ff', textDecoration: 'underline' }}>
              ← Back
            </a>
            <h1 style={{ marginTop: 16, marginBottom: 8, letterSpacing: '-0.02em' }}>
              Dynamic <code>{'<Frame src>'}</code> state search
            </h1>
            <p style={{ marginTop: 0, color: '#b9c6ff' }}>
              Submit the form to update the frame <code>src</code> query params and fetch matching
              U.S. states.
            </p>
            <StateSearchPage setup={initialQuery} />
          </div>
        </body>
      </html>
    )
  }

  let stream = renderToStream(<StateSearchRoutePage />, {
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
        <li>Can contain client entries</li>
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

router.get(routes.frames.activity, async (context: any) => {
  await new Promise((resolve) => setTimeout(resolve, 2000))

  let stream = renderToStream(
    <div>
      <p style={{ marginTop: 0, color: '#b9c6ff' }}>
        Rendered by <code>/frames/activity</code> at <time>{new Date().toLocaleTimeString()}</time>.
      </p>
      <Frame
        src={routes.frames.activityDetail.href()}
        fallback={<div style={{ color: '#9aa8e8' }}>Loading detail…</div>}
      />
    </div>,
    {
      resolveFrame: (src: string) => resolveFrameViaRouter(context.request, src),
      onError: console.error,
    },
  )

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
})

router.get(routes.frames.activityDetail, async (context: any) => {
  await new Promise((resolve) => setTimeout(resolve, 600))

  let stream = renderToStream(
    <div>
      <p style={{ marginTop: 0, marginBottom: 8, color: '#9aa8e8' }}>
        Nested frame with a hydrated counter:
      </p>
      <div style={{ marginTop: 12 }}>
        <Frame
          src={routes.frames.time.href()}
          fallback={<div style={{ color: '#9aa8e8' }}>Loading server time…</div>}
        />
      </div>
    </div>,
    {
      resolveFrame: (src: string) => resolveFrameViaRouter(context.request, src),
      onError: console.error,
    },
  )

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
})

router.get(routes.frames.clientFrameExample, async (context) => {
  await new Promise((resolve) => setTimeout(resolve, 500))

  let now = new Date()
  let stream = renderToStream(
    <div
      style={{
        border: '1px solid rgba(255,255,255,0.10)',
        borderRadius: 10,
        padding: 10,
        background: 'rgba(255,255,255,0.02)',
      }}
    >
      <div style={{ fontSize: 12, color: '#b9c6ff' }}>
        Server fragment from /frames/client-frame-example
      </div>
      <div style={{ fontSize: 16, fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>
        {now.toLocaleTimeString()}
      </div>
      <div style={{ marginTop: 8 }}>
        <Counter setup={5} label="Inside mounted frame" />
      </div>
      <div style={{ marginTop: 10 }}>
        <div style={{ fontSize: 12, color: '#9aa8e8', marginBottom: 6 }}>Nested frame:</div>
        <Frame
          src={routes.frames.clientFrameExampleNested.href()}
          fallback={<div style={{ color: '#9aa8e8' }}>Loading nested frame…</div>}
        />
      </div>
    </div>,
    {
      resolveFrame: (src: string) => resolveFrameViaRouter(context.request, src),
      onError: console.error,
    },
  )

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
})

router.get(routes.frames.clientFrameExampleNested, async () => {
  await new Promise((resolve) => setTimeout(resolve, 350))

  let stream = renderToStream(
    <div
      style={{
        border: '1px solid rgba(255,255,255,0.10)',
        borderRadius: 8,
        padding: 8,
        background: 'rgba(255,255,255,0.02)',
      }}
    >
      <div style={{ fontSize: 12, color: '#b9c6ff' }}>Nested server fragment</div>
      <div style={{ marginTop: 6 }}>
        <Counter setup={1} label="Nested frame counter" />
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

router.get(routes.frames.clientMountedOuter, async (context: any) => {
  await new Promise((resolve) => setTimeout(resolve, 350))

  let stream = renderToStream(
    <div
      style={{
        border: '1px solid rgba(255,255,255,0.10)',
        borderRadius: 10,
        padding: 10,
        background: 'rgba(255,255,255,0.02)',
      }}
    >
      <div style={{ fontSize: 12, color: '#b9c6ff' }}>
        Outer server fragment from /frames/client-mounted-outer
      </div>
      <div style={{ marginTop: 8 }}>
        <Counter setup={2} label="Outer frame counter" />
      </div>
      <div style={{ marginTop: 10 }}>
        <div style={{ fontSize: 12, color: '#9aa8e8', marginBottom: 6 }}>
          Nested non-blocking frame:
        </div>
        <Frame
          src={routes.frames.clientMountedNested.href()}
          fallback={<div style={{ color: '#9aa8e8' }}>Loading nested non-blocking frame…</div>}
        />
      </div>
    </div>,
    {
      resolveFrame: (src: string) => resolveFrameViaRouter(context.request, src),
      onError: console.error,
    },
  )

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
})

router.get(routes.frames.clientMountedNested, async () => {
  await new Promise((resolve) => setTimeout(resolve, 2200))

  let stream = renderToStream(
    <div
      style={{
        border: '1px solid rgba(255,255,255,0.10)',
        borderRadius: 8,
        padding: 8,
        background: 'rgba(255,255,255,0.02)',
      }}
    >
      <div style={{ fontSize: 12, color: '#b9c6ff' }}>Nested server fragment</div>
      <div style={{ fontSize: 16, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
        {new Date().toLocaleTimeString()}
      </div>
      <div style={{ marginTop: 6 }}>
        <Counter setup={3} label="Nested frame counter" />
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

router.get(routes.frames.time, async () => {
  // Artificial delay so the frame fallback/pending UI is visible.
  await new Promise((resolve) => setTimeout(resolve, 1200))

  let now = new Date()
  let stream = renderToStream(
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div>
          <div style={{ fontSize: 13, color: '#b9c6ff' }}>Server time</div>
          <div style={{ fontSize: 18, fontVariantNumeric: 'tabular-nums' }}>
            {now.toLocaleTimeString()}
          </div>
        </div>
        <Counter setup={0} label="In a frame" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <ReloadTime />
        </div>
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

router.get(routes.frames.reloadScope, async () => {
  await new Promise((resolve) => setTimeout(resolve, 700))

  let now = new Date()
  let stream = renderToStream(
    <div>
      <div style={{ fontSize: 13, color: '#b9c6ff' }}>Frame server time</div>
      <div style={{ fontSize: 18, fontVariantNumeric: 'tabular-nums', marginBottom: 10 }}>
        {now.toLocaleTimeString()}
      </div>
      <ReloadScope />
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

router.get(routes.frames.stateSearchResults, async (context: any) => {
  await new Promise((resolve) => setTimeout(resolve, 300))

  let url = new URL(context.request.url)
  let query = (url.searchParams.get('query') ?? '').trim()
  let matches = searchUnitedStates(query)

  let stream = renderToStream(
    <div>
      <p style={{ marginTop: 0, marginBottom: 10, color: '#b9c6ff' }}>
        {query
          ? `Results for "${query}" (${matches.length})`
          : `Showing all states (${matches.length})`}
      </p>
      {matches.length > 0 ? (
        <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 4 }}>
          {matches.map((state) => (
            <li key={state}>{state}</li>
          ))}
        </ul>
      ) : (
        <p style={{ margin: 0, color: '#9aa8e8' }}>No states matched that query.</p>
      )}
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
