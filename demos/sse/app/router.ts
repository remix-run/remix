import { createRouter } from 'remix/fetch-router'
import { compression } from 'remix/compression-middleware'
import { logger } from 'remix/logger-middleware'
import { staticFiles } from 'remix/static-middleware'

import rootController from './actions/controller.tsx'
import { routes } from './routes.ts'

const middleware = []

if (process.env.NODE_ENV === 'development') {
  middleware.push(logger())
}

middleware.push(compression())
middleware.push(
  staticFiles('./public', {
    cacheControl: 'no-store',
    etag: false,
    lastModified: false,
  }),
)

export const router = createRouter({ middleware })

router.map(routes, rootController)
