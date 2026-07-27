import { createCookie } from 'remix/cookie'
import { createFsSessionStorage } from 'remix/session-storage/fs'

const sessionSecret = process.env.SESSION_SECRET

if (!sessionSecret && process.env.NODE_ENV !== 'test') {
  throw new Error('SESSION_SECRET is required')
}

export const sessionCookie = createCookie('__timebox_session', {
  secrets: [sessionSecret ?? 'test-only-secret'],
  httpOnly: true,
  sameSite: 'Lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 60 * 60 * 24 * 30,
  path: '/',
})

export const sessionStorage = createFsSessionStorage('./tmp/sessions')
