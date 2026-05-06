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
    constructor(database: SqliteDatabase);
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
 * @param database Synchronous SQLite database client.
 * @returns A configured sqlite adapter.
 * @example
 * ```ts
 * import { DatabaseSync } from 'node:sqlite'
 * import { createDatabase } from 'remix/data-table'
 * import { createSqliteDatabaseAdapter } from 'remix/data-table-sqlite'
 *
 * let sqlite = new DatabaseSync('./data/app.db')
 * let adapter = createSqliteDatabaseAdapter(sqlite)
 * let db = createDatabase(adapter)
 * ```
 */
export declare function createSqliteDatabaseAdapter(database: SqliteDatabase): SqliteDatabaseAdapter;
//# sourceMappingURL=adapter.d.ts.map