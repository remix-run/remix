import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createCookie } from 'remix/cookie'
import { Session } from 'remix/session'
import { createFsSessionStorage } from 'remix/session/fs-storage'

const sessionSecret = process.env.SESSION_SECRET ?? 'social-auth-demo-secret'
const demoRootPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const sessionDirectoryPath = path.join(demoRootPath, 'tmp', 'sessions')

fs.mkdirSync(sessionDirectoryPath, { recursive: true })

export const sessionCookie = createCookie('social-auth-session', {
  secrets: [sessionSecret],
  httpOnly: true,
  sameSite: 'Lax',
  maxAge: 60 * 60 * 24 * 30,
  path: '/',
})

export const sessionStorage = createFsSessionStorage(sessionDirectoryPath)

export { Session }
