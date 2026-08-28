import { auth, requireAuth as requireAuthenticated } from 'remix/middleware/auth'
import type { AuthScheme } from 'remix/middleware/auth'
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
    let cookie = await authCookie.parse(context.headers.get('Cookie'))
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

export const requireAuth = requireAuthenticated<FrameAuthIdentity>({
  onFailure(context) {
    return redirect(routes.auth.login.index.href())
  },
})
