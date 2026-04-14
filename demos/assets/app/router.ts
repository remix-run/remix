import { createRouter } from 'remix/fetch-router'

import { homeController } from './controllers/home/controller.ts'
import { routes } from './routes.ts'
import { assetServer } from './utils/assets.ts'

export const router = createRouter()

router.map(routes.home, homeController)

router.get(routes.scripts, async ({ request, params }) => {
  if (!params.path) return new Response('Not found', { status: 404 })
  let script = await assetServer.fetch(request)
  return script ?? new Response('Not found', { status: 404 })
})
