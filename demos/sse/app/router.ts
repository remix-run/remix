import { createRouter, type RouterContext } from 'remix/router'
import { asyncContext } from 'remix/middleware/async-context'
import { compression } from 'remix/middleware/compression'
import { logger } from 'remix/middleware/logger'
import { render } from 'remix/middleware/render'
import { staticFiles } from 'remix/middleware/static'

import rootController from './actions/controller.tsx'
import { loadAssetEntry } from './middleware/asset-entry.ts'
import { routes } from './routes.ts'
import { assets } from './utils/assets.ts'

export const router = createRouter({
  middleware: [
    ...(process.env.NODE_ENV === 'development' ? [logger()] : []),
    compression(),
    staticFiles('./public', {
      cacheControl: 'no-store',
      etag: false,
      lastModified: false,
    }),
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
