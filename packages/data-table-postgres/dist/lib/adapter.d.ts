import type { AdapterCapabilityOverrides, DataMigrationRequest, DataManipulationRequest, DataMigrationResult, DataMigrationOperation, DataManipulationResult, DataManipulationOperation, DatabaseAdapter, SqlStatement, TableRef, TransactionOptions, TransactionToken } from '@remix-run/data-table';
type Pretty<value> = {
    [key in keyof value]: value[key];
} & {};
/**
 * Result shape returned by postgres client `query()` calls.
 */
export type PostgresQueryResult = {
    rows: unknown[];
    rowCount: number | null;
};
/**
 * Minimal postgres client contract used by this adapter.
 */
export type PostgresDatabaseClient = {
    query(text: string, values?: unknown[]): Promise<PostgresQueryResult>;
};
/**
 * Postgres transaction client with optional connection release support.
 */
export type PostgresTransactionClient = Pretty<PostgresDatabaseClient & {
    release?: () => void;
}>;
/**
 * Postgres pool-like client contract used by this adapter.
 */
export type PostgresDatabasePool = Pretty<PostgresDatabaseClient & {
    connect?: () => Promise<PostgresTransactionClient>;
}>;
/**
 * Postgres adapter configuration.
 */
export type PostgresDatabaseAdapterOptions = {
    capabilities?: AdapterCapabilityOverrides;
};
/**
 * `DatabaseAdapter` implementation for postgres-compatible clients.
 */
export declare class PostgresDatabaseAdapter implements DatabaseAdapter {
    #private;
    dialect: string;
    capabilities: {
        returning: boolean;
        savepoints: boolean;
        upsert: boolean;
        transactionalDdl: boolean;
        migrationLock: boolean;
    };
    constructor(client: PostgresDatabasePool, options?: PostgresDatabaseAdapterOptions);
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
 * Creates a postgres `DatabaseAdapter`.
 * @param client Postgres pool or client.
 * @param options Optional adapter capability overrides.
 * @returns A configured postgres adapter.
 * @example
 * ```ts
 * import { Pool } from 'pg'
 * import { createDatabase } from 'remix/data-table'
 * import { createPostgresDatabaseAdapter } from 'remix/data-table-postgres'
 *
 * let pool = new Pool({ connectionString: process.env.DATABASE_URL })
 * let adapter = createPostgresDatabaseAdapter(pool)
 * let db = createDatabase(adapter)
 * ```
 */
export declare function createPostgresDatabaseAdapter(client: PostgresDatabasePool, options?: PostgresDatabaseAdapterOptions): PostgresDatabaseAdapter;
export {};
//# sourceMappingURL=adapter.d.ts.map