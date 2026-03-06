import { createRouter } from 'remix/fetch-router'
import { asyncContext } from 'remix/async-context-middleware'
import { compression } from 'remix/compression-middleware'
import { formData } from 'remix/form-data-middleware'
import { logger } from 'remix/logger-middleware'
import { methodOverride } from 'remix/method-override-middleware'
import { session } from 'remix/session-middleware'
import { staticFiles } from 'remix/static-middleware'

import { routes } from './routes.ts'
import { initializeBookstoreDatabase } from './data/setup.ts'
import { sessionCookie, sessionStorage } from './utils/session.ts'
import { uploadHandler } from './utils/uploads.ts'

import adminController from './admin.ts'
import accountController from './account.ts'
import authController from './auth.ts'
import booksController from './books.ts'
import cartController from './cart.ts'
import { toggleCart } from './cart.ts'
import checkoutController from './checkout.ts'
import * as marketingController from './marketing.ts'
import { uploadsAction } from './uploads.ts'
import fragmentsController from './fragments.ts'
import { loadDatabase } from './middleware/database.ts'

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
middleware.push(loadDatabase())

await initializeBookstoreDatabase()

export let router = createRouter({ middleware })

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
