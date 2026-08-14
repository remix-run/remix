import {
  createContextKey,
  createController,
  createMiddleware,
  createRouter,
  type Middleware,
  type MiddlewareContext,
} from 'remix/router'
import { get, route } from 'remix/routes'
import { html } from 'remix/html-template'
import { createHtmlResponse } from 'remix/response/html'

const ExecutionTrace = createContextKey<string[]>()

function initializeExecutionTrace(): Middleware {
  return (context, next) => {
    context.set(ExecutionTrace, ['router middleware'])
    return next()
  }
}

function traceMiddleware(name: string): Middleware {
  return (context, next) => {
    let trace = context.get(ExecutionTrace)
    if (!trace) throw new Error('Execution trace middleware did not run')

    trace.push(`${name} middleware`)
    return next()
  }
}

const rootRoutes = route({
  index: get('/'),
})

const routes = route({
  index: get('/'),
  child: route('child', {
    index: get('/'),
    grandchild: route('grandchild', {
      index: get('/'),
    }),
  }),
})

const parentPath = '/parent'
const childPath = `${parentPath}${routes.child.index.href()}`
const grandchildPath = `${parentPath}${routes.child.grandchild.index.href()}`

type RouteName = 'home' | 'parent' | 'child' | 'grandchild'

const routeTitles = {
  home: 'Home',
  parent: 'Parent',
  child: 'Child',
  grandchild: 'Grandchild',
} satisfies Record<RouteName, string>

function navigationLink(routeName: RouteName, href: string, currentRoute: RouteName) {
  let title = routeTitles[routeName]

  return routeName === currentRoute
    ? html`<a href="${href}" aria-current="page">${title}</a>`
    : html`<a href="${href}">${title}</a>`
}

function traceResponse(routeName: RouteName, trace: string[] | undefined): Response {
  if (!trace) throw new Error('Execution trace middleware did not run')

  trace.push(`${routeName} action`)

  let title = routeTitles[routeName]

  return createHtmlResponse(html`
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${title} middleware trace</title>
        <style>
          :root {
            color-scheme: light dark;
            font-family: system-ui, sans-serif;
          }

          body {
            margin: 0;
          }

          header {
            border-bottom: 1px solid canvastext;
          }

          nav,
          main {
            box-sizing: border-box;
            margin: 0 auto;
            max-width: 48rem;
            padding: 1rem;
          }

          nav {
            display: flex;
            flex-wrap: wrap;
            gap: 0.5rem 1.5rem;
          }

          nav a {
            color: inherit;
          }

          nav a[aria-current='page'] {
            font-weight: 700;
            text-decoration-thickness: 0.2rem;
            text-underline-offset: 0.25rem;
          }

          ol {
            line-height: 1.75;
            padding-left: 1.5rem;
          }
        </style>
      </head>
      <body>
        <header>
          <nav aria-label="Demo routes">
            ${navigationLink('home', rootRoutes.index.href(), routeName)}
            ${navigationLink('parent', parentPath, routeName)}
            ${navigationLink('child', childPath, routeName)}
            ${navigationLink('grandchild', grandchildPath, routeName)}
          </nav>
        </header>
        <main>
          <h1>${title} route</h1>
          <p>Middleware execution trace:</p>
          <ol>
            ${trace.map((entry) => html`<li><code>${entry}</code></li>`)}
          </ol>
        </main>
      </body>
    </html>
  `)
}

const rootController = createController(rootRoutes, {
  middleware: [traceMiddleware('root controller')],
  actions: {
    index({ get }) {
      return traceResponse('home', get(ExecutionTrace))
    },
  },
})

const parentController = createController(routes, {
  middleware: [traceMiddleware('parent controller')],
  actions: {
    index({ get }) {
      return traceResponse('parent', get(ExecutionTrace))
    },
  },
})

const childController = createController(routes.child, {
  middleware: [traceMiddleware('child controller')],
  actions: {
    index({ get }) {
      return traceResponse('child', get(ExecutionTrace))
    },
  },
})

const grandchildController = createController(routes.child.grandchild, {
  middleware: [traceMiddleware('grandchild controller')],
  actions: {
    index({ get }) {
      return traceResponse('grandchild', get(ExecutionTrace))
    },
  },
})

const routerMiddleware = createMiddleware(initializeExecutionTrace())
type AppContext = MiddlewareContext<typeof routerMiddleware>

declare module 'remix/router' {
  interface RouterTypes {
    context: AppContext
  }
}

export const router = createRouter<AppContext>({ middleware: routerMiddleware })

router.map(rootRoutes, rootController)

router.mount(parentPath, { middleware: [traceMiddleware('parent mount')] }, (parent) => {
  parent.map(routes, parentController)
  parent.map(routes.child, childController)
  parent.map(routes.child.grandchild, grandchildController)
})
