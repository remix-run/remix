import { createController } from 'remix/router'
import { Renderer } from 'remix/middleware/render'

import { assetServer } from '../assets.ts'
import { routes } from '../routes.ts'
import { HomePage } from '../ui/scaffold-home-page.tsx'

export default createController(routes, {
  actions: {
    async assets(context) {
      return (
        (await assetServer.fetch(context.request)) ?? new Response('Not Found', { status: 404 })
      )
    },
    home(context) {
      let render = context.get(Renderer)
      return render(<HomePage />)
    },
  },
})
