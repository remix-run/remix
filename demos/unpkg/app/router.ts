import { createRouter } from 'remix/fetch-router'
import { routes } from './routes.ts'
import { packageBrowserController } from './controllers/package-browser/controller.ts'

export let router = createRouter()

router.map(routes, packageBrowserController)
