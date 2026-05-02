import { createRouter } from 'remix/fetch-router'

import controller from './actions/controller.tsx'
import { routes } from './routes.ts'

export const router = createRouter()

router.map(routes, controller)
