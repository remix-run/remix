import { createRouter } from '@remix-run/fetch-router'
import { formData } from '@remix-run/form-data-middleware'
import { session } from '@remix-run/session-middleware'

import {
  sessionCookie,
  sessionStorage,
  auth,
  authClient,
  mockOAuthEndpoints,
} from './utils/auth.ts'
import { routes } from './routes.ts'
import authHandlers from './auth.tsx'
import accountHandlers from './account.tsx'
import postsHandlers from './posts.ts'
import { home } from './home.tsx'
import verifyEmail from './verify-email.tsx'

export let router = createRouter({
  middleware: [formData(), session(sessionCookie, sessionStorage), auth],
})

router.get(routes.home, home)
router.map(routes.auth, authHandlers)
router.get(routes.verifyEmail.pattern, verifyEmail)

// Map OAuth handlers dynamically for all configured providers
if (authClient.oauth) {
  for (let [providerName, flow] of Object.entries(authClient.oauth.flows)) {
    router.get(`/auth/${providerName}`, ({ request, session }) => flow.initiate(request, session))
    router.get(`/auth/${providerName}/callback`, ({ request, session }) =>
      flow.callback(request, session),
    )
  }
}

// Mount mock OAuth endpoints for development
if (mockOAuthEndpoints) {
  router.map(routes.mockOAuth, mockOAuthEndpoints)
}

router.map(routes.account, accountHandlers)
router.map(routes.posts, postsHandlers)
