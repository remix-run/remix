import { createMiddleware, createRouter, type MiddlewareContext } from 'remix/router'
import { formData } from 'remix/middleware/form-data'
import { logger } from 'remix/middleware/logger'

import rootController from './actions/controller.tsx'
import registrationController from './actions/registration/controller.tsx'
import { loadAssetEntry } from './middleware/asset-entry.ts'
import { render } from './middleware/render.tsx'
import { routes } from './routes.ts'

const appMiddleware = createMiddleware(formData(), loadAssetEntry(), render())
type AppContext = MiddlewareContext<typeof appMiddleware>

declare module 'remix/router' {
  interface RouterTypes {
    context: AppContext
  }
}

export function createDataModelFormsRouter() {
  let middleware = []

  if (process.env.NODE_ENV === 'development') {
    middleware.push(logger())
  }

  middleware.push(...appMiddleware)

  let router = createRouter<AppContext>({ middleware })
  router.map(routes, rootController)
  router.map(routes.registration, registrationController)
  return router
}
