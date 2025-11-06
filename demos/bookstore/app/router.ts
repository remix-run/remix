import { createRouter } from '@remix-run/fetch-router'
import { asyncContext } from '@remix-run/fetch-router/async-context-middleware'
import { formData } from '@remix-run/fetch-router/form-data-middleware'
import { logger } from '@remix-run/fetch-router/logger-middleware'
import { methodOverride } from '@remix-run/fetch-router/method-override-middleware'
import { staticFiles } from '@remix-run/fetch-router/static-middleware'

import { routes } from '../routes.ts'
import { uploadHandler } from './utils/uploads.ts'

import adminHandlers from './admin.tsx'
import accountHandlers from './account.tsx'
import authHandlers from './auth.tsx'
import booksHandlers from './books.tsx'
import cartHandlers from './cart.tsx'
import checkoutHandlers from './checkout.tsx'
import fragmentsHandlers from './fragments.tsx'
import * as marketingHandlers from './marketing.tsx'
import { uploadsHandler } from './uploads.tsx'

let middleware = []

if (process.env.NODE_ENV === 'development') {
  middleware.push(logger())
}

middleware.push(formData({ uploadHandler }))
middleware.push(methodOverride())
middleware.push(asyncContext())

middleware.push(
  staticFiles('./public/root', {
    cacheControl: 'no-store, must-revalidate',
    etag: false,
    lastModified: false,
    acceptRanges: false,
  }),
)

export let router = createRouter({ middleware })

router.get(routes.assets, {
  middleware: [
    staticFiles('./public/assets', {
      path: ({ params }) => params.path,
      cacheControl: 'no-store, must-revalidate',
      etag: false,
      lastModified: false,
      acceptRanges: false,
    }),
  ],
  handler() {
    return new Response('Not Found', { status: 404 })
  },
})

router.get(routes.images, {
  middleware: [
    staticFiles('./public/images', {
      path: ({ params }) => params.path,
      cacheControl: 'no-store, must-revalidate',
      etag: false,
      lastModified: false,
      acceptRanges: false,
    }),
  ],
  handler() {
    return new Response('Not Found', { status: 404 })
  },
})

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
