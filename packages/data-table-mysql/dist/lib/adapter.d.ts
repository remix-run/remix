import type { DataManipulationResult, SqlStatement, TableRef, TransactionOptions } from '@remix-run/data-table';
import { DatabaseImplementation, type DataManipulationOperation, type DataManipulationRequest, type DatabaseOptions, type MigrationLockContext, type TransactionToken } from '@remix-run/data-table/database-implementation';
import type { Connection as MysqlConnection, Pool as MysqlPool, PoolConnection as MysqlPoolConnection, PoolOptions as MysqlPoolOptions } from 'mysql2/promise';
type MysqlTransactionConnection = MysqlConnection | MysqlPoolConnection;
type MysqlQueryable = MysqlPool | MysqlTransactionConnection;
export type MysqlDatabaseInput = string | MysqlPoolOptions | MysqlQueryable;
/** Database creation options used when wiping a config-backed MySQL implementation. */
export interface MysqlDatabaseImplementationOptions extends DatabaseOptions {
    /** Character set assigned to the recreated database. */
    characterSet?: string;
    /** Collation assigned to the recreated database. */
    collation?: string;
}
/**
 * MySQL database implementation for mysql-compatible clients.
 */
export declare class MysqlDatabaseImplementation extends DatabaseImplementation {
    #private;
    /**
     * The SQL dialect identifier reported by this database.
     */
    get dialect(): 'mysql';
    /**
     * Feature flags describing the MySQL behaviors supported by this database.
     */
    get capabilities(): Readonly<{
        returning: false;
        savepoints: true;
        upsert: true;
        transactionalDdl: false;
        migrationLock: true;
    }>;
    constructor(config: MysqlDatabaseInput, options?: MysqlDatabaseImplementationOptions);
    /**
     * Compiles a data-manipulation operation to mysql SQL statements.
     * @param operation Operation to compile.
     * @returns Compiled SQL statements.
     */
    compileSql(operation: DataManipulationOperation): SqlStatement[];
    /**
     * Executes a mysql data-manipulation request.
     * @param request Request to execute.
     * @returns Execution result.
     */
    execute(request: DataManipulationRequest): Promise<DataManipulationResult>;
    /**
     * Executes a multi-statement mysql SQL script.
     *
     * mysql2 only accepts multi-statement scripts when the underlying connection
     * was created with `multipleStatements: true`.
     * @param sql SQL script to execute.
     * @param transaction Optional transaction token.
     * @returns A promise that resolves once execution completes.
     */
    executeScript(sql: string, transaction?: TransactionToken): Promise<void>;
    /**
     * Checks whether a table exists in mysql.
     * @param table Table reference to inspect.
     * @param transaction Optional transaction token.
     * @returns `true` when the table exists.
     */
    hasTable(table: TableRef, transaction?: TransactionToken): Promise<boolean>;
    /**
     * Checks whether a column exists in mysql.
     * @param table Table reference to inspect.
     * @param column Column name to look up.
     * @param transaction Optional transaction token.
     * @returns `true` when the column exists.
     */
    hasColumn(table: TableRef, column: string, transaction?: TransactionToken): Promise<boolean>;
    /**
     * Starts a mysql transaction.
     * @param options Transaction options.
     * @returns Transaction token.
     */
    beginTransaction(options?: TransactionOptions): Promise<TransactionToken>;
    /**
     * Commits an open mysql transaction.
     * @param token Transaction token to commit.
     * @returns A promise that resolves when the transaction is committed.
     */
    commitTransaction(token: TransactionToken): Promise<void>;
    /**
     * Rolls back an open mysql transaction.
     * @param token Transaction token to roll back.
     * @returns A promise that resolves when the transaction is rolled back.
     */
    rollbackTransaction(token: TransactionToken): Promise<void>;
    /**
     * Creates a savepoint in an open mysql transaction.
     * @param token Transaction token to use.
     * @param name Savepoint name.
     * @returns A promise that resolves when the savepoint is created.
     */
    createSavepoint(token: TransactionToken, name: string): Promise<void>;
    /**
     * Rolls back to a savepoint in an open mysql transaction.
     * @param token Transaction token to use.
     * @param name Savepoint name.
     * @returns A promise that resolves when the rollback completes.
     */
    rollbackToSavepoint(token: TransactionToken, name: string): Promise<void>;
    /**
     * Releases a savepoint in an open mysql transaction.
     * @param token Transaction token to use.
     * @param name Savepoint name.
     * @returns A promise that resolves when the savepoint is released.
     */
    releaseSavepoint(token: TransactionToken, name: string): Promise<void>;
    /**
     * Destructively recreates the configured MySQL database.
     * @returns A promise that resolves when the database is ready for use.
     */
    wipe(): Promise<void>;
    /** Closes a pool created from configuration. Supplied connections and pools remain caller-owned. */
    close(): Promise<void>;
    /**
     * Runs migration work on the mysql connection that owns the named lock.
     *
     * Lock acquisition waits up to 60 seconds and throws when the lock cannot
     * be acquired. Re-entering this method from inside `run` throws instead of
     * deadlocking, and a failed run destroys the reserved connection instead of
     * returning it to the pool.
     * @param name Logical migration lock name.
     * @param run Migration work to run with a connection-bound adapter.
     * @returns The callback result.
     */
    withMigrationLock<result>(name: string, run: (database: MigrationLockContext) => Promise<result>): Promise<result>;
}
export {};
//# sourceMappingURL=adapter.d.ts.map