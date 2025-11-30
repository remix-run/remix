import { createRouter } from '@remix-run/fetch-router'
import { compression } from '@remix-run/compression-middleware'
import { logger } from '@remix-run/logger-middleware'
import { staticFiles } from '@remix-run/static-middleware'

import { routes } from './routes.ts'
import { pagesController } from './pages.tsx'

let middleware = []

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

export let router = createRouter({ middleware })

router.map(routes, pagesController)
