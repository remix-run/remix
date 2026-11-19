import { createRouter } from 'remix/router'
import { staticFiles } from 'remix/middleware/static'

import rootController from './actions/controller.ts'
import { routes } from './routes.ts'

export const router = createRouter({
  middleware: [
    staticFiles('./public', {
      cacheControl: 'no-store',
      etag: false,
      lastModified: false,
      index: false,
    }),
  ],
})

router.map(routes, rootController)
