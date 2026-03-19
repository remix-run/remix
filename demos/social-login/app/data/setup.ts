import * as fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import BetterSqlite3 from 'better-sqlite3'
import { createDatabase } from 'remix/data-table'
import { createMigrationRunner } from 'remix/data-table/migrations'
import { loadMigrations } from 'remix/data-table/migrations/node'
import { createSqliteDatabaseAdapter } from 'remix/data-table-sqlite'

import { authAccounts, passwordResetTokens, users } from './schema.ts'
import { hashPassword } from '../utils/password.ts'

let dataDirectoryUrl = new URL('../../data/', import.meta.url)
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

export async function initializeSocialLoginDatabase(): Promise<void> {
  if (!initializePromise) {
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
      ? `social-login.test.${process.pid}.${Date.now()}.sqlite`
      : 'social-login.sqlite'

  return fileURLToPath(new URL(fileName, dataDirectoryUrl))
}

export async function resetSocialLoginDatabase(): Promise<void> {
  await initializeSocialLoginDatabase()

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
    },
    {
      id: 2,
      email: 'user@example.com',
      password_hash: await hashPassword('password123'),
      name: 'Demo User',
    },
  ])
}

export { sqlite, authAccounts, passwordResetTokens, users }
