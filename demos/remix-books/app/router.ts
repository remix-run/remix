import { createRouter, logger } from '@remix-run/fetch-router'

import { routes } from '../routes.ts'
import { loadAuth, requireAuth } from './middleware/auth.ts'
import { requireAdmin } from './middleware/admin.ts'

// Import handler maps
import marketingHandlers from './marketing.ts'
import booksHandlers from './books.ts'
import authHandlers from './auth.ts'
import accountHandlers from './account.ts'
import cartHandlers from './cart.ts'
import checkoutHandlers from './checkout.ts'
import adminHandlers from './admin.ts'

export let router = createRouter()

if (process.env.NODE_ENV === 'development') {
  router.use(logger())
}

// Public marketing routes with optional auth (for nav display)
router.map(routes.home, [loadAuth], marketingHandlers.home)
router.map(routes.about, [loadAuth], marketingHandlers.about)
router.map(routes.contact, [loadAuth], marketingHandlers.contact)
router.map(routes.contactSubmit, [loadAuth], marketingHandlers.contactSubmit)
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
