import { createRouter } from '@remix-run/fetch-router'

import { routes } from './routes.ts'
import { pagesController } from './pages.ts'

export let router = createRouter()

router.map(routes, pagesController)
