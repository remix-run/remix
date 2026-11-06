import { createHtmlResponse } from 'remix/response/html'
import { createController } from 'remix/router'

import { routes } from '../routes.ts'
import { assets } from '../utils/assets.ts'
import { HomePage } from './home-page.ts'

export default createController(routes, {
  actions: {
    async assets({ request }) {
      let assetResponse = await assets.fetch(request)
      return assetResponse ?? new Response('Not Found', { status: 404 })
    },

    home() {
      return createHtmlResponse(HomePage())
    },
  },
})
