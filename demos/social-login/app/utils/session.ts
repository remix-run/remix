import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createCookie } from 'remix/cookie'
import { Session } from 'remix/session'
import { createFsSessionStorage } from 'remix/session/fs-storage'

let sessionSecret = process.env.SESSION_SECRET ?? 'social-login-demo-secret'
let demoRootPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
let sessionDirectoryPath = path.join(demoRootPath, 'tmp', 'sessions')

fs.mkdirSync(sessionDirectoryPath, { recursive: true })

export let sessionCookie = createCookie('social-login-session', {
  secrets: [sessionSecret],
  httpOnly: true,
  sameSite: 'Lax',
  maxAge: 60 * 60 * 24 * 30,
  path: '/',
})

export let sessionStorage = createFsSessionStorage(sessionDirectoryPath)

export { Session }
