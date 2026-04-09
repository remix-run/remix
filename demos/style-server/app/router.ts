import { createRouter } from 'remix/fetch-router'

import { homeController } from './controllers/home/controller.ts'
import { routes } from './routes.ts'
import { styleServer } from './utils/style-server.ts'

export const router = createRouter()

router.map(routes.home, homeController)

router.get(routes.styles, async ({ request, params }) => {
  if (!params.path) return new Response('Not found', { status: 404 })
  let style = await styleServer.fetch(request)
  return style ?? new Response('Not found', { status: 404 })
})
