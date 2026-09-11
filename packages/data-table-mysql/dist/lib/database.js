import { Database } from '@remix-run/data-table';
import { MysqlDatabaseDriver } from './driver.js';
/** A {@link Database} backed by MySQL. */
export class MysqlDatabase extends Database {
    /**
     * Creates a MySQL-backed database.
     * @param input MySQL pool configuration, pool, connection, or URI.
     * @param options Database runtime and recreation options.
     */
    constructor(input, options = {}) {
        super(new MysqlDatabaseDriver(input, options), options);
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
export function createMysqlDatabase(input, options = {}) {
    return new MysqlDatabase(input, options);
}
