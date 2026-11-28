import { createRouter, type RouterContext } from 'remix/router'
import { asyncContext } from 'remix/middleware/async-context'
import { logger } from 'remix/middleware/logger'
import { render } from 'remix/middleware/render'

import rootController from './actions/controller.tsx'
import { loadAssetEntry } from './middleware/asset-entry.ts'
import { routes } from './routes.ts'
import { assets } from './utils/assets.ts'

export const router = createRouter({
  middleware: [
    ...(process.env.NODE_ENV === 'development' ? [logger()] : []),
    asyncContext(),
    loadAssetEntry(),
    render({ assets }),
  ],
})

type AppContext = RouterContext<typeof router>

declare module 'remix' {
  interface RouterTypes {
    context: AppContext
  }
}

router.map(routes, rootController)
