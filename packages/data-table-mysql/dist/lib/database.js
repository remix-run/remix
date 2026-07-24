import { MysqlDatabaseImplementation } from "./adapter.js";
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
export function createMysqlDatabase(input, options = {}) {
    return new MysqlDatabaseImplementation(input, options);
}
