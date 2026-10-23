import { createRouter } from 'remix/router'
import { logger } from 'remix/middleware/logger'
import { staticFiles } from 'remix/middleware/static'

import demosController from '../app/demo-runner/controller.tsx'
import { routes } from './routes.ts'

export const router = createRouter({
  middleware: [
    ...(process.env.NODE_ENV === 'development' ? [logger()] : []),
    staticFiles('./public', {
      cacheControl: 'no-store',
      etag: false,
      index: false,
      lastModified: false,
    }),
  ],
})

router.map(routes.demos, demosController)
