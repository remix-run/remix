import { createRouter } from 'remix/fetch-router'
import { logger } from 'remix/logger-middleware'
import { staticFiles } from 'remix/static-middleware'

import examplesController from '../app/examples/controller.tsx'
import explorerController from '../app/explorer/controller.tsx'
import { routes } from './routes.ts'

let middleware = []

if (process.env.NODE_ENV === 'development') {
  middleware.push(logger())
}

middleware.push(
  staticFiles('./public', {
    cacheControl: 'no-store',
    etag: false,
    index: false,
    lastModified: false,
  }),
)

export let router = createRouter({ middleware })

router.map(routes.examples, examplesController)
router.map(routes.explorer, explorerController)
