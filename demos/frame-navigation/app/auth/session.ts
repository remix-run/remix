import { createCookie } from 'remix/cookie'
import { getContext } from 'remix/async-context-middleware'

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
