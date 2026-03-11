import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createCookie } from 'remix/cookie'
import { Session } from 'remix/session'
import { createFsSessionStorage } from 'remix/session/fs-storage'

let __dirname = path.dirname(fileURLToPath(import.meta.url))

export let sessionCookie = createCookie('social-login-session', {
  secrets: ['social-login-demo-secret'],
  httpOnly: true,
  sameSite: 'Lax',
  maxAge: 2592000,
  path: '/',
})

export let sessionStorage = createFsSessionStorage(
  path.resolve(__dirname, '..', '..', 'tmp', 'sessions'),
)

export { Session }
