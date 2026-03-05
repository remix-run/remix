import { createRouter } from 'remix/fetch-router'
import { asyncContext } from 'remix/async-context-middleware'
import { logger } from 'remix/logger-middleware'
import { staticFiles } from 'remix/static-middleware'

import mainController from '../app/main/controller.tsx'
import settingsController from '../app/settings/controller.tsx'
import { routes } from './routes.ts'

let middleware = []

if (process.env.NODE_ENV === 'development') {
  middleware.push(logger())
}

middleware.push(
  staticFiles('./public', {
    cacheControl: 'no-store',
    etag: false,
    lastModified: false,
    index: false,
  }),
)
middleware.push(asyncContext())

export let router = createRouter({ middleware })

router.map(routes.main, mainController)
router.map(routes.settings, settingsController)
