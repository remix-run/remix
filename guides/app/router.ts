import * as path from 'node:path'

import { asyncContext } from 'remix/middleware/async-context'
import { compression } from 'remix/middleware/compression'
import { logger } from 'remix/middleware/logger'
import { staticFiles } from 'remix/middleware/static'
import { createRouter, type MiddlewareContext } from 'remix/router'

import rootController from './actions/controller.tsx'
import docsController from './actions/docs/controller.tsx'
import docsExamplesController from './actions/docs/examples/controller.ts'
import { loadAssetEntry } from './middleware/asset-entry.ts'
import { render } from './middleware/render.ts'
import { routes } from './routes.ts'

export type AppContext = MiddlewareContext<
  [ReturnType<typeof loadAssetEntry>, ReturnType<typeof render>]
>

declare module 'remix/router' {
  interface RouterTypes {
    context: AppContext
  }
}

const publicDir = path.resolve(import.meta.dirname, '../public')

export function createGuidesRouter() {
  let router = createRouter<AppContext>({
    middleware: [
      ...(process.env.NODE_ENV === 'development' ? [logger()] : []),
      compression(),
      staticFiles(publicDir, { index: false }),
      asyncContext(),
      loadAssetEntry(),
      render(),
    ],
  })

  router.map(routes, rootController)
  router.map(routes.docs, docsController)
  router.map(routes.docs.examples, docsExamplesController)

  return router
}

export const router = createGuidesRouter()
