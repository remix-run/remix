import { DatabaseSync } from 'node:sqlite'
import { createDatabase, type Database } from 'remix/data-table'
import { createSqliteDatabaseAdapter } from 'remix/data-table/sqlite'

export function createDataModelFormsDatabase(): Database {
  let sqlite = new DatabaseSync(':memory:')

  sqlite.exec(`
    CREATE TABLE accounts (
      id TEXT PRIMARY KEY,
      displayName TEXT NOT NULL,
      email TEXT NOT NULL,
      age INTEGER,
      website TEXT
    )
  `)

  return createDatabase(createSqliteDatabaseAdapter(sqlite))
}
