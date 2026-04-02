import { lazy } from 'react'
import { mapFrames, useServerMiddleware } from 'react-server-frame/vite/frames'
import { asyncContext } from 'remix/async-context-middleware'
import { createRouter } from 'remix/fetch-router'

import { routes } from './routes.ts'

const Home = lazy(() => import('./frames/home.tsx'))

const router = createRouter({
  middleware: [asyncContext()],
})

mapFrames(router, routes.frames, {
  middleware: [useServerMiddleware()],
  components: {
    home: Home,
  },
})

export default {
  async fetch(request: Request) {
    return router.fetch(new Request(request.url, request))
  },
}
