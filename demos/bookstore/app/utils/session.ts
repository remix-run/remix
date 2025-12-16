import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createCookie } from 'remix'
import { createFsSessionStorage } from 'remix/session/fs-storage'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * Session cookie configuration for the bookstore demo.
 * Uses secure defaults with a 30-day expiration.
 */
export let sessionCookie = createCookie('session', {
  secrets: ['s3cr3t-k3y-for-d3mo'],
  httpOnly: true,
  sameSite: 'Lax',
  maxAge: 2592000, // 30 days
  path: '/',
})

/**
 * Filesystem-based session storage.
 * Sessions are stored in the app's tmp/sessions directory.
 */
export let sessionStorage = createFsSessionStorage(
  path.resolve(__dirname, '..', '..', 'tmp', 'sessions'),
)
