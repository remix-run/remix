import { createRouter } from 'remix/fetch-router'

import { homeController } from './controllers/home/controller.ts'
import { packageBrowserController } from './controllers/package-browser/controller.ts'
import { routes } from './routes.ts'

export let router = createRouter()

router.map(routes.home, homeController)
router.map(routes.packageBrowser, packageBrowserController)
