import type { Database, DatabaseOptions } from '@remix-run/data-table'

import { PostgresDatabaseImplementation, type PostgresDatabaseInput } from './adapter.ts'

/** Options for creating a PostgreSQL database. */
export interface PostgresDatabaseOptions extends DatabaseOptions {
  /** Database used while dropping and recreating the configured database (`postgres` by default). */
  maintenanceDatabase?: string
  /** Template used to recreate the configured database (`template0` by default). */
  template?: string
}

/** A `Database` backed by PostgreSQL. */
export interface PostgresDatabase extends Database {
  /** PostgreSQL dialect identifier. */
  readonly dialect: 'postgres'
  /** Closes a pool created from configuration. Supplied clients remain caller-owned. */
  close(): Promise<void>
}

/**
 * Creates a PostgreSQL-backed database.
 *
 * @param input PostgreSQL pool configuration, pool, or client.
 * @param options Database runtime and recreation options.
 * @returns A PostgreSQL database.
 * @example
 * ```ts
 * import { createPostgresDatabase } from 'remix/data-table/postgres'
 *
 * let db = createPostgresDatabase({
 *   connectionString: process.env.DATABASE_URL,
 * })
 * ```
 */
export function createPostgresDatabase(
  input: PostgresDatabaseInput,
  options: PostgresDatabaseOptions = {},
): PostgresDatabase {
  return new PostgresDatabaseImplementation(input, options)
}
