import * as fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import BetterSqlite3 from 'better-sqlite3'
import { createDatabase } from 'remix/data-table'
import { createMigrationRunner } from 'remix/data-table/migrations'
import { loadMigrations } from 'remix/data-table/migrations/node'
import { createSqliteDatabaseAdapter } from 'remix/data-table-sqlite'

import { users } from './schema.ts'

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
export let socialLoginDatabaseFilePath = databaseFilePath

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

  let usersCount = await db.count(users)
  if (usersCount === 0) {
    await db.create(users, {
      email: 'demo@example.com',
      password: 'password123',
      name: 'Demo User',
      avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=160&q=80',
      created_at: Date.now(),
      updated_at: Date.now(),
    })
  }
}

function getDatabaseFilePath(): string {
  let fileName =
    process.env.NODE_ENV === 'test'
      ? `social-login.test.${process.pid}.${Date.now()}.sqlite`
      : 'social-login.sqlite'

  return fileURLToPath(new URL(fileName, dataDirectoryUrl))
}
