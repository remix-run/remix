import { asyncContext } from 'remix/middleware/async-context'
import { formData } from 'remix/middleware/form-data'
import { logger } from 'remix/middleware/logger'
import { render } from 'remix/middleware/render'
import { session } from 'remix/middleware/session'
import { createRouter, type MiddlewareContext } from 'remix/router'

import cartController from './actions/cart/controller.tsx'
import catalogController from './actions/catalog/controller.tsx'
import rootController from './actions/controller.tsx'
import fragmentsController from './actions/fragments/controller.tsx'
import { loadAssetEntry } from './middleware/asset-entry.ts'
import { conditionalGet } from './middleware/conditional-get.ts'
import { loadDatabase } from './middleware/database.ts'
import { sessionCookie, sessionStorage } from './middleware/session.ts'
import { applySpeedTechniques, loadSpeedSettings } from './middleware/speed-settings.ts'
import { routes } from './routes.ts'
import { assets } from './utils/assets.ts'

type AppContext = MiddlewareContext<
  [
    ReturnType<typeof loadSpeedSettings>,
    ReturnType<typeof formData>,
    ReturnType<typeof session>,
    ReturnType<typeof loadDatabase>,
    ReturnType<typeof loadAssetEntry>,
    ReturnType<typeof render>,
  ]
>

declare module 'remix' {
  interface RouterTypes {
    context: AppContext
  }
}

export function createAppRouter() {
  let middleware = []

  if (process.env.NODE_ENV === 'development') {
    middleware.push(logger())
  }

  middleware.push(
    loadSpeedSettings(),
    applySpeedTechniques(),
    conditionalGet(),
    formData(),
    session(sessionCookie, sessionStorage),
    asyncContext(),
    loadDatabase(),
    loadAssetEntry(),
    render({ assets }),
  )

  let router = createRouter<AppContext>({ middleware })

  router.map(routes, rootController)
  router.map(routes.catalog, catalogController)
  router.map(routes.cart, cartController)
  router.map(routes.fragments, fragmentsController)

  return router
}
