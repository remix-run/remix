import { createController } from 'remix/router'
import { redirect } from 'remix/response/redirect'

import { routes } from '../routes.ts'
import { assetServer } from '../assets.ts'

export default createController(routes, {
  actions: {
    home() {
      return redirect(routes.schema.index.href())
    },
    async assets({ request }) {
      return (await assetServer.fetch(request)) ?? new Response('Not Found', { status: 404 })
    },
  },
})
