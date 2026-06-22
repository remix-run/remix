import { createRouter } from 'remix/router'
import { staticFiles } from 'remix/middleware/static'

import { assetServer } from './assets.ts'
import { docsController } from './controllers/docs/controller.tsx'
import { docsExamplesController } from './controllers/docs/examples/controller.ts'
import { devRefreshHandler } from './dev-refresh.ts'
import { render, type AppContext } from './middleware/render.ts'
import { routes } from './routes.ts'

declare module 'remix/router' {
  interface RouterTypes {
    context: AppContext
  }
}

export const router = createRouter<AppContext>({
  middleware: [staticFiles('./public', { index: false }), render()],
})

router.map(
  routes.assets,
  async ({ request }) =>
    (await assetServer.fetch(request)) ?? new Response('Not Found', { status: 404 }),
)

if (process.env.NODE_ENV !== 'production') {
  router.map(routes.devRefresh, devRefreshHandler)
}

// This app is just the docs, so send the root straight to the docs index.
router.map(
  routes.home,
  () => new Response(null, { status: 302, headers: { Location: routes.docs.index.href() } }),
)

router.map(routes.docs, docsController)
router.map(routes.docs.examples, docsExamplesController)
