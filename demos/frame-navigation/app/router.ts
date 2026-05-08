import { createRouter, type MiddlewareContext } from 'remix/fetch-router'
import { asyncContext } from 'remix/async-context-middleware'
import { logger } from 'remix/logger-middleware'
import { staticFiles } from 'remix/static-middleware'

import authController from './actions/auth/controller.tsx'
import authLoginController from './actions/auth/login/controller.tsx'
import mainController from './actions/main/controller.tsx'
import settingsController from './actions/settings/controller.tsx'
import { loadAuth } from './middleware/auth.ts'
import { render } from './middleware/render.tsx'
import { routes } from './routes.ts'

type AppContext = MiddlewareContext<[typeof loadAuth, typeof render]>

declare module 'remix/fetch-router' {
  interface RouterTypes {
    context: AppContext
  }
}

const middleware = []

if (process.env.NODE_ENV === 'development') {
  middleware.push(logger())
}

middleware.push(
  staticFiles('./public', {
    cacheControl: 'no-store',
    etag: false,
    lastModified: false,
    index: false,
  }),
)
middleware.push(asyncContext())
middleware.push(loadAuth())
middleware.push(render())

export const router = createRouter<AppContext>({ middleware })

router.map(routes.main, mainController)
router.map(routes.auth, authController)
router.map(routes.auth.login, authLoginController)
router.map(routes.settings, settingsController)
