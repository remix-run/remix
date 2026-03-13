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
    /**
     * The SQL dialect identifier reported by this adapter.
     */
    dialect: string;
    /**
     * Feature flags describing the postgres behaviors supported by this adapter.
     */
    capabilities: {
        returning: boolean;
        savepoints: boolean;
        upsert: boolean;
        transactionalDdl: boolean;
        migrationLock: boolean;
    };
    constructor(client: PostgresDatabasePool, options?: PostgresDatabaseAdapterOptions);
    /**
     * Compiles a data or migration operation to postgres SQL statements.
     * @param operation Operation to compile.
     * @returns Compiled SQL statements.
     */
    compileSql(operation: DataManipulationOperation | DataMigrationOperation): SqlStatement[];
    /**
     * Executes a postgres data-manipulation request.
     * @param request Request to execute.
     * @returns Execution result.
     */
    execute(request: DataManipulationRequest): Promise<DataManipulationResult>;
    /**
     * Executes postgres migration operations.
     * @param request Migration request to execute.
     * @returns Migration result.
     */
    migrate(request: DataMigrationRequest): Promise<DataMigrationResult>;
    /**
     * Checks whether a table exists in postgres.
     * @param table Table reference to inspect.
     * @param transaction Optional transaction token.
     * @returns `true` when the table exists.
     */
    hasTable(table: TableRef, transaction?: TransactionToken): Promise<boolean>;
    /**
     * Checks whether a column exists in postgres.
     * @param table Table reference to inspect.
     * @param column Column name to look up.
     * @param transaction Optional transaction token.
     * @returns `true` when the column exists.
     */
    hasColumn(table: TableRef, column: string, transaction?: TransactionToken): Promise<boolean>;
    /**
     * Starts a postgres transaction.
     * @param options Transaction options.
     * @returns Transaction token.
     */
    beginTransaction(options?: TransactionOptions): Promise<TransactionToken>;
    /**
     * Commits an open postgres transaction.
     * @param token Transaction token to commit.
     * @returns A promise that resolves when the transaction is committed.
     */
    commitTransaction(token: TransactionToken): Promise<void>;
    /**
     * Rolls back an open postgres transaction.
     * @param token Transaction token to roll back.
     * @returns A promise that resolves when the transaction is rolled back.
     */
    rollbackTransaction(token: TransactionToken): Promise<void>;
    /**
     * Creates a savepoint in an open postgres transaction.
     * @param token Transaction token to use.
     * @param name Savepoint name.
     * @returns A promise that resolves when the savepoint is created.
     */
    createSavepoint(token: TransactionToken, name: string): Promise<void>;
    /**
     * Rolls back to a savepoint in an open postgres transaction.
     * @param token Transaction token to use.
     * @param name Savepoint name.
     * @returns A promise that resolves when the rollback completes.
     */
    rollbackToSavepoint(token: TransactionToken, name: string): Promise<void>;
    /**
     * Releases a savepoint in an open postgres transaction.
     * @param token Transaction token to use.
     * @param name Savepoint name.
     * @returns A promise that resolves when the savepoint is released.
     */
    releaseSavepoint(token: TransactionToken, name: string): Promise<void>;
    /**
     * Acquires the postgres migration lock.
     * @returns A promise that resolves when the lock is acquired.
     */
    acquireMigrationLock(): Promise<void>;
    /**
     * Releases the postgres migration lock.
     * @returns A promise that resolves when the lock is released.
     */
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