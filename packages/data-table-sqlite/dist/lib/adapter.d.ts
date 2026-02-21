import type { AdapterCapabilityOverrides, AdapterExecuteRequest, AdapterResult, DatabaseAdapter, TransactionOptions, TransactionToken } from '@remix-run/data-table';
import type { Database as BetterSqliteDatabase } from 'better-sqlite3';
/**
 * Better SQLite3 database handle accepted by the sqlite adapter.
 */
export type SqliteDatabaseConnection = BetterSqliteDatabase;
/**
 * Sqlite adapter configuration.
 */
export type SqliteDatabaseAdapterOptions = {
    capabilities?: AdapterCapabilityOverrides;
};
/**
 * `DatabaseAdapter` implementation for Better SQLite3.
 */
export declare class SqliteDatabaseAdapter implements DatabaseAdapter {
    #private;
    dialect: string;
    capabilities: {
        returning: boolean;
        savepoints: boolean;
        upsert: boolean;
    };
    constructor(database: SqliteDatabaseConnection, options?: SqliteDatabaseAdapterOptions);
    execute(request: AdapterExecuteRequest): Promise<AdapterResult>;
    beginTransaction(options?: TransactionOptions): Promise<TransactionToken>;
    commitTransaction(token: TransactionToken): Promise<void>;
    rollbackTransaction(token: TransactionToken): Promise<void>;
    createSavepoint(token: TransactionToken, name: string): Promise<void>;
    rollbackToSavepoint(token: TransactionToken, name: string): Promise<void>;
    releaseSavepoint(token: TransactionToken, name: string): Promise<void>;
}
/**
 * Creates a sqlite `DatabaseAdapter`.
 * @param database Better SQLite3 database instance.
 * @param options Optional adapter capability overrides.
 * @returns A configured sqlite adapter.
 */
export declare function createSqliteDatabaseAdapter(database: SqliteDatabaseConnection, options?: SqliteDatabaseAdapterOptions): SqliteDatabaseAdapter;
//# sourceMappingURL=adapter.d.ts.map