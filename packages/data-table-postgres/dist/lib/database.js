import { Database } from '@remix-run/data-table';
import { PostgresDatabaseDriver } from './driver.js';
/** A {@link Database} backed by PostgreSQL. */
export class PostgresDatabase extends Database {
    /**
     * Creates a PostgreSQL-backed database.
     * @param input PostgreSQL pool configuration, pool, or client.
     * @param options Database runtime and recreation options.
     */
    constructor(input, options = {}) {
        super(new PostgresDatabaseDriver(input, options), options);
    }
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
export function createPostgresDatabase(input, options = {}) {
    return new PostgresDatabase(input, options);
}
