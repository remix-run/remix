import type { Controller } from 'remix/fetch-router'

import type { routes } from '../routes.ts'
import { assetServer } from '../utils/assets.ts'
import { homeController } from './home/controller.ts'

export default {
  actions: {
    home: homeController,
    async assets({ request }) {
      let assetResponse = await assetServer.fetch(request)
      return assetResponse ?? new Response('Not found', { status: 404 })
    },
  },
} satisfies Controller<typeof routes>
