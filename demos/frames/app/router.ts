import { createRouter, type MiddlewareContext } from 'remix/fetch-router'
import { logger } from 'remix/logger-middleware'
import { staticFiles } from 'remix/static-middleware'

import rootController from './actions/controller.tsx'
import { framesController } from './actions/frames/controller.tsx'
import { render } from './middleware/render.ts'
import { routes } from './routes.ts'

type AppContext = MiddlewareContext<[typeof render]>

declare module 'remix/fetch-router' {
  interface RouterTypes {
    context: AppContext
  }
}

const middleware = []

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
middleware.push(render())

export const router = createRouter<AppContext>({ middleware })
router.map(routes, rootController)
router.map(routes.frames, framesController)
