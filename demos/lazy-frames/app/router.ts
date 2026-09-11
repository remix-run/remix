import { asyncContext } from 'remix/middleware/async-context'
import { logger } from 'remix/middleware/logger'
import { render } from 'remix/middleware/render'
import { createMiddleware, createRouter, type MiddlewareContext } from 'remix/router'

import rootController from './actions/controller.tsx'
import { framesController } from './actions/frames/controller.tsx'
import { loadAssetEntry } from './middleware/asset-entry.ts'
import { demoLatency } from './middleware/demo-latency.ts'
import { loadTheme } from './middleware/theme.ts'
import { routes } from './routes.ts'
import { assets } from './utils/assets.ts'

const appMiddleware = createMiddleware(
  asyncContext(),
  loadTheme(),
  demoLatency(),
  loadAssetEntry(),
  render({ assets }),
)
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

middleware.push(...appMiddleware)

export const router = createRouter<AppContext>({ middleware })
router.map(routes, rootController)
router.map(routes.frames, framesController)
