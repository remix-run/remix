import * as path from 'node:path'
import { loadMigrations } from 'remix/data-table/migrations/node'
import { createSqliteDatabase } from 'remix/data-table/sqlite'

export const db = createSqliteDatabase({
  filename:
    process.env.NODE_ENV === 'test'
      ? ':memory:'
      : path.join(import.meta.dirname, '../db/passkeys.sqlite'),
  foreignKeys: true,
})

export function loadAppMigrations() {
  return loadMigrations(path.join(import.meta.dirname, '../db/migrations'))
}
