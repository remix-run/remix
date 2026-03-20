import { createRouter, type AnyParams, type MiddlewareContext, type WithParams } from 'remix/fetch-router'
import { asyncContext } from 'remix/async-context-middleware'
import { compression } from 'remix/compression-middleware'
import { formData } from 'remix/form-data-middleware'
import type { Cookie } from 'remix/cookie'
import { logger } from 'remix/logger-middleware'
import type { SessionStorage } from 'remix/session'
import { methodOverride } from 'remix/method-override-middleware'
import { session } from 'remix/session-middleware'
import { staticFiles } from 'remix/static-middleware'

import adminController from './admin.tsx'
import accountController from './account.tsx'
import authController from './auth.tsx'
import booksController from './books.tsx'
import cartController, { toggleCart } from './cart.tsx'
import checkoutController from './checkout.tsx'
import { initializeBookstoreDatabase } from './data/setup.ts'
import fragmentsController from './fragments.tsx'
import * as marketingController from './marketing.tsx'
import { loadAuth } from './middleware/auth.ts'
import { loadDatabase } from './middleware/database.ts'
import { routes } from './routes.ts'
import { uploadsAction } from './uploads.tsx'
import { sessionCookie, sessionStorage } from './utils/session.ts'
import { uploadHandler } from './utils/uploads.ts'

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
  middleware.push(loadAuth())

  let router = createRouter({ middleware })

  router.get(routes.uploads, uploadsAction)
  router.map(routes.fragments, fragmentsController)
  router.post(routes.api.cartToggle, toggleCart)

  router.map(routes.home, marketingController.home)
  router.map(routes.about, marketingController.about)
  router.map(routes.contact, marketingController.contact)
  router.map(routes.search, marketingController.search)

  router.map(routes.books, booksController)
  router.map(routes.auth, authController)
  router.map(routes.cart, cartController)
  router.map(routes.account, accountController)
  router.map(routes.checkout, checkoutController)
  router.map(routes.admin, adminController)

  return router
}
