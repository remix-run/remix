import { getContext } from 'remix/async-context-middleware'
import { Auth, auth, requireAuth as requireAuthenticated } from 'remix/auth-middleware'
import type { AuthScheme, AuthState } from 'remix/auth-middleware'
import { createCookie } from 'remix/cookie'
import { redirect } from 'remix/response/redirect'

import { routes } from '../routes.ts'

type FrameAuthIdentity = 'frame-navigation-demo'

export const authCookie = createCookie('frame-navigation-auth', {
  httpOnly: true,
  sameSite: 'Lax',
  path: '/',
})

const authCookieScheme: AuthScheme<FrameAuthIdentity> = {
  name: 'auth-cookie',
  async authenticate(context) {
    let cookie = await authCookie.parse(context.headers.get('cookie'))
    if (cookie !== '1') {
      return
    }

    return {
      status: 'success',
      identity: 'frame-navigation-demo',
    }
  },
}

export function loadAuth() {
  return auth({
    schemes: [authCookieScheme],
  })
}

export function isAuthenticated() {
  let authState = getContext().get(Auth) as AuthState<FrameAuthIdentity>
  return authState.ok
}

export const requireAuth = requireAuthenticated<FrameAuthIdentity>({
  onFailure(context) {
    let isFrameRequest = context.request.headers.get('x-remix-frame') === 'true'
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

    return redirect(routes.auth.login.index.href())
  },
})
