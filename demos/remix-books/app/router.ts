import { createRouter, logger } from '@remix-run/fetch-router'

import { routes } from '../routes.ts'
import { loadAuth, requireAuth } from './middleware/auth.ts'
import { requireAdmin } from './middleware/admin.ts'
import { storeContext } from './middleware/context.ts'

import adminHandlers from './admin.tsx'
import accountHandlers from './account.tsx'
import authHandlers from './auth.tsx'
import booksHandlers from './books.tsx'
import cartHandlers from './cart.tsx'
import checkoutHandlers from './checkout.tsx'
import marketingHandlers from './marketing.tsx'

export let router = createRouter()

router.use(storeContext)

if (process.env.NODE_ENV === 'development') {
  router.use(logger())
}

// Public marketing routes with optional auth (for nav display)
router.map(routes.home, [loadAuth], marketingHandlers.home)
router.map(routes.about, [loadAuth], marketingHandlers.about)
router.map(routes.contact, [loadAuth], marketingHandlers.contact)
router.map(routes.search, [loadAuth], marketingHandlers.search)

// Public book routes with optional auth
router.map(routes.books, [loadAuth], booksHandlers)

// Auth routes with optional auth (to show user info if logged in)
router.map(routes.auth, [loadAuth], authHandlers)

// Cart routes with optional auth (works for both guests and logged-in users)
router.map(routes.cart, [loadAuth], cartHandlers)

// Protected account routes - require authentication
router.map(routes.account, [requireAuth], accountHandlers)

// Protected checkout routes - require authentication
router.map(routes.checkout, [requireAuth], checkoutHandlers)

// Admin routes - require authentication AND admin role
router.map(routes.admin, [requireAuth, requireAdmin], adminHandlers)
