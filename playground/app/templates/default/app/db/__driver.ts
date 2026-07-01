import type { BindableValue, default as sqlite3InitModule } from '@sqlite.org/sqlite-wasm'
import { createDatabase } from 'remix/data-table'
import { createMigrationRunner } from 'remix/data-table/migrations'
import { loadMigrations } from 'remix/data-table/migrations/node'
import { createSqliteDatabaseAdapter } from 'remix/data-table/sqlite'

import { guestBook } from './schema.ts'
import { seedDatabase } from './seed.ts'

const migrationsDirectoryPath = '/migrations/'

const sqlite3 = (
  process as unknown as {
    __sqlite3: Awaited<ReturnType<typeof sqlite3InitModule>>
  }
).__sqlite3
const driver = new sqlite3.oo1.DB('/mydb.sqlite3', 'ct')

const adapter = createSqliteDatabaseAdapter({
  exec(sql) {
    driver.exec(sql)
  },
  prepare(sql) {
    // Prepare once so we can expose result-column metadata. The adapter uses
    // `reader`/`columnNames` to decide whether a `raw` statement returns rows
    // (and should be read via `all`) or is a write (and should use `run`).
    // Without this, raw SELECTs (e.g. the migration journal lookups) are
    // misclassified as writes and silently return no rows.
    let stmt = driver.prepare(sql)
    // `columnCount` is the number of result columns; > 0 means the statement
    // produces rows (a reader). `getColumnNames()` throws for zero-column
    // statements, so guard on `columnCount` before reading names.
    let isReader = stmt.columnCount > 0

    return {
      reader: isReader,
      columnNames: isReader ? stmt.getColumnNames() : [],
      all(...params) {
        try {
          if (params.length > 0) {
            stmt.bind(params as BindableValue[])
          }
          let rows = []
          while (stmt.step()) {
            rows.push(stmt.get({}))
          }
          return rows
        } finally {
          stmt.finalize()
        }
      },
      get(...params) {
        try {
          if (params.length > 0) {
            stmt.bind(params as BindableValue[])
          }
          if (stmt.step()) {
            return stmt.get({})
          }
          return undefined
        } finally {
          stmt.finalize()
        }
      },
      run(...params) {
        try {
          if (params.length > 0) {
            stmt.bind(params as BindableValue[])
          }
          stmt.step()
          return {
            changes: driver.changes(),
            lastInsertRowid: sqlite3.capi.sqlite3_last_insert_rowid(driver.pointer!),
          }
        } finally {
          stmt.finalize()
        }
      },
    }
  },
})

export const db = createDatabase(adapter)

let initializePromise: Promise<void> | null = null
export async function initializeDatabase(): Promise<void> {
  if (!initializePromise) {
    initializePromise = initialize()
  }

  await initializePromise
}

async function initialize(): Promise<void> {
  // Migrations are only applied when the playground explicitly asks for them
  // (via the Database menu, or on the very first boot). Without this gate every
  // re-run of the server — which happens on each keystroke while editing — would
  // re-run migrations against the already-existing database, letting in-progress
  // edits to a migration leak into the schema. The flag is supplied through the
  // almostnode runtime environment (see app/store/operations.ts).
  if (!process.env.MIGRATE_DATABASE) {
    return
  }

  let migrations = await loadMigrations(migrationsDirectoryPath)
  let migrationRunner = createMigrationRunner(adapter, migrations)
  await migrationRunner.up()

  await seedDatabase(db)
}
