import { createRouter, type MiddlewareContext } from 'remix/router'
import { asyncContext } from 'remix/middleware/async-context'
import { compression } from 'remix/middleware/compression'
import { formData } from 'remix/middleware/form-data'
import type { Cookie } from 'remix/cookie'
import { logger } from 'remix/middleware/logger'
import { methodOverride } from 'remix/middleware/method-override'
import type { SessionStorage } from 'remix/session'
import { session } from 'remix/middleware/session'
import { staticFiles } from 'remix/middleware/static'

import apiController from './actions/api/controller.tsx'
import accountController from './actions/account/controller.tsx'
import accountOrdersController from './actions/account/orders/controller.tsx'
import accountSettingsController from './actions/account/settings/controller.tsx'
import adminController from './actions/admin/controller.tsx'
import adminBooksController from './actions/admin/books/controller.tsx'
import adminOrdersController from './actions/admin/orders/controller.tsx'
import adminUsersController from './actions/admin/users/controller.tsx'
import authController from './actions/auth/controller.tsx'
import authForgotPasswordController from './actions/auth/forgot-password/controller.tsx'
import authLoginController from './actions/auth/login/controller.tsx'
import authRegisterController from './actions/auth/register/controller.tsx'
import authResetPasswordController from './actions/auth/reset-password/controller.tsx'
import booksController from './actions/books/controller.tsx'
import cartApiController from './actions/cart/api/controller.tsx'
import cartController from './actions/cart/controller.tsx'
import checkoutController from './actions/checkout/controller.tsx'
import contactController from './actions/contact/controller.tsx'
import rootController from './actions/controller.tsx'
import fragmentsController from './actions/fragments/controller.tsx'
import { loadAuth } from './middleware/auth.ts'
import { loadDatabase } from './middleware/database.ts'
import { loadAssetEntry } from './middleware/asset-entry.ts'
import { render } from './middleware/render.tsx'
import { sessionCookie, sessionStorage } from './middleware/session.ts'
import { uploadHandler } from './middleware/uploads.ts'
import { routes } from './routes.ts'

type AppContext = MiddlewareContext<
  [
    ReturnType<typeof formData>,
    ReturnType<typeof session>,
    ReturnType<typeof loadDatabase>,
    ReturnType<typeof loadAssetEntry>,
    ReturnType<typeof loadAuth>,
    ReturnType<typeof render>,
  ]
>

declare module 'remix/router' {
  interface RouterTypes {
    context: AppContext
  }
}

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
  middleware.push(render())

  let router = createRouter<AppContext>({ middleware })

  router.map(routes, rootController)
  router.map(routes.fragments, fragmentsController)
  router.map(routes.api, apiController)

  router.map(routes.contact, contactController)

  router.map(routes.books, booksController)
  router.map(routes.auth, authController)
  router.map(routes.auth.login, authLoginController)
  router.map(routes.auth.register, authRegisterController)
  router.map(routes.auth.forgotPassword, authForgotPasswordController)
  router.map(routes.auth.resetPassword, authResetPasswordController)
  router.map(routes.cart, cartController)
  router.map(routes.cart.api, cartApiController)
  router.map(routes.account, accountController)
  router.map(routes.account.settings, accountSettingsController)
  router.map(routes.account.orders, accountOrdersController)
  router.map(routes.checkout, checkoutController)
  router.map(routes.admin, adminController)
  router.map(routes.admin.books, adminBooksController)
  router.map(routes.admin.users, adminUsersController)
  router.map(routes.admin.orders, adminOrdersController)

  return router
}
