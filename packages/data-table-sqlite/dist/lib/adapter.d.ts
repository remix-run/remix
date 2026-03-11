import type { AdapterCapabilityOverrides, DataManipulationRequest, DataMigrationRequest, DataMigrationResult, DataMigrationOperation, DataManipulationResult, DataManipulationOperation, DatabaseAdapter, SqlStatement, TableRef, TransactionOptions, TransactionToken } from '@remix-run/data-table';
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
        transactionalDdl: boolean;
        migrationLock: boolean;
    };
    constructor(database: SqliteDatabaseConnection, options?: SqliteDatabaseAdapterOptions);
    compileSql(operation: DataManipulationOperation | DataMigrationOperation): SqlStatement[];
    execute(request: DataManipulationRequest): Promise<DataManipulationResult>;
    migrate(request: DataMigrationRequest): Promise<DataMigrationResult>;
    hasTable(table: TableRef, transaction?: TransactionToken): Promise<boolean>;
    hasColumn(table: TableRef, column: string, transaction?: TransactionToken): Promise<boolean>;
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
 * @example
 * ```ts
 * import BetterSqlite3 from 'better-sqlite3'
 * import { createDatabase } from 'remix/data-table'
 * import { createSqliteDatabaseAdapter } from 'remix/data-table-sqlite'
 *
 * let sqlite = new BetterSqlite3('./data/app.db')
 * let adapter = createSqliteDatabaseAdapter(sqlite)
 * let db = createDatabase(adapter)
 * ```
 */
export declare function createSqliteDatabaseAdapter(database: SqliteDatabaseConnection, options?: SqliteDatabaseAdapterOptions): SqliteDatabaseAdapter;
//# sourceMappingURL=adapter.d.ts.map