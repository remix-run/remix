import type { Database, DatabaseOptions } from '@remix-run/data-table'

import {
  SqliteDatabaseImplementation,
  type SqliteDatabaseClient,
  type SqliteDatabaseConfig,
} from './adapter.ts'

/** A `Database` backed by SQLite. */
export interface SqliteDatabase extends Database {
  /** SQLite dialect identifier. */
  readonly dialect: 'sqlite'
  /** Closes a connection created from configuration. Supplied clients remain caller-owned. */
  close(): void
}

/**
 * Creates a SQLite-backed database.
 *
 * @param input SQLite configuration or synchronous database client.
 * @param options Database runtime options.
 * @returns A SQLite database.
 * @example
 * ```ts
 * import { createSqliteDatabase } from 'remix/data-table/sqlite'
 *
 * let db = createSqliteDatabase({
 *   filename: './data/app.db',
 *   foreignKeys: true,
 * })
 * ```
 */
export function createSqliteDatabase(
  input: SqliteDatabaseClient | SqliteDatabaseConfig,
  options: DatabaseOptions = {},
): SqliteDatabase {
  return new SqliteDatabaseImplementation(input, options)
}
