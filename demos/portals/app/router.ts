import { asyncContext } from 'remix/middleware/async-context'
import { logger } from 'remix/middleware/logger'
import { render } from 'remix/middleware/render'
import { createRouter, type RouterContext } from 'remix/router'

import controller from './actions/controller.tsx'
import { routes } from './routes.ts'
import { assets } from './utils/assets.ts'

export const router = createRouter({
  middleware: [
    ...(process.env.NODE_ENV === 'development' ? [logger()] : []),
    asyncContext(),
    render({ assets }),
  ],
})

type AppContext = RouterContext<typeof router>

declare module 'remix' {
  interface RouterTypes {
    context: AppContext
  }
}

router.map(routes, controller)
