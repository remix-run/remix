import { createRouter, type MiddlewareContext } from 'remix/router'
import { compression } from 'remix/middleware/compression'
import { logger } from 'remix/middleware/logger'
import { staticFiles } from 'remix/middleware/static'

import rootController from './actions/controller.tsx'
import { render } from './middleware/render.ts'
import { routes } from './routes.ts'

type AppContext = MiddlewareContext<[ReturnType<typeof render>]>

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
middleware.push(render())

export const router = createRouter<AppContext>({ middleware })

router.map(routes, rootController)
