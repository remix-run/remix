import { createRouter, type MiddlewareContext } from 'remix/router'
import { staticFiles } from 'remix/middleware/static'

import controller from './actions/controller.tsx'
import { render } from './middleware/render.tsx'
import { routes } from './routes.ts'

type AppContext = MiddlewareContext<[ReturnType<typeof render>]>

declare module 'remix/router' {
  interface RouterTypes {
    context: AppContext
  }
}

export function createAppRouter() {
  let middleware = []

  middleware.push(staticFiles('./public', { index: false }))
  middleware.push(render())

  let router = createRouter<AppContext>({ middleware })

  router.map(routes, controller)

  return router
}

export const router = createAppRouter()
