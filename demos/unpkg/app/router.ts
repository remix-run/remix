import { createRouter } from '@remix-run/fetch-router'

import { routes } from './routes.ts'
import { homeHandler } from './pages/home.ts'
import { browseHandler } from './pages/browse.ts'

export let router = createRouter()

router.get(routes.home, homeHandler)
router.get(routes.browse, browseHandler)
