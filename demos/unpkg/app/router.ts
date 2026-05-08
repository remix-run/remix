import { createRouter, type MiddlewareContext } from 'remix/fetch-router'

import rootController from './actions/controller.ts'
import { render } from './middleware/render.ts'
import { routes } from './routes.ts'

type AppContext = MiddlewareContext<[typeof render]>

declare module 'remix/fetch-router' {
  interface RouterTypes {
    context: AppContext
  }
}

export const router = createRouter<AppContext>({ middleware: [render()] })

router.map(routes, rootController)
