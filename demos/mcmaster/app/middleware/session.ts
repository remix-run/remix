import { createCookie } from 'remix/cookie'
import { createCookieSessionStorage } from 'remix/session-storage/cookie'

export const sessionCookie = createCookie('session', {
  secrets: ['demo-only-session-secret'],
  httpOnly: true,
  sameSite: 'Lax',
  maxAge: 60 * 60 * 24 * 30,
  path: '/',
})

// The cart only stores part numbers and quantities, so it fits comfortably in the cookie itself.
export const sessionStorage = createCookieSessionStorage()
