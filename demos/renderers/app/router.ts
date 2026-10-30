import { logger } from 'remix/middleware/logger'
import { staticFiles } from 'remix/middleware/static'
import { createMiddleware, createRouter, type MiddlewareContext } from 'remix/router'

import rootController from './actions/controller.ts'
import { preactController } from './actions/preact/controller.tsx'
import { reactController } from './actions/react/controller.tsx'
import { loadDatabase } from './middleware/database.ts'
import { routes } from './routes.ts'

const appMiddleware = createMiddleware(loadDatabase())
type AppContext = MiddlewareContext<typeof appMiddleware>

declare module 'remix/router' {
  interface RouterTypes {
    context: AppContext
  }
}

const middleware = []

if (process.env.NODE_ENV === 'development') {
  middleware.push(logger())
}

middleware.push(staticFiles('./public'))
middleware.push(...appMiddleware)

export const router = createRouter<AppContext>({ middleware })

router.map(routes, rootController)
router.map(routes.preact, preactController)
router.map(routes.react, reactController)
