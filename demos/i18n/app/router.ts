import { formData } from 'remix/middleware/form-data'
import { render } from 'remix/middleware/render'
import { staticFiles } from 'remix/middleware/static'
import { createMiddleware, createRouter, type MiddlewareContext } from 'remix/router'

import { rootController } from './actions/controller.tsx'
import { assetServer } from './assets.ts'
import { assetsRoute, routes } from './routes.ts'

const appMiddleware = createMiddleware(
  staticFiles('./public', {
    cacheControl: 'no-store',
    etag: false,
    lastModified: false,
  }),
  formData(),
  render({ assets: assetServer }),
)

type AppContext = MiddlewareContext<typeof appMiddleware>

declare module 'remix/router' {
  interface RouterTypes {
    context: AppContext
  }
}

export function createAppRouter() {
  let router = createRouter<AppContext>({ middleware: appMiddleware })

  router.get(
    assetsRoute,
    async ({ request }) =>
      (await assetServer.fetch(request)) ?? new Response('Not Found', { status: 404 }),
  )
  router.map(routes, rootController)

  return router
}

export const router = createAppRouter()
