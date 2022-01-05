import type { Session } from 'remix'
import { createCookieSessionStorage } from 'remix'

export const mySessionStorage = createCookieSessionStorage({
  cookie: {
    name: '__session',
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secrets: ['s3cret'], // This should be an env variable
    secure: process.env.NODE_ENV === 'production',
  },
})

export function getSession(request: Request): Promise<Session> {
  return mySessionStorage.getSession(request.headers.get('Cookie'))
}

export const { commitSession, destroySession } = mySessionStorage
