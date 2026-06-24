import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { fileURLToPath } from 'node:url'
import { createDatabase } from 'remix/data-table'
import { createMigrationRunner } from 'remix/data-table/migrations'
import { loadMigrations } from 'remix/data-table/migrations/node'
import { createSqliteDatabaseAdapter } from 'remix/data-table/sqlite'

import { seedDatabase } from './seed.ts'

let databaseFilePath: string
let testDatabaseDirectoryPath: string | undefined

if (process.env.NODE_ENV === 'test') {
  testDatabaseDirectoryPath = fs.mkdtempSync(path.join(os.tmpdir(), 'remix-playground-'))
  databaseFilePath = path.join(testDatabaseDirectoryPath, 'playground.sqlite')
} else {
  let databaseDirectoryUrl = new URL('../../db/', import.meta.url)
  databaseFilePath = fileURLToPath(new URL('playground.sqlite', databaseDirectoryUrl))

  fs.mkdirSync(fileURLToPath(databaseDirectoryUrl), { recursive: true })
}

const migrationsDirectoryPath = fileURLToPath(new URL('../../migrations/', import.meta.url))

const sqlite = new DatabaseSync(databaseFilePath)
sqlite.exec('PRAGMA foreign_keys = ON')
const adapter = createSqliteDatabaseAdapter(sqlite)

export const db = createDatabase(adapter)

let initializePromise: Promise<void> | null = null

export async function initializeDatabase(): Promise<void> {
  if (!initializePromise) {
    initializePromise = initialize()
  }

  await initializePromise
}

async function initialize(): Promise<void> {
  let migrations = await loadMigrations(migrationsDirectoryPath)
  let migrationRunner = createMigrationRunner(adapter, migrations)
  await migrationRunner.up()

  await seedDatabase(db)
}

export function closeDatabase(): void {
  if (process.env.NODE_ENV === 'test' && process.platform === 'win32') {
    // DatabaseSync.close() can crash during Windows test process shutdown.
    // Each test file runs in its own process, and the runner discards temp files.
    return
  }

  if (sqlite.isOpen) {
    sqlite.close()
  }

  if (testDatabaseDirectoryPath) {
    fs.rmSync(testDatabaseDirectoryPath, { recursive: true, force: true })
    testDatabaseDirectoryPath = undefined
  }
}

if (process.env.NODE_ENV === 'test') {
  process.once('exit', closeDatabase)
}
