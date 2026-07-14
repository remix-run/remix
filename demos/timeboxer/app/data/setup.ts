import * as path from 'node:path'
import { createMigrator } from 'remix/data-table/migrations'
import { loadMigrations } from 'remix/data-table/migrations/node'

import { database } from './database.ts'

const migrator = createMigrator(
  await loadMigrations(path.join(import.meta.dirname, '../../db/migrations')),
)

let initializePromise: Promise<void> | null = null

export async function initializeTimeboxerDatabase() {
  initializePromise ??= initialize()
  await initializePromise
}

async function initialize() {
  await database.create()
  await using db = await database.connect()
  await migrator.migrate(db)
}
