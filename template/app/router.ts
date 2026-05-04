import { createRouter } from 'remix/fetch-router'
import { staticFiles } from 'remix/static-middleware'

import controller from './actions/controller.tsx'
import { routes } from './routes.ts'

export const router = createRouter({
  middleware: [staticFiles('./public', { index: false })],
})

router.map(routes, controller)
