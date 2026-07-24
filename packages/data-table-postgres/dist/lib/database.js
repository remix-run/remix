import { PostgresDatabaseImplementation } from "./adapter.js";
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
    return new PostgresDatabaseImplementation(input, options);
}
