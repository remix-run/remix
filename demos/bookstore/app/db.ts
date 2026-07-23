import * as path from 'node:path'
import { createDatabase } from 'remix/data-table'
import { loadMigrations } from 'remix/data-table/migrations/node'
import { createSqliteDatabaseAdapter } from 'remix/data-table/sqlite'

export const db = createDatabase(
  createSqliteDatabaseAdapter({
    filename:
      process.env.NODE_ENV === 'test'
        ? ':memory:'
        : path.join(import.meta.dirname, '../db/bookstore.sqlite'),
    foreignKeys: true,
  }),
)

export function loadAppMigrations() {
  return loadMigrations(path.join(import.meta.dirname, '../db/migrations'))
}
