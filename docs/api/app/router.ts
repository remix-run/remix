import * as path from 'node:path'

import { asyncContext } from 'remix/middleware/async-context'
import { compression } from 'remix/middleware/compression'
import { logger } from 'remix/middleware/logger'
import { render } from 'remix/middleware/render'
import { staticFiles } from 'remix/middleware/static'
import { createRouter as createRemixRouter, type MiddlewareContext } from 'remix/router'

import { createApiController } from './actions/api/controller.tsx'
import { createRootController } from './actions/controller.tsx'
import { createDocsContextLoader, type DocsContext } from './data/docs.ts'
import { loadAssetEntry } from './middleware/asset-entry.ts'
import { routes } from './routes.ts'
import type { DocsAssetServer } from './assets.ts'

export type AppContext = MiddlewareContext<
  [ReturnType<typeof loadAssetEntry>, ReturnType<typeof render>]
>

declare module 'remix' {
  interface RouterTypes {
    context: AppContext
  }
}

const apiDir = path.resolve(import.meta.dirname, '..')
const publicDir = path.join(apiDir, 'public')
const sharedAssetsDir = path.join(apiDir, '..', 'shared', 'assets')

export interface ApiRouterOptions {
  assetServer: DocsAssetServer
  docsContext?: DocsContext
  pagefindAssetsDir?: string
}

export function createApiRouter(options: ApiRouterOptions) {
  let middleware = []
  if (process.env.NODE_ENV === 'development') {
    middleware.push(logger())
  }
  middleware.push(compression())
  middleware.push(staticFiles(publicDir, { index: false }))
  middleware.push(staticFiles(sharedAssetsDir, { index: false }))
  middleware.push(asyncContext())
  middleware.push(loadAssetEntry(options.assetServer))
  middleware.push(render({ assets: options.assetServer }))

  let router = createRemixRouter<AppContext>({ middleware })
  let getDocsContext = createDocsContextLoader(options.docsContext)

  let rootControllerOptions = {
    assetServer: options.assetServer,
    getDocsContext,
    ...(options.pagefindAssetsDir ? { pagefindAssetsDir: options.pagefindAssetsDir } : {}),
  }
  router.map(routes, createRootController(rootControllerOptions))
  router.map(routes.api, createApiController(rootControllerOptions))

  return router
}
