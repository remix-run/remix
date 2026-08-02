import { createController } from 'remix/router'

import { routes } from '../routes.ts'
import { assetServer } from '../utils/assets.ts'

export default createController(routes, {
  actions: {
    async assets({ request }) {
      let assetResponse = await assetServer.fetch(request)
      return assetResponse ?? new Response('Not found', { status: 404 })
    },
  },
})
