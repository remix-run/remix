import { createRouter, type MiddlewareContext } from 'remix/router'
import { formData } from 'remix/middleware/form-data'
import { logger } from 'remix/middleware/logger'

import rootController from './actions/controller.tsx'
import registrationController from './actions/registration/controller.tsx'
import { createDataModelFormsDatabase } from './data/database.ts'
import { loadAssetEntry } from './middleware/asset-entry.ts'
import { loadDatabase } from './middleware/database.ts'
import { render } from './middleware/render.tsx'
import { routes } from './routes.ts'

type AppContext = MiddlewareContext<
  [
    ReturnType<typeof formData>,
    ReturnType<typeof loadDatabase>,
    ReturnType<typeof loadAssetEntry>,
    ReturnType<typeof render>,
  ]
>

declare module 'remix/router' {
  interface RouterTypes {
    context: AppContext
  }
}

export function createDataModelFormsRouter() {
  let database = createDataModelFormsDatabase()
  let middleware = []

  if (process.env.NODE_ENV === 'development') {
    middleware.push(logger())
  }

  middleware.push(formData(), loadDatabase(database), loadAssetEntry(), render())

  let router = createRouter<AppContext>({ middleware })
  router.map(routes, rootController)
  router.map(routes.registration, registrationController)
  return router
}
