import { createMiddleware, createRouter, type MiddlewareContext } from 'remix/router'
import { asyncContext } from 'remix/middleware/async-context'
import { compression } from 'remix/middleware/compression'
import { logger } from 'remix/middleware/logger'
import { render } from 'remix/middleware/render'
import { staticFiles } from 'remix/middleware/static'

import rootController from './actions/controller.tsx'
import {
  createFramesController,
  type FramesControllerOptions,
} from './actions/frames/controller.tsx'
import { loadAssetEntry } from './middleware/asset-entry.ts'
import { routes } from './routes.ts'
import { assets } from './utils/assets.ts'

const appMiddleware = createMiddleware(asyncContext(), loadAssetEntry(), render({ assets }))
type AppContext = MiddlewareContext<typeof appMiddleware>

declare module 'remix' {
  interface RouterTypes {
    context: AppContext
  }
}

export interface AppRouterOptions {
  frames?: FramesControllerOptions
}

export function createAppRouter(options: AppRouterOptions = {}) {
  let middleware = []

  if (process.env.NODE_ENV === 'development') {
    middleware.push(logger())
  }

  middleware.push(
    compression(),
    staticFiles('./public', {
      cacheControl: 'no-store',
      etag: false,
      lastModified: false,
      index: false,
    }),
  )
  middleware.push(...appMiddleware)

  let router = createRouter<AppContext>({ middleware })
  router.map(routes, rootController)
  router.map(routes.frames, createFramesController(options.frames))
  return router
}

export const router = createAppRouter()
