import { createRouter } from 'remix/fetch-router'
import { logger } from 'remix/logger-middleware'
import { staticFiles } from 'remix/static-middleware'
import { Frame } from 'remix/component'
import { renderToStream } from 'remix/component/server'

import { routes } from './routes.ts'
import { NavLink } from './nav-controls.tsx'

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

router.map(routes.main, {
  pages: {
    home(context: any) {
      return renderRootPage(context, routes.main.frames.home.href(), 'Home')
    },
    settings(context: any) {
      return renderRootPage(context, routes.main.frames.settings.href(), 'Settings')
    },
  },
  frames: {
    home() {
      return htmlResponse(renderToStream(<MainHome />, { onError: console.error }))
    },
    settings() {
      return htmlResponse(renderToStream(<MainSettings />, { onError: console.error }))
    },
    dashboard(context: any) {
      let Dashboard = createDashboardShell(routes.dashboard.frames.content.home.href())
      let stream = renderToStream(<Dashboard />, {
        resolveFrame: (src: string) => resolveFrameViaRouter(context.request, src),
        onError: console.error,
      })
      return htmlResponse(stream)
    },
  },
})

router.map(routes.dashboard, {
  pages: {
    home(context: any) {
      return renderRootPage(
        context,
        routes.dashboard.frames.shell.home.href(),
        'Dashboard Activity',
      )
    },
    customers(context: any) {
      return renderRootPage(
        context,
        routes.dashboard.frames.shell.customers.href(),
        'Dashboard Customers',
      )
    },
    sales(context: any) {
      return renderRootPage(context, routes.dashboard.frames.shell.sales.href(), 'Dashboard Sales')
    },
  },
  frames: {
    shell: {
      home(context: any) {
        let Dashboard = createDashboardShell(routes.dashboard.frames.content.home.href())
        let stream = renderToStream(<Dashboard />, {
          resolveFrame: (src: string) => resolveFrameViaRouter(context.request, src),
          onError: console.error,
        })
        return htmlResponse(stream)
      },
      customers(context: any) {
        let Dashboard = createDashboardShell(routes.dashboard.frames.content.customers.href())
        let stream = renderToStream(<Dashboard />, {
          resolveFrame: (src: string) => resolveFrameViaRouter(context.request, src),
          onError: console.error,
        })
        return htmlResponse(stream)
      },
      sales(context: any) {
        let Dashboard = createDashboardShell(routes.dashboard.frames.content.sales.href())
        let stream = renderToStream(<Dashboard />, {
          resolveFrame: (src: string) => resolveFrameViaRouter(context.request, src),
          onError: console.error,
        })
        return htmlResponse(stream)
      },
    },
    content: {
      home() {
        return htmlResponse(renderToStream(<DashboardActivity />, { onError: console.error }))
      },
      customers() {
        return htmlResponse(renderToStream(<DashboardCustomers />, { onError: console.error }))
      },
      sales() {
        return htmlResponse(renderToStream(<DashboardSales />, { onError: console.error }))
      },
    },
  },
})

function createRoot(frameHref: string, title: string) {
  return function Root() {
    return () => (
      <html>
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>{`Frame navigation demo · ${title}`}</title>
          <script async type="module" src="/assets/entry.js" />
        </head>
        <body
          style={{
            fontFamily:
              'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, Apple Color Emoji, Segoe UI Emoji',
            margin: 0,
            padding: 24,
            background: '#091124',
            color: '#e7eeff',
          }}
        >
          <div style={{ maxWidth: 920, margin: '0 auto' }}>
            <h1 style={{ margin: 0, letterSpacing: '-0.02em' }}>Two-level frame navigation</h1>
            <p style={{ marginTop: 8, color: '#b4c3ff' }}>
              Top-level links target the <code>main</code> frame with permalinks. Dashboard links
              target the nested <code>dashboard</code> frame.
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
              <NavLink
                href={routes.main.pages.home.href()}
                target="main"
                src={routes.main.frames.home.href()}
              >
                Home
              </NavLink>
              <NavLink
                href={routes.main.pages.settings.href()}
                target="main"
                src={routes.main.frames.settings.href()}
              >
                Settings
              </NavLink>
              <NavLink
                href={routes.dashboard.pages.home.href()}
                target="main"
                src={routes.main.frames.dashboard.href()}
              >
                Dashboard
              </NavLink>
            </div>
            <section
              style={{
                border: '1px solid rgba(255,255,255,0.14)',
                borderRadius: 12,
                background: 'rgba(255,255,255,0.03)',
                padding: 16,
              }}
            >
              <Frame src={frameHref} name="main" />
            </section>
          </div>
        </body>
      </html>
    )
  }
}

function MainHome() {
  return () => (
    <div>
      <h2 style={{ marginTop: 0 }}>Home</h2>
      <p style={{ marginBottom: 0, color: '#b4c3ff' }}>
        This is top-level frame content. Use the nav above to switch the <code>main</code> frame.
      </p>
    </div>
  )
}

function MainSettings() {
  return () => (
    <div>
      <h2 style={{ marginTop: 0 }}>Settings</h2>
      <p style={{ color: '#b4c3ff' }}>Settings lives in the same main frame target.</p>
    </div>
  )
}

function createDashboardShell(frameHref: string) {
  return function DashboardShell() {
    return () => (
      <div>
        <h2 style={{ marginTop: 0, marginBottom: 10 }}>Dashboard</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          <NavLink
            href={routes.dashboard.pages.home.href()}
            src={routes.dashboard.frames.content.home.href()}
            target="dashboard"
          >
            Activity
          </NavLink>
          <NavLink
            href={routes.dashboard.pages.customers.href()}
            src={routes.dashboard.frames.content.customers.href()}
            target="dashboard"
          >
            Customers
          </NavLink>
          <NavLink
            href={routes.dashboard.pages.sales.href()}
            src={routes.dashboard.frames.content.sales.href()}
            target="dashboard"
          >
            Sales
          </NavLink>
        </div>
        <section
          style={{
            border: '1px solid rgba(255,255,255,0.14)',
            borderRadius: 12,
            background: 'rgba(255,255,255,0.03)',
            padding: 12,
          }}
        >
          <Frame src={frameHref} name="dashboard" />
        </section>
      </div>
    )
  }
}

function DashboardActivity() {
  return () => (
    <div>
      <h3 style={{ marginTop: 0, marginBottom: 8 }}>Activity</h3>
      <p style={{ marginBottom: 0, color: '#b4c3ff' }}>
        Overview metrics load in this nested frame.
      </p>
    </div>
  )
}

function DashboardCustomers() {
  return () => (
    <div>
      <h3 style={{ marginTop: 0, marginBottom: 8 }}>Customers</h3>
      <ul style={{ margin: 0, paddingLeft: 18 }}>
        <li>Acme Corp</li>
        <li>Globex</li>
        <li>Initech</li>
      </ul>
    </div>
  )
}

function DashboardSales() {
  return () => (
    <div>
      <h3 style={{ marginTop: 0, marginBottom: 8 }}>Sales</h3>
      <p style={{ marginBottom: 0, color: '#b4c3ff' }}>
        Sales data route demonstrates nested frame targeting with history permalinks.
      </p>
    </div>
  )
}

function htmlResponse(stream: ReadableStream<Uint8Array>): Response {
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}

function renderRootPage(context: any, frameHref: string, title: string): Response {
  let Root = createRoot(frameHref, title)
  let stream = renderToStream(<Root />, {
    resolveFrame: (src: string) => resolveFrameViaRouter(context.request, src),
    onError: console.error,
  })
  return htmlResponse(stream)
}

async function resolveFrameViaRouter(request: Request, src: string) {
  let url = new URL(src, request.url)

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

  if (res.body) return res.body
  return await res.text()
}
