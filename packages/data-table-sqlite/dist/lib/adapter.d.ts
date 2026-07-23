import type { DataManipulationRequest, DataManipulationResult, DataManipulationOperation, DatabaseAdapter, SqlStatement, TableRef, TransactionOptions, TransactionToken } from '@remix-run/data-table';
/**
 * Synchronous SQLite database client accepted by the sqlite adapter.
 *
 * This matches the shared surface of Node's `node:sqlite` `DatabaseSync`, Bun's `bun:sqlite`
 * `Database`, and compatible synchronous SQLite clients.
 */
export interface SqliteDatabase {
    prepare(sql: string): SqliteStatement;
    exec(sql: string): unknown;
    close?: () => void;
}
/** Configuration for an adapter-owned SQLite database. */
export interface SqliteDatabaseAdapterConfig {
    /** SQLite database filename or `:memory:` for an in-memory database. */
    filename: string;
    /**
     * Enables SQLite foreign key enforcement whenever the adapter opens the database.
     * Defaults to `false` (enforcement off) on every runtime, including Node.js where
     * `node:sqlite` would otherwise enable it by default.
     */
    foreignKeys?: boolean;
    /**
     * SQLite `busy_timeout` in milliseconds, applied whenever the adapter opens the database.
     * Defaults to `5000`. Set `0` to fail immediately when another process holds a write lock.
     */
    busyTimeout?: number;
}
/**
 * Prepared statement shape used by {@link SqliteDatabase}.
 */
export interface SqliteStatement {
    all(...values: unknown[]): unknown[];
    get(...values: unknown[]): unknown;
    run(...values: unknown[]): SqliteRunResult;
    reader?: boolean;
    columns?: () => unknown[];
    columnNames?: string[];
}
/**
 * SQLite write execution metadata.
 */
export interface SqliteRunResult {
    changes: number | bigint;
    lastInsertRowid: unknown;
}
/**
 * `DatabaseAdapter` implementation for synchronous SQLite clients.
 */
export declare class SqliteDatabaseAdapter implements DatabaseAdapter {
    #private;
    /**
     * The SQL dialect identifier reported by this adapter.
     */
    dialect: string;
    /**
     * Feature flags describing the sqlite behaviors supported by this adapter.
     */
    capabilities: {
        returning: boolean;
        savepoints: boolean;
        upsert: boolean;
        transactionalDdl: boolean;
        migrationLock: boolean;
    };
    constructor(input: SqliteDatabase | SqliteDatabaseAdapterConfig);
    /**
     * Compiles a data-manipulation operation to sqlite SQL statements.
     * @param operation Operation to compile.
     * @returns Compiled SQL statements.
     */
    compileSql(operation: DataManipulationOperation): SqlStatement[];
    /**
     * Executes a sqlite data-manipulation request.
     * @param request Request to execute.
     * @returns Execution result.
     */
    execute(request: DataManipulationRequest): Promise<DataManipulationResult>;
    /**
     * Executes a multi-statement sqlite SQL script.
     * @param sql SQL script to execute.
     * @param transaction Optional transaction token (asserted when present).
     * @returns A promise that resolves once execution completes.
     */
    executeScript(sql: string, transaction?: TransactionToken): Promise<void>;
    /**
     * Checks whether a table exists in sqlite.
     * @param table Table reference to inspect.
     * @param transaction Optional transaction token.
     * @returns `true` when the table exists.
     */
    hasTable(table: TableRef, transaction?: TransactionToken): Promise<boolean>;
    /**
     * Checks whether a column exists in sqlite.
     * @param table Table reference to inspect.
     * @param column Column name to look up.
     * @param transaction Optional transaction token.
     * @returns `true` when the column exists.
     */
    hasColumn(table: TableRef, column: string, transaction?: TransactionToken): Promise<boolean>;
    /**
     * Destructively recreates the configured SQLite database.
     * @returns A promise that resolves when the database is ready for use.
     */
    wipe(): Promise<void>;
    /**
     * Closes the underlying database connection and releases its file handle.
     *
     * Config-backed adapters keep an open handle that locks the database file on
     * Windows until it is closed, so callers that need to move or delete the file
     * should close the adapter first. Safe to call more than once.
     */
    close(): void;
    /**
     * Starts a sqlite transaction.
     * @param options Transaction options.
     * @returns Transaction token.
     */
    beginTransaction(options?: TransactionOptions): Promise<TransactionToken>;
    /**
     * Commits an open sqlite transaction.
     * @param token Transaction token to commit.
     * @returns A promise that resolves when the transaction is committed.
     */
    commitTransaction(token: TransactionToken): Promise<void>;
    /**
     * Rolls back an open sqlite transaction.
     * @param token Transaction token to roll back.
     * @returns A promise that resolves when the transaction is rolled back.
     */
    rollbackTransaction(token: TransactionToken): Promise<void>;
    /**
     * Creates a savepoint in an open sqlite transaction.
     * @param token Transaction token to use.
     * @param name Savepoint name.
     * @returns A promise that resolves when the savepoint is created.
     */
    createSavepoint(token: TransactionToken, name: string): Promise<void>;
    /**
     * Rolls back to a savepoint in an open sqlite transaction.
     * @param token Transaction token to use.
     * @param name Savepoint name.
     * @returns A promise that resolves when the rollback completes.
     */
    rollbackToSavepoint(token: TransactionToken, name: string): Promise<void>;
    /**
     * Releases a savepoint in an open sqlite transaction.
     * @param token Transaction token to use.
     * @param name Savepoint name.
     * @returns A promise that resolves when the savepoint is released.
     */
    releaseSavepoint(token: TransactionToken, name: string): Promise<void>;
}
/**
 * Creates a sqlite `DatabaseAdapter`.
 * @param input SQLite adapter configuration or synchronous database client.
 * @returns A configured sqlite adapter.
 * @example
 * ```ts
 * import { createDatabase } from 'remix/data-table'
 * import { createSqliteDatabaseAdapter } from 'remix/data-table/sqlite'
 *
 * let adapter = createSqliteDatabaseAdapter({ filename: './data/app.db' })
 * let db = createDatabase(adapter)
 * ```
 */
export declare function createSqliteDatabaseAdapter(input: SqliteDatabase | SqliteDatabaseAdapterConfig): SqliteDatabaseAdapter;
//# sourceMappingURL=adapter.d.ts.map