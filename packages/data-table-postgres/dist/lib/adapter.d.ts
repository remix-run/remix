import type { DataManipulationRequest, DataManipulationResult, DataManipulationOperation, DatabaseAdapter, SqlStatement, TableRef, TransactionOptions, TransactionToken } from '@remix-run/data-table';
import type { Client as PostgresClient, Pool as PostgresPool, PoolClient as PostgresPoolClient } from 'pg';
type PostgresQueryable = PostgresClient | PostgresPool | PostgresPoolClient;
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
    constructor(client: PostgresQueryable);
    /**
     * Compiles a data-manipulation operation to postgres SQL statements.
     * @param operation Operation to compile.
     * @returns Compiled SQL statements.
     */
    compileSql(operation: DataManipulationOperation): SqlStatement[];
    /**
     * Executes a postgres data-manipulation request.
     * @param request Request to execute.
     * @returns Execution result.
     */
    execute(request: DataManipulationRequest): Promise<DataManipulationResult>;
    /**
     * Executes a multi-statement postgres SQL script.
     *
     * Postgres natively supports multi-statement scripts when `query` is called
     * without a parameter array.
     * @param sql SQL script to execute.
     * @param transaction Optional transaction token.
     * @returns A promise that resolves once execution completes.
     */
    executeScript(sql: string, transaction?: TransactionToken): Promise<void>;
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
 * @param client `pg` pool or pool client.
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
export declare function createPostgresDatabaseAdapter(client: PostgresQueryable): PostgresDatabaseAdapter;
export {};
//# sourceMappingURL=adapter.d.ts.map