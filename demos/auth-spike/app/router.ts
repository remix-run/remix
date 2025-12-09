import { createRouter } from '@remix-run/fetch-router'
import { formData } from '@remix-run/form-data-middleware'
import { session } from '@remix-run/session-middleware'

import { sessionCookie, sessionStorage, auth, mockOAuthEndpoints } from './utils/auth.ts'
import { routes } from './routes.ts'
import authHandlers from './auth.tsx'
import accountHandlers from './account.tsx'
import postsHandlers from './posts.ts'
import { home } from './home.tsx'

export let router = createRouter({
  middleware: [formData(), session(sessionCookie, sessionStorage), auth],
})

router.get(routes.home, home)
router.map(routes.auth, authHandlers)

// Mount mock OAuth endpoints for development
if (mockOAuthEndpoints) {
  router.map(routes.mockOAuth, mockOAuthEndpoints)
}

router.map(routes.account, accountHandlers)
router.map(routes.posts, postsHandlers)
