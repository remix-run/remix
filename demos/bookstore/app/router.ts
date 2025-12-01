import { createRouter } from '@remix-run/fetch-router'
import { asyncContext } from '@remix-run/async-context-middleware'
import { compression } from '@remix-run/compression-middleware'
import { formData } from '@remix-run/form-data-middleware'
import { logger } from '@remix-run/logger-middleware'
import { methodOverride } from '@remix-run/method-override-middleware'
import { session } from '@remix-run/session-middleware'
import { staticFiles } from '@remix-run/static-middleware'

import { routes } from './routes.ts'
import { sessionCookie, sessionStorage } from './utils/session.ts'
import { uploadHandler } from './utils/uploads.ts'

import adminController from './admin.tsx'
import accountController from './account.tsx'
import authController from './auth.tsx'
import booksController from './books.tsx'
import cartController from './cart.tsx'
import checkoutController from './checkout.tsx'
import fragmentsController from './fragments.tsx'
import * as marketingController from './marketing.tsx'
import { uploadsAction } from './uploads.tsx'

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
middleware.push(session(sessionCookie, sessionStorage))
middleware.push(asyncContext())

export let router = createRouter({ middleware })

router.get(routes.uploads, uploadsAction)

router.map(routes.home, marketingController.home)
router.map(routes.about, marketingController.about)
router.map(routes.contact, marketingController.contact)
router.map(routes.search, marketingController.search)

router.map(routes.fragments, fragmentsController)

router.map(routes.books, booksController)
router.map(routes.auth, authController)
router.map(routes.cart, cartController)
router.map(routes.account, accountController)
router.map(routes.checkout, checkoutController)
router.map(routes.admin, adminController)
