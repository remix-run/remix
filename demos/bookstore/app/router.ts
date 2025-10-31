import { createRouter } from '@remix-run/fetch-router'
import { logger } from '@remix-run/fetch-router/logger-middleware'
import { staticFiles } from '@remix-run/fetch-router/static-middleware'

import { routes } from '../routes.ts'
import { storeContext } from './middleware/context.ts'
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

export let router = createRouter({ uploadHandler })

router.use(storeContext)

if (process.env.NODE_ENV === 'development') {
  router.use(logger())
}

router.use(
  staticFiles('./public/root', {
    cacheControl: 'no-store, must-revalidate',
    etag: false,
    lastModified: false,
    acceptRanges: false,
  }),
)

router.get(routes.assets, {
  use: [
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
  use: [
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

// NOTE: This is needed for the root static file middleware to work. This won't
// be needed if middleware is run against fetch-router's default handler.
router.get('/*', () => {
  return new Response('Not Found', { status: 404 })
})
