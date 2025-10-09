import { createRouter } from '@remix-run/fetch-router'
import { logger } from '@remix-run/fetch-router/logger-middleware'

import { routes } from '../routes.ts'
import { storeContext } from './middleware/context.ts'
import { uploadHandler } from './utils/uploads.ts'

import adminHandlers from './admin.tsx'
import accountHandlers from './account.tsx'
import { assetsHandler } from './assets.ts'
import authHandlers from './auth.tsx'
import booksHandlers from './books.tsx'
import cartHandlers from './cart.tsx'
import checkoutHandlers from './checkout.tsx'
import fragmentsHandlers from './fragments.tsx'
import * as marketingHandlers from './marketing.tsx'
import { uploadsHandler } from './uploads.tsx'

export let router = createRouter({ uploadHandler })

router.use(storeContext)

if (process.env.NODE_ENV === 'development') {
  router.use(logger())
}

router.get(routes.assets, assetsHandler)
router.get(routes.uploads, uploadsHandler)

router.map(routes.home, marketingHandlers.home)
router.map(routes.about, marketingHandlers.about)
router.map(routes.contact, marketingHandlers.contact)
router.map(routes.search, marketingHandlers.search)

router.map(routes.fragments, fragmentsHandlers)

router.map(routes.books, booksHandlers)
router.map(routes.auth, authHandlers)
router.map(routes.cart, cartHandlers)
router.map(routes.account, accountHandlers)
router.map(routes.checkout, checkoutHandlers)
router.map(routes.admin, adminHandlers)
