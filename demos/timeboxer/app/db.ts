import * as path from 'node:path'
import { createDatabase, type GetMigrations, type Seed } from 'remix/data-table'
import { loadMigrations } from 'remix/data-table/migrations/node'
import { createSqliteDatabaseAdapter } from 'remix/data-table/sqlite'

export const db = createDatabase(
  createSqliteDatabaseAdapter({
    filename:
      process.env.NODE_ENV === 'test'
        ? ':memory:'
        : (process.env.DATABASE_URL ?? path.join(import.meta.dirname, '../db/timebox.sqlite')),
  }),
)

export const getMigrations: GetMigrations = () =>
  loadMigrations(path.join(import.meta.dirname, '../db/migrations'))

export const seed: Seed = (db) => {}
