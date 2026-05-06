import { createRouter } from 'remix/fetch-router'

import rootController from './actions/controller.ts'
import { routes } from './routes.ts'

export const router = createRouter()

router.map(routes, rootController)
