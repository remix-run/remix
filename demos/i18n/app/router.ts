import { formData } from 'remix/middleware/form-data'
import { render } from 'remix/middleware/render'
import { staticFiles } from 'remix/middleware/static'
import { createRouter, type RouterContext } from 'remix/router'

import { rootController } from './actions/controller.tsx'
import { assetServer } from './assets.ts'
import { assetsRoute, routes } from './routes.ts'

export function createAppRouter() {
  let router = createRouter({
    middleware: [
      staticFiles('./public', {
        cacheControl: 'no-store',
        etag: false,
        lastModified: false,
      }),
      formData(),
      render({ assets: assetServer }),
    ],
  })

  router.get(
    assetsRoute,
    async ({ request }) =>
      (await assetServer.fetch(request)) ?? new Response('Not Found', { status: 404 }),
  )
  router.map(routes, rootController)

  return router
}

export const router = createAppRouter()

type AppContext = RouterContext<typeof router>

declare module 'remix' {
  interface RouterTypes {
    context: AppContext
  }
}
