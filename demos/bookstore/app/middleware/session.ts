import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createCookie } from 'remix/cookie'
import { Session } from 'remix/session'
import { createFsSessionStorage } from 'remix/session/fs-storage'

const demoRootPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const sessionDirectoryPath = path.join(demoRootPath, 'tmp', 'sessions')

fs.mkdirSync(sessionDirectoryPath, { recursive: true })

export const sessionCookie = createCookie('session', {
  secrets: ['s3cr3t-k3y-for-d3mo'],
  httpOnly: true,
  sameSite: 'Lax',
  maxAge: 2592000,
  path: '/',
})

export const sessionStorage = createFsSessionStorage(sessionDirectoryPath)

export { Session }
