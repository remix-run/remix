import * as path from 'node:path'

import { asyncContext } from 'remix/middleware/async-context'
import { compression } from 'remix/middleware/compression'
import { logger } from 'remix/middleware/logger'
import { render } from 'remix/middleware/render'
import { staticFiles } from 'remix/middleware/static'
import { createRouter as createRemixRouter, type MiddlewareContext } from 'remix/router'

import { createApiController } from './actions/api/controller.tsx'
import { createRootController } from './actions/controller.tsx'
import {
  createDocsContextLoader,
  getDefaultVersions,
  type DocsContext,
  type Versions,
} from './data/docs.ts'
import { loadAssetEntry } from './middleware/asset-entry.ts'
import { getVersionPathname, routes } from './routes.ts'
import type { DocsAssetServer } from './assets.ts'

export { getDefaultVersions } from './data/docs.ts'

export type AppContext = MiddlewareContext<
  [ReturnType<typeof loadAssetEntry>, ReturnType<typeof render>]
>

declare module 'remix/router' {
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
  versions: Versions
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
  let getDocsContext = createDocsContextLoader(options.assetServer, options.docsContext)

  let rootControllerOptions = {
    assetServer: options.assetServer,
    getDocsContext,
    ...(options.pagefindAssetsDir ? { pagefindAssetsDir: options.pagefindAssetsDir } : {}),
    versions: options.versions,
  }
  router.map(routes, createRootController(rootControllerOptions))
  router.map(routes.api, createApiController(rootControllerOptions))

  for (let activeVersion of new Set(options.versions)) {
    let versionPathname = getVersionPathname(activeVersion)
    let versionControllerOptions = { ...rootControllerOptions, activeVersion }
    let versionRootController = createRootController(versionControllerOptions)
    let versionApiController = createApiController(versionControllerOptions)

    // A mounted route builder does not match its own root path, so map the
    // versioned home action on the parent router. Wrap the route-specific action so TypeScript 7
    // can infer context for dynamic version paths.
    let homeAction = versionRootController.actions.home
    router.map(`${versionPathname}/`, (context) =>
      typeof homeAction === 'function' ? homeAction(context) : homeAction.handler(context),
    )
    router.mount(versionPathname, (versionRouter) => {
      versionRouter.map(routes.assets, versionRootController.actions.assets)
      versionRouter.map(routes.lookup, versionRootController.actions.lookup)
      versionRouter.map(routes.api, versionApiController)
    })
  }

  return router
}
