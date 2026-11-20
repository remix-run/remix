import * as fs from 'node:fs'
import * as path from 'node:path'
import { createCookie } from 'remix/cookie'
import { createFsSessionStorage } from 'remix/session-storage/fs'

const sessionSecret = process.env.SESSION_SECRET ?? 'passkeys-demo-secret'
const sessionDirectoryPath = path.join(import.meta.dirname, '..', '..', 'tmp', 'sessions')

fs.mkdirSync(sessionDirectoryPath, { recursive: true })

export const sessionCookie = createCookie('passkeys-session', {
  secrets: [sessionSecret],
  httpOnly: true,
  sameSite: 'Lax',
  maxAge: 60 * 60 * 24 * 30,
  path: '/',
})

// Sessions live on the server, not in the cookie. Each WebAuthn challenge is removed from the
// session once it is answered, and server-side storage is what makes that removal stick: with cookie
// storage, a replayed old cookie would bring the answered challenge back.
export const sessionStorage = createFsSessionStorage(sessionDirectoryPath)
