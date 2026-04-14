import { createRouter } from 'remix/fetch-router'
import { logger } from 'remix/logger-middleware'
import { staticFiles } from 'remix/static-middleware'

import apiController from '../app/api/controller.ts'
import examplesController from '../app/examples/controller.tsx'
import explorerController from '../app/explorer/controller.tsx'
import themeBuilderController from '../app/theme-builder-controller.tsx'
import { routes } from './routes.ts'

const middleware = []

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

export const router = createRouter({ middleware })

router.map(routes.api, apiController)
router.map(routes.examples, examplesController)
router.map(routes.themeBuilder, themeBuilderController)
router.map(routes.explorer, explorerController)
