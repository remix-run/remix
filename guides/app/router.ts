import * as path from 'node:path'

import { asyncContext } from 'remix/middleware/async-context'
import { compression } from 'remix/middleware/compression'
import { logger } from 'remix/middleware/logger'
import { render } from 'remix/middleware/render'
import { staticFiles } from 'remix/middleware/static'
import { createRouter, type MiddlewareContext } from 'remix/router'

import { createRootController } from './actions/controller.tsx'
import docsController from './actions/docs/controller.tsx'
import docsExamplesController from './actions/docs/examples/controller.tsx'
import { loadAssetEntry } from './middleware/asset-entry.ts'
import { routes } from './routes.ts'
import { assets } from './utils/assets.ts'

export type AppContext = MiddlewareContext<
  [ReturnType<typeof loadAssetEntry>, ReturnType<typeof render>]
>

declare module 'remix/router' {
  interface RouterTypes {
    context: AppContext
  }
}

const publicDir = path.resolve(import.meta.dirname, '../public')

export function createGuidesRouter(options: { pagefindAssetsDir?: string } = {}) {
  let router = createRouter<AppContext>({
    middleware: [
      ...(process.env.NODE_ENV === 'development' ? [logger()] : []),
      compression(),
      staticFiles(publicDir, { index: false }),
      asyncContext(),
      loadAssetEntry(),
      render({ assets }),
    ],
  })

  router.map(routes, createRootController(options.pagefindAssetsDir))
  router.map(routes.docs, docsController)
  router.map(routes.docs.examples, docsExamplesController)

  return router
}

export const router = createGuidesRouter()
