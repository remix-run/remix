import { createMiddleware, createRouter, type MiddlewareContext } from 'remix/router'
import { compression } from 'remix/middleware/compression'
import { logger } from 'remix/middleware/logger'
import { render } from 'remix/middleware/render'
import { staticFiles } from 'remix/middleware/static'

import rootController from './actions/controller.tsx'
import { routes } from './routes.ts'

const appMiddleware = createMiddleware(render())
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

middleware.push(compression())
middleware.push(
  staticFiles('./public', {
    cacheControl: 'no-store',
    etag: false,
    lastModified: false,
  }),
)
middleware.push(...appMiddleware)

export const router = createRouter<AppContext>({ middleware })

router.map(routes, rootController)
