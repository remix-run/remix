import { createRouter, type MiddlewareContext } from 'remix/router'

import rootController from './actions/controller.ts'
import { render } from './middleware/render.ts'
import { routes } from './routes.ts'

type AppContext = MiddlewareContext<[ReturnType<typeof render>]>

declare module 'remix/router' {
  interface RouterTypes {
    context: AppContext
  }
}

export const router = createRouter<AppContext>({ middleware: [render()] })

router.map(routes, rootController)
