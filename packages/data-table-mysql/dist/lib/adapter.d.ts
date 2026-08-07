import type { DataManipulationRequest, DataManipulationResult, DataManipulationOperation, DatabaseAdapter, SqlStatement, TableRef, TransactionOptions, TransactionToken } from '@remix-run/data-table';
import type { Connection as MysqlConnection, Pool as MysqlPool, PoolConnection as MysqlPoolConnection, PoolOptions as MysqlPoolOptions } from 'mysql2/promise';
type MysqlTransactionConnection = MysqlConnection | MysqlPoolConnection;
type MysqlQueryable = MysqlPool | MysqlTransactionConnection;
/** Database creation options used when wiping a config-backed MySQL adapter. */
export interface MysqlDatabaseAdapterOptions {
    /** Character set assigned to the recreated database. */
    characterSet?: string;
    /** Collation assigned to the recreated database. */
    collation?: string;
}
/**
 * `DatabaseAdapter` implementation for mysql-compatible clients.
 */
export declare class MysqlDatabaseAdapter implements DatabaseAdapter {
    #private;
    /**
     * The SQL dialect identifier reported by this adapter.
     */
    dialect: string;
    /**
     * Feature flags describing the mysql behaviors supported by this adapter.
     */
    capabilities: {
        returning: boolean;
        savepoints: boolean;
        upsert: boolean;
        transactionalDdl: boolean;
        migrationLock: boolean;
    };
    constructor(config: string | MysqlPoolOptions | MysqlQueryable, options?: MysqlDatabaseAdapterOptions);
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
    withMigrationLock<result>(name: string, run: (adapter: DatabaseAdapter) => Promise<result>): Promise<result>;
}
/**
 * Creates a mysql `DatabaseAdapter`.
 * @param input Mysql connection string, pool options, pool, or connection.
 * @param options Database creation options used by `wipe()`.
 * @returns A configured mysql adapter.
 * @example
 * ```ts
 * import { createDatabase } from 'remix/data-table'
 * import { createMysqlDatabaseAdapter } from 'remix/data-table/mysql'
 *
 * let adapter = createMysqlDatabaseAdapter(process.env.DATABASE_URL!)
 * let db = createDatabase(adapter)
 * ```
 */
export declare function createMysqlDatabaseAdapter(input: string | MysqlPoolOptions | MysqlQueryable, options?: MysqlDatabaseAdapterOptions): MysqlDatabaseAdapter;
export {};
//# sourceMappingURL=adapter.d.ts.map