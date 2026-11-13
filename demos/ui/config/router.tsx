import { createRouter } from 'remix/router'
import { logger } from 'remix/middleware/logger'
import { staticFiles } from 'remix/middleware/static'

import demosController from '../app/demo-runner/controller.tsx'
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

router.map(routes.demos, demosController)
