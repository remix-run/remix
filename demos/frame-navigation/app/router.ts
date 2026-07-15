import { createMiddleware, createRouter, type MiddlewareContext } from 'remix/router'
import { logger } from 'remix/middleware/logger'
import { staticFiles } from 'remix/middleware/static'

import authController from './actions/auth/controller.tsx'
import authLoginController from './actions/auth/login/controller.tsx'
import mainController from './actions/main/controller.tsx'
import settingsController from './actions/settings/controller.tsx'
import { loadAuth } from './middleware/auth.ts'
import { render } from './middleware/render.tsx'
import { routes } from './routes.ts'

const appMiddleware = createMiddleware(loadAuth(), render())
type AppContext = MiddlewareContext<typeof appMiddleware>

declare module 'remix/router' {
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
middleware.push(...appMiddleware)

export const router = createRouter<AppContext>({ middleware })

router.map(routes.main, mainController)
router.map(routes.auth, authController)
router.map(routes.auth.login, authLoginController)
router.map(routes.settings, settingsController)
