import { createController } from 'remix/router'

import { routes } from '../routes.ts'
import { assetServer } from '../utils/assets.ts'

export default createController(routes, {
  actions: {
    async assets({ request }) {
      return (await assetServer.fetch(request)) ?? new Response('Not Found', { status: 404 })
    },
  },
})
