import { createMiddleware, createRouter, type MiddlewareContext } from 'remix/router'
import { asyncContext } from 'remix/middleware/async-context'
import { logger } from 'remix/middleware/logger'
import { staticFiles } from 'remix/middleware/static'

import rootController from './actions/controller.tsx'
import { framesController } from './actions/frames/controller.tsx'
import { loadAssetEntry } from './middleware/asset-entry.ts'
import { render } from './middleware/render.ts'
import { routes } from './routes.ts'

const appMiddleware = createMiddleware(asyncContext(), loadAssetEntry(), render())
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

middleware.push(
  staticFiles('./public', {
    cacheControl: 'no-store',
    etag: false,
    lastModified: false,
    index: false,
  }),
)
middleware.push(...appMiddleware)

export const router = createRouter<AppContext>({ middleware })
router.map(routes, rootController)
router.map(routes.frames, framesController)
