import * as fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import BetterSqlite3 from 'better-sqlite3'
import { createDatabase } from 'remix/data-table'
import { createMigrationRunner } from 'remix/data-table/migrations'
import { loadMigrations } from 'remix/data-table/migrations/node'
import { createSqliteDatabaseAdapter } from 'remix/data-table-sqlite'

import { hashPassword } from '../app/utils/password-hash.ts'
import { authAccounts, passwordResetTokens, users } from './schema.ts'

const DEMO_ADMIN_AVATAR_URL = 'https://randomuser.me/api/portraits/women/44.jpg'
const DEMO_USER_AVATAR_URL = 'https://randomuser.me/api/portraits/men/32.jpg'

let dataDirectoryUrl = new URL('./', import.meta.url)
let migrationsDirectoryPath = fileURLToPath(new URL('migrations/', dataDirectoryUrl))
let databaseFilePath = getDatabaseFilePath()

fs.mkdirSync(fileURLToPath(dataDirectoryUrl), { recursive: true })

if (process.env.NODE_ENV === 'test' && fs.existsSync(databaseFilePath)) {
  fs.unlinkSync(databaseFilePath)
}

let sqlite = new BetterSqlite3(databaseFilePath)
sqlite.pragma('foreign_keys = ON')
let adapter = createSqliteDatabaseAdapter(sqlite)

export let db = createDatabase(adapter)

let initializePromise: Promise<void> | null = null

export async function initializeSocialAuthDatabase(): Promise<void> {
  if (initializePromise == null) {
    initializePromise = initialize()
  }

  await initializePromise
}

async function initialize(): Promise<void> {
  let migrations = await loadMigrations(migrationsDirectoryPath)
  let migrationRunner = createMigrationRunner(adapter, migrations)
  await migrationRunner.up()

  if ((await db.count(users)) === 0) {
    await seedBaseData()
  }
}

export function getDatabaseFilePath(): string {
  let fileName =
    process.env.NODE_ENV === 'test'
      ? 'social-auth.test.' + process.pid + '.' + Date.now() + '.sqlite'
      : 'social-auth.sqlite'

  return fileURLToPath(new URL(fileName, dataDirectoryUrl))
}

export async function resetSocialAuthDatabase(): Promise<void> {
  await initializeSocialAuthDatabase()

  sqlite.exec('DELETE FROM password_reset_tokens')
  sqlite.exec('DELETE FROM auth_accounts')
  sqlite.exec('DELETE FROM users')
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

export { sqlite, authAccounts, passwordResetTokens, users }
