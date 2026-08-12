import { Database, type DatabaseOptions } from '@remix-run/data-table'

import { MysqlDatabaseDriver, type MysqlDatabaseInput } from './adapter.ts'

/** Options for creating a MySQL database. */
export interface MysqlDatabaseOptions extends DatabaseOptions {
  /** Character set assigned to the recreated database. */
  characterSet?: string
  /** Collation assigned to the recreated database. */
  collation?: string
}

/** A {@link Database} backed by MySQL. */
export class MysqlDatabase extends Database<'mysql'> {
  /**
   * Creates a MySQL-backed database.
   * @param input MySQL pool configuration, pool, connection, or URI.
   * @param options Database runtime and recreation options.
   */
  constructor(input: MysqlDatabaseInput, options: MysqlDatabaseOptions = {}) {
    super(new MysqlDatabaseDriver(input, options), options)
  }
}

/**
 * Creates a MySQL-backed database.
 *
 * @param input MySQL pool configuration, pool, connection, or URI.
 * @param options Database runtime and recreation options.
 * @returns A MySQL database.
 * @example
 * ```ts
 * import { createMysqlDatabase } from 'remix/data-table/mysql'
 *
 * let db = createMysqlDatabase({
 *   uri: process.env.DATABASE_URL,
 *   multipleStatements: true,
 * })
 * ```
 */
export function createMysqlDatabase(
  input: MysqlDatabaseInput,
  options: MysqlDatabaseOptions = {},
): MysqlDatabase {
  return new MysqlDatabase(input, options)
}
