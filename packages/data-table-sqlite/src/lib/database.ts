import { Database } from '@remix-run/data-table'
import type { DatabaseOptions } from '@remix-run/data-table'

import { SqliteDatabaseDriver } from './driver.ts'
import type { SqliteDatabaseClient, SqliteDatabaseConfig } from './driver.ts'

/** A {@link Database} backed by SQLite. */
export class SqliteDatabase extends Database<'sqlite'> {
  /**
   * Creates a SQLite-backed database.
   * @param input SQLite configuration or synchronous database client.
   * @param options Database runtime options.
   */
  constructor(input: SqliteDatabaseClient | SqliteDatabaseConfig, options: DatabaseOptions = {}) {
    super(new SqliteDatabaseDriver(input), options)
  }
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
  return new SqliteDatabase(input, options)
}
