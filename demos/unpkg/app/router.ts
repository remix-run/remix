import { createMiddleware, createRouter, type MiddlewareContext } from 'remix/router'

import rootController from './actions/controller.ts'
import { render } from './middleware/render.ts'
import { routes } from './routes.ts'

const middleware = createMiddleware(render())
type AppContext = MiddlewareContext<typeof middleware>

declare module 'remix/router' {
  interface RouterTypes {
    context: AppContext
  }
}

export const router = createRouter({ middleware })

router.map(routes, rootController)
