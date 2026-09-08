import * as path from 'node:path'
import { loadMigrations, loadSeed } from 'remix/data-table/migrations/node'
import { createSqliteDatabase } from 'remix/data-table/sqlite'

export const db = createSqliteDatabase({
  filename:
    process.env.NODE_ENV === 'test'
      ? ':memory:'
      : path.join(import.meta.dirname, '../db/bookstore.sqlite'),
  foreignKeys: true,
})

export function loadAppMigrations() {
  return loadMigrations(path.join(import.meta.dirname, '../db/migrations'))
}

export function loadAppSeed() {
  return loadSeed(path.join(import.meta.dirname, '../db/seed.sql'))
}
