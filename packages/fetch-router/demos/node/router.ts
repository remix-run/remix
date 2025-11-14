import { createRouter } from '@remix-run/fetch-router'
import { formData } from '@remix-run/fetch-router/form-data-middleware'
import { logger } from '@remix-run/fetch-router/logger-middleware'
import { methodOverride } from '@remix-run/fetch-router/method-override-middleware'
import { session } from '@remix-run/fetch-router/session-middleware'
import { staticFiles } from '@remix-run/fetch-router/static-middleware'
import { createCookie } from '@remix-run/cookie'

import { routes } from './routes.ts'

import * as marketingHandlers from './app/marketing.ts'
import * as authHandlers from './app/auth.ts'
import * as postsHandlers from './app/posts.ts'
import * as commentHandlers from './app/comment.ts'

// Create a signed cookie for session
let sessionCookie = createCookie('blog_session', {
  secrets: ['demo-secret-key-change-in-production'],
})

export let router = createRouter({
  middleware: [
    logger(),
    formData(),
    methodOverride(),
    session(sessionCookie),
    staticFiles('./public', {
      cacheControl: 'public, max-age=3600',
      etag: 'strong',
    }),
  ],
})

router.map(routes.home, marketingHandlers.home)

router.map(routes.login, authHandlers.login)
router.post(routes.logout, authHandlers.logout)

// Posts routes
router.map(routes.posts, {
  ...postsHandlers.posts,
  comment: commentHandlers.comment,
})
