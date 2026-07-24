import { SqliteDatabaseImplementation, } from "./adapter.js";
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
    return new SqliteDatabaseImplementation(input, options);
}
