import { Database } from '@remix-run/data-table';
import { SqliteDatabaseDriver, } from './driver.js';
/** A {@link Database} backed by SQLite. */
export class SqliteDatabase extends Database {
    /**
     * Creates a SQLite-backed database.
     * @param input SQLite configuration or synchronous database client.
     * @param options Database runtime options.
     */
    constructor(input, options = {}) {
        super(new SqliteDatabaseDriver(input), options);
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
export function createSqliteDatabase(input, options = {}) {
    return new SqliteDatabase(input, options);
}
