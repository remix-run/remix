import { createCookie } from 'remix/cookie'
import { getContext } from 'remix/async-context-middleware'
import { redirect } from 'remix/response/redirect'
import type { Middleware } from 'remix/fetch-router'

import { routes } from '../routes.ts'

export let authCookie = createCookie('frame-navigation-auth', {
  httpOnly: true,
  sameSite: 'Lax',
  path: '/',
})

export async function hasAuthCookie(cookieHeader: string | null) {
  let cookie = await authCookie.parse(cookieHeader)
  return cookie === '1'
}

export async function isAuthenticated() {
  return hasAuthCookie(getContext().request.headers.get('cookie'))
}

export function requireAuth(): Middleware {
  return async ({ request, url }, next) => {
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
}
