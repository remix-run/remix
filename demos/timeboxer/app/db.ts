import * as fs from 'node:fs'
import * as path from 'node:path'
import { createDatabase } from 'remix/data-table'
import { loadMigrations } from 'remix/data-table/migrations/node'
import { createSqliteDatabaseAdapter } from 'remix/data-table/sqlite'

const filename =
  process.env.NODE_ENV === 'test'
    ? ':memory:'
    : (process.env.DATABASE_URL ?? path.join(import.meta.dirname, '../db/timebox.sqlite'))

if (filename !== ':memory:') fs.mkdirSync(path.dirname(filename), { recursive: true })

export const db = createDatabase(createSqliteDatabaseAdapter({ filename, foreignKeys: true }))

export function loadAppMigrations() {
  return loadMigrations(path.join(import.meta.dirname, '../db/migrations'))
}
