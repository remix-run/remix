import {
  createRouter,
  type AnyParams,
  type MiddlewareContext,
  type WithParams,
} from 'remix/fetch-router'
import { asyncContext } from 'remix/async-context-middleware'
import { compression } from 'remix/compression-middleware'
import { formData } from 'remix/form-data-middleware'
import type { Cookie } from 'remix/cookie'
import { logger } from 'remix/logger-middleware'
import { methodOverride } from 'remix/method-override-middleware'
import type { SessionStorage } from 'remix/session'
import { session } from 'remix/session-middleware'
import { staticFiles } from 'remix/static-middleware'

import accountController from './controllers/account/controller.tsx'
import adminController from './controllers/admin/controller.tsx'
import authController from './controllers/auth/controller.tsx'
import booksController from './controllers/books/controller.tsx'
import cartController, { toggleCart } from './controllers/cart/controller.tsx'
import fragmentsController from './controllers/cart/fragments/controller.tsx'
import checkoutController from './controllers/checkout/controller.tsx'
import * as storefrontController from './controllers/storefront/controller.tsx'
import { uploadsAction } from './controllers/uploads/controller.tsx'
import { initializeBookstoreDatabase } from './data/setup.ts'
import { scriptServer } from './utils/scripts.ts'
import { loadAuth } from './middleware/auth.ts'
import { loadDatabase } from './middleware/database.ts'
import { loadScriptEntry } from './middleware/script-entry.ts'
import { sessionCookie, sessionStorage } from './middleware/session.ts'
import { uploadHandler } from './middleware/uploads.ts'
import { routes } from './routes.ts'

await initializeBookstoreDatabase()

export type RootMiddleware = [
  ReturnType<typeof formData>,
  ReturnType<typeof session>,
  ReturnType<typeof loadDatabase>,
  ReturnType<typeof loadAuth>,
]

export type AppContext<params extends AnyParams = AnyParams> = WithParams<
  MiddlewareContext<RootMiddleware>,
  params
>

export interface BookstoreRouterOptions {
  sessionCookie?: Cookie
  sessionStorage?: SessionStorage
}

export function createBookstoreRouter(options?: BookstoreRouterOptions) {
  let cookie = options?.sessionCookie ?? sessionCookie
  let storage = options?.sessionStorage ?? sessionStorage
  let middleware = []

  if (process.env.NODE_ENV === 'development') {
    middleware.push(logger())
  }

  middleware.push(compression())
  middleware.push(
    staticFiles('./public', {
      cacheControl: 'no-store, must-revalidate',
      etag: false,
      lastModified: false,
    }),
  )
  middleware.push(formData({ uploadHandler }))
  middleware.push(methodOverride())
  middleware.push(session(cookie, storage))
  middleware.push(asyncContext())
  middleware.push(loadDatabase())
  middleware.push(loadScriptEntry())
  middleware.push(loadAuth())

  let router = createRouter({ middleware })

  router.get(routes.scripts, async ({ request, params }) => {
    if (!params.path) return new Response('Not found', { status: 404 })
    let script = await scriptServer.fetch(request)
    return script ?? new Response('Not found', { status: 404 })
  })

  router.get(routes.uploads, uploadsAction)
  router.map(routes.fragments, fragmentsController)
  router.post(routes.api.cartToggle, toggleCart)

  router.map(routes.home, storefrontController.home)
  router.map(routes.about, storefrontController.about)
  router.map(routes.contact, storefrontController.contact)
  router.map(routes.search, storefrontController.search)

  router.map(routes.books, booksController)
  router.map(routes.auth, authController)
  router.map(routes.cart, cartController)
  router.map(routes.account, accountController)
  router.map(routes.checkout, checkoutController)
  router.map(routes.admin, adminController)

  return router
}
