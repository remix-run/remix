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

import apiController from './controllers/api/controller.tsx'
import { about } from './controllers/about.tsx'
import accountController from './controllers/account/controller.tsx'
import adminController from './controllers/admin/controller.tsx'
import authController from './controllers/auth/controller.tsx'
import booksController from './controllers/books/controller.tsx'
import cartController from './controllers/cart/controller.tsx'
import checkoutController from './controllers/checkout/controller.tsx'
import contactController from './controllers/contact/controller.tsx'
import fragmentsController from './controllers/fragments/controller.tsx'
import { home } from './controllers/home.tsx'
import { search } from './controllers/search.tsx'
import { uploads } from './controllers/uploads.tsx'
import { loadAuth } from './middleware/auth.ts'
import { loadDatabase } from './middleware/database.ts'
import { loadAssetEntry } from './middleware/asset-entry.ts'
import { sessionCookie, sessionStorage } from './middleware/session.ts'
import { uploadHandler } from './middleware/uploads.ts'
import { routes } from './routes.ts'
import { assetServer } from './utils/assets.ts'

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
  middleware.push(loadAssetEntry())
  middleware.push(loadAuth())

  let router = createRouter({ middleware })

  router.get(routes.assets, async ({ request, params }) => {
    if (!params.path) return new Response('Not found', { status: 404 })
    let script = await assetServer.fetch(request)
    return script ?? new Response('Not found', { status: 404 })
  })

  router.map(routes.uploads, uploads)
  router.map(routes.fragments, fragmentsController)
  router.map(routes.api, apiController)

  router.map(routes.home, home)
  router.map(routes.about, about)
  router.map(routes.contact, contactController)
  router.map(routes.search, search)

  router.map(routes.books, booksController)
  router.map(routes.auth, authController)
  router.map(routes.cart, cartController)
  router.map(routes.account, accountController)
  router.map(routes.checkout, checkoutController)
  router.map(routes.admin, adminController)

  return router
}
