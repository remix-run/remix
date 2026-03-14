import { createRouter } from 'remix/fetch-router'
import { logger } from 'remix/logger-middleware'

import explorerController from '../app/explorer/controller.tsx'
import { routes } from './routes.ts'

let middleware = []

if (process.env.NODE_ENV === 'development') {
  middleware.push(logger())
}

export let router = createRouter({ middleware })

router.map(routes.explorer, explorerController)
