import {
  createContextKey,
  createController,
  createMiddleware,
  createRouter,
  type Middleware,
  type MiddlewareContext,
} from 'remix/router'
import { get, route } from 'remix/routes'

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

function traceResponse(routeName: string, trace: string[] | undefined): Response {
  if (!trace) throw new Error('Execution trace middleware did not run')

  trace.push(`${routeName} action`)
  return Response.json({ route: routeName, trace })
}

const routes = route({
  index: get('/'),
  child: route('child', {
    index: get('/'),
    grandchild: route('grandchild', {
      index: get('/'),
    }),
  }),
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

router.mount('/parent', { middleware: [traceMiddleware('parent mount')] }, (parent) => {
  parent.map(routes, parentController)
  parent.map(routes.child, childController)
  parent.map(routes.child.grandchild, grandchildController)
})
