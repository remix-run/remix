import { Database, type DatabaseOptions } from '@remix-run/data-table';
import { type PostgresDatabaseInput } from './driver.ts';
/** Options for creating a PostgreSQL database. */
export interface PostgresDatabaseOptions extends DatabaseOptions {
    /** Database used while dropping and recreating the configured database (`postgres` by default). */
    maintenanceDatabase?: string;
    /** Template used to recreate the configured database (`template0` by default). */
    template?: string;
}
/** A {@link Database} backed by PostgreSQL. */
export declare class PostgresDatabase extends Database<'postgres'> {
    /**
     * Creates a PostgreSQL-backed database.
     * @param input PostgreSQL pool configuration, pool, or client.
     * @param options Database runtime and recreation options.
     */
    constructor(input: PostgresDatabaseInput, options?: PostgresDatabaseOptions);
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
export declare function createPostgresDatabase(input: PostgresDatabaseInput, options?: PostgresDatabaseOptions): PostgresDatabase;
//# sourceMappingURL=database.d.ts.map