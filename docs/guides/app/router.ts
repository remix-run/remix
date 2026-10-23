import * as path from 'node:path'

import { asyncContext } from 'remix/middleware/async-context'
import { compression } from 'remix/middleware/compression'
import { logger } from 'remix/middleware/logger'
import { render } from 'remix/middleware/render'
import { staticFiles } from 'remix/middleware/static'
import { createRouter, type RouterContext } from 'remix/router'

import { createRootController } from './actions/controller.tsx'
import docsController from './actions/docs/controller.tsx'
import docsExamplesController from './actions/docs/examples/controller.tsx'
import { assetServer } from './assets.ts'
import { routes } from './routes.ts'

const publicDir = path.resolve(import.meta.dirname, '../public')
const sharedAssetsDir = path.resolve(import.meta.dirname, '../../shared/assets')

export function createGuidesRouter(options: { pagefindAssetsDir?: string } = {}) {
  let router = createRouter({
    middleware: [
      ...(process.env.NODE_ENV === 'development' ? [logger()] : []),
      compression(),
      staticFiles(publicDir, { index: false }),
      staticFiles(sharedAssetsDir, { index: false }),
      asyncContext(),
      render({ assets: assetServer }),
    ],
  })

  router.map(routes, createRootController(options.pagefindAssetsDir))
  router.map(routes.docs, docsController)
  router.map(routes.docs.examples, docsExamplesController)

  return router
}

export const router = createGuidesRouter()

export type AppContext = RouterContext<typeof router>

declare module 'remix' {
  interface RouterTypes {
    context: AppContext
  }
}
