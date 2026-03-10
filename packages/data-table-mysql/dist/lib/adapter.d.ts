import type { AdapterCapabilityOverrides, DataManipulationRequest, DataMigrationRequest, DataMigrationResult, DataMigrationOperation, DataManipulationResult, DataManipulationOperation, DatabaseAdapter, SqlStatement, TableRef, TransactionOptions, TransactionToken } from '@remix-run/data-table';
/**
 * Row-array response shape for mysql query calls.
 */
export type MysqlQueryRows = Record<string, unknown>[];
/**
 * Metadata shape for mysql write results.
 */
export type MysqlQueryResultHeader = {
    affectedRows: number;
    insertId: unknown;
};
/**
 * Supported mysql `query()` response tuple.
 */
export type MysqlQueryResponse = [result: unknown, fields?: unknown];
/**
 * Single mysql connection contract used by this adapter.
 */
export type MysqlDatabaseConnection = {
    query(text: string, values?: unknown[]): Promise<MysqlQueryResponse>;
    beginTransaction(): Promise<void>;
    commit(): Promise<void>;
    rollback(): Promise<void>;
    release?: () => void;
};
/**
 * Mysql pool contract used by this adapter.
 */
export type MysqlDatabasePool = {
    query(text: string, values?: unknown[]): Promise<MysqlQueryResponse>;
    getConnection(): Promise<MysqlDatabaseConnection>;
};
/**
 * Mysql adapter configuration.
 */
export type MysqlDatabaseAdapterOptions = {
    capabilities?: AdapterCapabilityOverrides;
};
type MysqlQueryable = MysqlDatabasePool | MysqlDatabaseConnection;
/**
 * `DatabaseAdapter` implementation for mysql-compatible clients.
 */
export declare class MysqlDatabaseAdapter implements DatabaseAdapter {
    #private;
    dialect: string;
    capabilities: {
        returning: boolean;
        savepoints: boolean;
        upsert: boolean;
        transactionalDdl: boolean;
        migrationLock: boolean;
    };
    constructor(client: MysqlQueryable, options?: MysqlDatabaseAdapterOptions);
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
    acquireMigrationLock(): Promise<void>;
    releaseMigrationLock(): Promise<void>;
}
/**
 * Creates a mysql `DatabaseAdapter`.
 * @param client Mysql pool or connection.
 * @param options Optional adapter capability overrides.
 * @returns A configured mysql adapter.
 * @example
 * ```ts
 * import { createPool } from 'mysql2/promise'
 * import { createDatabase } from 'remix/data-table'
 * import { createMysqlDatabaseAdapter } from 'remix/data-table-mysql'
 *
 * let pool = createPool({ uri: process.env.DATABASE_URL })
 * let adapter = createMysqlDatabaseAdapter(pool)
 * let db = createDatabase(adapter)
 * ```
 */
export declare function createMysqlDatabaseAdapter(client: MysqlQueryable, options?: MysqlDatabaseAdapterOptions): MysqlDatabaseAdapter;
export {};
//# sourceMappingURL=adapter.d.ts.map