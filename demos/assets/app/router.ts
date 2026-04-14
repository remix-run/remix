import { createRouter } from 'remix/fetch-router'

import { homeController } from './controllers/home/controller.ts'
import { routes } from './routes.ts'
import { assetServer } from './utils/assets.ts'

export const router = createRouter()

router.map(routes.home, homeController)

router.get(routes.assets, async ({ request }) => {
  return (await assetServer.fetch(request)) ?? new Response('Not found', { status: 404 })
})
