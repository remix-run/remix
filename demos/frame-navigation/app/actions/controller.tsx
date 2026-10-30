import { createController } from 'remix/router'

import { routes } from '../routes.ts'
import { assets } from '../utils/assets.ts'

export default createController(routes, {
  actions: {
    async assets({ request }) {
      let assetResponse = await assets.fetch(request)
      return assetResponse ?? new Response('Not found', { status: 404 })
    },
  },
})
