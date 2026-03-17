import { createRouter } from 'remix/fetch-router'
import { asyncContext } from 'remix/async-context-middleware'
import { logger } from 'remix/logger-middleware'
import { redirect } from 'remix/response/redirect'
import { staticFiles } from 'remix/static-middleware'
import type { Middleware } from 'remix/fetch-router'

import authController from '../app/auth/controller.tsx'
import { hasAuthCookie } from '../app/auth/session.ts'
import mainController from '../app/main/controller.tsx'
import settingsController from '../app/settings/controller.tsx'
import { routes } from './routes.ts'

let middleware = []

let requireAuth: Middleware = async ({ request, url }, next) => {
  let loginPath = routes.auth.login.index.href()
  if (url.pathname === loginPath) {
    return next()
  }

  if (await hasAuthCookie(request.headers.get('cookie'))) {
    return next()
  }

  let isFrameRequest = request.headers.get('x-remix-frame') === 'true'
  if (isFrameRequest) {
    return new Response(
      '<div><h1>Not authorized</h1><p>Refresh the page to sign in again.</p></div>',
      {
        status: 401,
        headers: {
          'Content-Type': 'text/html; charset=UTF-8',
        },
      },
    )
  }

  return redirect(loginPath)
}

if (process.env.NODE_ENV === 'development') {
  middleware.push(logger())
}

middleware.push(
  staticFiles('./public', {
    cacheControl: 'no-store',
    etag: false,
    lastModified: false,
    index: false,
  }),
)
middleware.push(asyncContext())
middleware.push(requireAuth)

export let router = createRouter({ middleware })

router.map(routes.main, mainController)
router.map(routes.auth, authController)
router.map(routes.settings, settingsController)
