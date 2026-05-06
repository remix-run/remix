import type { DataManipulationRequest, DataManipulationResult, DataManipulationOperation, DatabaseAdapter, SqlStatement, TableRef, TransactionOptions, TransactionToken } from '@remix-run/data-table';
import type { Connection as MysqlConnection, Pool as MysqlPool, PoolConnection as MysqlPoolConnection } from 'mysql2/promise';
type MysqlTransactionConnection = MysqlConnection | MysqlPoolConnection;
type MysqlQueryable = MysqlPool | MysqlTransactionConnection;
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
    constructor(client: MysqlQueryable);
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
     * Acquires the mysql migration lock.
     * @returns A promise that resolves when the lock is acquired.
     */
    acquireMigrationLock(): Promise<void>;
    /**
     * Releases the mysql migration lock.
     * @returns A promise that resolves when the lock is released.
     */
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
export declare function createMysqlDatabaseAdapter(client: MysqlQueryable): MysqlDatabaseAdapter;
export {};
//# sourceMappingURL=adapter.d.ts.map