import * as path from 'node:path'
import { asyncContext } from 'remix/middleware/async-context'
import { compression } from 'remix/middleware/compression'
import { render } from 'remix/middleware/render'
import { staticFiles } from 'remix/middleware/static'
import { createRouter } from 'remix/router'
import type { MiddlewareContext } from 'remix/router'

import { createRootController } from './actions/controller.tsx'
import docsController from './actions/docs/controller.tsx'
import { assetServer } from './assets.ts'
import { routes } from './routes.ts'

export type AppContext = MiddlewareContext<[ReturnType<typeof render>]>

declare module 'remix' {
  interface RouterTypes {
    context: AppContext
  }
}

export function createUiRouter(options: { pagefindAssetsDir?: string } = {}) {
  let router = createRouter<AppContext>({
    middleware: [
      compression(),
      staticFiles(path.resolve(import.meta.dirname, '../../shared/assets'), { index: false }),
      asyncContext(),
      render({ assets: assetServer }),
    ],
  })
  router.map(routes, createRootController(options.pagefindAssetsDir))
  router.map(routes.docs, docsController)
  return router
}

export const router = createUiRouter()
