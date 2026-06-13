import * as fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createMigrationRunner } from 'remix/data-table/migrations'
import { loadMigrations } from 'remix/data-table/migrations/node'
import { createSqliteDatabase } from 'remix/data-table/sqlite'

import { hashPassword } from '../utils/password-hash.ts'
import { authAccounts, passwordResetTokens, users } from './schema.ts'

const DEMO_ADMIN_AVATAR_URL = 'https://randomuser.me/api/portraits/women/44.jpg'
const DEMO_USER_AVATAR_URL = 'https://randomuser.me/api/portraits/men/32.jpg'

let databaseFilePath: string
if (process.env.NODE_ENV === 'test') {
  databaseFilePath = ':memory:'
} else {
  let dbDirectoryUrl = new URL('../../db/', import.meta.url)
  databaseFilePath = fileURLToPath(new URL('social-auth.sqlite', dbDirectoryUrl))
  fs.mkdirSync(fileURLToPath(dbDirectoryUrl), { recursive: true })
}

const migrationsDirectoryPath = fileURLToPath(new URL('../../db/migrations/', import.meta.url))

export const database = createSqliteDatabase({ path: databaseFilePath })
export const db = await database.connect()

let initializePromise: Promise<void> | null = null

export async function initializeSocialAuthDatabase(): Promise<void> {
  if (initializePromise == null) {
    initializePromise = initialize()
  }

  await initializePromise
}

async function initialize(): Promise<void> {
  let migrations = await loadMigrations(migrationsDirectoryPath)
  let migrationRunner = createMigrationRunner(db.adapter, migrations)
  await migrationRunner.up()

  if ((await db.count(users)) === 0) {
    await seedBaseData()
  }
}

export async function resetSocialAuthDatabase(): Promise<void> {
  await initializeSocialAuthDatabase()

  await db.exec('DELETE FROM password_reset_tokens')
  await db.exec('DELETE FROM auth_accounts')
  await db.exec('DELETE FROM users')
  await seedBaseData()
}

async function seedBaseData(): Promise<void> {
  await db.createMany(users, [
    {
      id: 1,
      email: 'admin@example.com',
      password_hash: await hashPassword('password123'),
      name: 'Demo Admin',
      avatar_url: DEMO_ADMIN_AVATAR_URL,
    },
    {
      id: 2,
      email: 'user@example.com',
      password_hash: await hashPassword('password123'),
      name: 'Demo User',
      avatar_url: DEMO_USER_AVATAR_URL,
    },
  ])
}

export { authAccounts, passwordResetTokens, users }
