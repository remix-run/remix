import { createRouter } from 'remix/fetch-router'

import { homeController } from './controllers/home/controller.ts'
import { routes } from './routes.ts'
import { scriptServer } from './utils/script-server.ts'

export const router = createRouter()

router.map(routes.home, homeController)

router.get(routes.scripts, async ({ request, params }) => {
  if (!params.path) return new Response('Not found', { status: 404 })
  let script = await scriptServer.fetch(request)
  return script ?? new Response('Not found', { status: 404 })
})
