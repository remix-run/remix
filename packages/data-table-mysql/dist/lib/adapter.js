import { AsyncLocalStorage } from 'node:async_hooks';
import { getTablePrimaryKey } from '@remix-run/data-table';
import mysql from 'mysql2/promise';
import { compileMysqlOperation } from "./sql-compiler.js";
/**
 * `DatabaseAdapter` implementation for mysql-compatible clients.
 */
export class MysqlDatabaseAdapter {
    /**
     * The SQL dialect identifier reported by this adapter.
     */
    dialect = 'mysql';
    /**
     * Feature flags describing the mysql behaviors supported by this adapter.
     */
    capabilities;
    #config;
    #client;
    #characterSet;
    #collation;
    #transactions = new Map();
    #transactionCounter = 0;
    #migrationLockQueue = Promise.resolve();
    #migrationLockStore = new AsyncLocalStorage();
    constructor(config, options = {}) {
        if (isMysqlQueryable(config)) {
            this.#client = config;
        }
        else {
            this.#config = config;
            this.#client = createMysqlPool(config);
        }
        this.#characterSet = options.characterSet;
        this.#collation = options.collation;
        this.capabilities = {
            returning: false,
            savepoints: true,
            upsert: true,
            transactionalDdl: false,
            migrationLock: true,
        };
    }
    /**
     * Compiles a data-manipulation operation to mysql SQL statements.
     * @param operation Operation to compile.
     * @returns Compiled SQL statements.
     */
    compileSql(operation) {
        let compiled = compileMysqlOperation(operation);
        return [{ text: compiled.text, values: compiled.values }];
    }
    /**
     * Executes a mysql data-manipulation request.
     * @param request Request to execute.
     * @returns Execution result.
     */
    async execute(request) {
        if (request.operation.kind === 'insertMany' && request.operation.values.length === 0) {
            return {
                affectedRows: 0,
                insertId: undefined,
                rows: request.operation.returning ? [] : undefined,
            };
        }
        let statements = this.compileSql(request.operation);
        let statement = statements[0];
        let client = this.#resolveClient(request.transaction);
        let [result] = await client.query(statement.text, statement.values);
        if (isRowsResult(result)) {
            let rows = normalizeRows(result);
            if (request.operation.kind === 'count' || request.operation.kind === 'exists') {
                rows = normalizeCountRows(rows);
            }
            return { rows };
        }
        let header = normalizeHeader(result);
        return {
            affectedRows: header.affectedRows,
            insertId: normalizeInsertId(request.operation.kind, request.operation, header),
        };
    }
    /**
     * Executes a multi-statement mysql SQL script.
     *
     * mysql2 only accepts multi-statement scripts when the underlying connection
     * was created with `multipleStatements: true`.
     * @param sql SQL script to execute.
     * @param transaction Optional transaction token.
     * @returns A promise that resolves once execution completes.
     */
    async executeScript(sql, transaction) {
        let client = this.#resolveClient(transaction);
        await client.query(sql);
    }
    /**
     * Checks whether a table exists in mysql.
     * @param table Table reference to inspect.
     * @param transaction Optional transaction token.
     * @returns `true` when the table exists.
     */
    async hasTable(table, transaction) {
        let schema = table.schema;
        let sql = schema
            ? 'select exists(select 1 from information_schema.tables where table_schema = ? and table_name = ?) as `exists`'
            : 'select exists(select 1 from information_schema.tables where table_schema = database() and table_name = ?) as `exists`';
        let values = schema ? [schema, table.name] : [table.name];
        let client = this.#resolveClient(transaction);
        let [result] = await client.query(sql, values);
        if (!isRowsResult(result)) {
            return false;
        }
        return toBooleanExists(result[0]?.exists);
    }
    /**
     * Checks whether a column exists in mysql.
     * @param table Table reference to inspect.
     * @param column Column name to look up.
     * @param transaction Optional transaction token.
     * @returns `true` when the column exists.
     */
    async hasColumn(table, column, transaction) {
        let schema = table.schema;
        let sql = schema
            ? 'select exists(select 1 from information_schema.columns where table_schema = ? and table_name = ? and column_name = ?) as `exists`'
            : 'select exists(select 1 from information_schema.columns where table_schema = database() and table_name = ? and column_name = ?) as `exists`';
        let values = schema ? [schema, table.name, column] : [table.name, column];
        let client = this.#resolveClient(transaction);
        let [result] = await client.query(sql, values);
        if (!isRowsResult(result)) {
            return false;
        }
        return toBooleanExists(result[0]?.exists);
    }
    /**
     * Starts a mysql transaction.
     * @param options Transaction options.
     * @returns Transaction token.
     */
    async beginTransaction(options) {
        let releaseOnClose = false;
        let connection;
        if (isMysqlPool(this.#client)) {
            connection = await this.#client.getConnection();
            releaseOnClose = true;
        }
        else {
            connection = this.#client;
        }
        if (options?.isolationLevel) {
            await connection.query('set transaction isolation level ' + options.isolationLevel);
        }
        if (options?.readOnly !== undefined) {
            await connection.query(options.readOnly ? 'set transaction read only' : 'set transaction read write');
        }
        await connection.beginTransaction();
        this.#transactionCounter += 1;
        let token = { id: 'tx_' + String(this.#transactionCounter) };
        this.#transactions.set(token.id, {
            connection,
            releaseOnClose,
        });
        return token;
    }
    /**
     * Commits an open mysql transaction.
     * @param token Transaction token to commit.
     * @returns A promise that resolves when the transaction is committed.
     */
    async commitTransaction(token) {
        let transaction = this.#transactions.get(token.id);
        if (!transaction) {
            throw new Error('Unknown transaction token: ' + token.id);
        }
        try {
            await transaction.connection.commit();
        }
        finally {
            this.#transactions.delete(token.id);
            if (transaction.releaseOnClose && isMysqlPoolConnection(transaction.connection)) {
                transaction.connection.release();
            }
        }
    }
    /**
     * Rolls back an open mysql transaction.
     * @param token Transaction token to roll back.
     * @returns A promise that resolves when the transaction is rolled back.
     */
    async rollbackTransaction(token) {
        let transaction = this.#transactions.get(token.id);
        if (!transaction) {
            throw new Error('Unknown transaction token: ' + token.id);
        }
        try {
            await transaction.connection.rollback();
        }
        finally {
            this.#transactions.delete(token.id);
            if (transaction.releaseOnClose && isMysqlPoolConnection(transaction.connection)) {
                transaction.connection.release();
            }
        }
    }
    /**
     * Creates a savepoint in an open mysql transaction.
     * @param token Transaction token to use.
     * @param name Savepoint name.
     * @returns A promise that resolves when the savepoint is created.
     */
    async createSavepoint(token, name) {
        let connection = this.#transactionConnection(token);
        await connection.query('savepoint ' + quoteIdentifier(name));
    }
    /**
     * Rolls back to a savepoint in an open mysql transaction.
     * @param token Transaction token to use.
     * @param name Savepoint name.
     * @returns A promise that resolves when the rollback completes.
     */
    async rollbackToSavepoint(token, name) {
        let connection = this.#transactionConnection(token);
        await connection.query('rollback to savepoint ' + quoteIdentifier(name));
    }
    /**
     * Releases a savepoint in an open mysql transaction.
     * @param token Transaction token to use.
     * @param name Savepoint name.
     * @returns A promise that resolves when the savepoint is released.
     */
    async releaseSavepoint(token, name) {
        let connection = this.#transactionConnection(token);
        await connection.query('release savepoint ' + quoteIdentifier(name));
    }
    /**
     * Destructively recreates the configured MySQL database.
     * @returns A promise that resolves when the database is ready for use.
     */
    async wipe() {
        let config = this.#configOrThrow('wipe');
        this.#assertNoOpenTransactions('wipe');
        let database = resolveMysqlDatabaseName(config);
        await this.#closePool();
        let connection;
        try {
            connection = await createMysqlConnection(toMysqlServerConfig(config));
            await connection.query('drop database if exists ' + quoteIdentifier(database));
            let sql = 'create database ' + quoteIdentifier(database);
            if (this.#characterSet) {
                sql += ' character set ' + quoteIdentifier(this.#characterSet);
            }
            if (this.#collation) {
                sql += ' collate ' + quoteIdentifier(this.#collation);
            }
            await connection.query(sql);
        }
        finally {
            try {
                await connection?.end();
            }
            finally {
                await this.#replacePool();
            }
        }
    }
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
    async withMigrationLock(name, run) {
        if (this.#migrationLockStore.getStore()) {
            throw new Error('MySQL migration lock is already held by this adapter');
        }
        let waitForPreviousLock = this.#migrationLockQueue;
        let releaseQueue = () => undefined;
        this.#migrationLockQueue = new Promise((resolve) => {
            releaseQueue = resolve;
        });
        await waitForPreviousLock;
        try {
            let releaseOnClose = false;
            let connection;
            if (isMysqlPool(this.#client)) {
                connection = await this.#client.getConnection();
                releaseOnClose = true;
            }
            else {
                connection = this.#client;
            }
            let adapter = releaseOnClose ? new MysqlDatabaseAdapter(connection) : this;
            try {
                let value = await this.#migrationLockStore.run(true, () => runWithMysqlMigrationLock(connection, name, adapter, run));
                if (releaseOnClose && isMysqlPoolConnection(connection)) {
                    connection.release();
                }
                return value;
            }
            catch (error) {
                // A failed run can leave the reserved connection dirty (open
                // transaction, still-held named lock), so destroy the connection
                // instead of returning it to the pool.
                if (releaseOnClose) {
                    destroyMysqlConnection(connection);
                }
                throw error;
            }
        }
        finally {
            releaseQueue();
        }
    }
    async #closePool() {
        this.#transactions.clear();
        if (isMysqlPool(this.#client)) {
            await this.#client.end();
        }
    }
    async #replacePool() {
        await this.#closePool().catch(() => undefined);
        if (this.#config) {
            this.#client = createMysqlPool(this.#config);
        }
    }
    #configOrThrow(method) {
        if (!this.#config) {
            throw new Error('MySQL adapter ' + method + '() requires config-based construction');
        }
        return this.#config;
    }
    #assertNoOpenTransactions(method) {
        if (this.#transactions.size > 0) {
            throw new Error('MySQL adapter cannot ' + method + ' while transactions are open');
        }
    }
    #resolveClient(token) {
        if (!token) {
            return this.#client;
        }
        return this.#transactionConnection(token);
    }
    #transactionConnection(token) {
        let transaction = this.#transactions.get(token.id);
        if (!transaction) {
            throw new Error('Unknown transaction token: ' + token.id);
        }
        return transaction.connection;
    }
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
export function createMysqlDatabaseAdapter(input, options) {
    return new MysqlDatabaseAdapter(input, options);
}
function isMysqlQueryable(value) {
    return typeof value === 'object' && value !== null && 'query' in value;
}
function createMysqlPool(config) {
    return typeof config === 'string' ? mysql.createPool(config) : mysql.createPool(config);
}
function createMysqlConnection(config) {
    return typeof config === 'string'
        ? mysql.createConnection(config)
        : mysql.createConnection(config);
}
function isMysqlPool(client) {
    return 'getConnection' in client && typeof client.getConnection === 'function';
}
function resolveMysqlDatabaseName(config) {
    let database = typeof config === 'string'
        ? resolveDatabaseNameFromUrl(config)
        : (config.database ?? resolveDatabaseNameFromUrl(config.uri ?? ''));
    if (!database) {
        throw new Error('MySQL database config requires a database name');
    }
    return database;
}
function resolveDatabaseNameFromUrl(value) {
    try {
        let url = new URL(value);
        let database = decodeURIComponent(url.pathname.replace(/^\//, ''));
        return database || undefined;
    }
    catch {
        return undefined;
    }
}
function toMysqlServerConfig(config) {
    if (typeof config === 'string') {
        try {
            let url = new URL(config);
            url.pathname = '/';
            return url.toString();
        }
        catch {
            return config;
        }
    }
    // Pool-only options make mysql2's createConnection() log "Ignoring invalid
    // configuration option" warnings, so strip them from the maintenance
    // connection config.
    let { database: _database, uri, connectionLimit: _connectionLimit, maxIdle: _maxIdle, idleTimeout: _idleTimeout, queueLimit: _queueLimit, waitForConnections: _waitForConnections, ...serverConfig } = config;
    if (uri === undefined) {
        return serverConfig;
    }
    return { ...serverConfig, uri: removeDatabaseFromUrl(uri) };
}
function removeDatabaseFromUrl(value) {
    try {
        let url = new URL(value);
        url.pathname = '/';
        return url.toString();
    }
    catch {
        return value;
    }
}
function isMysqlPoolConnection(connection) {
    return 'release' in connection && typeof connection.release === 'function';
}
function destroyMysqlConnection(connection) {
    let destroy = connection.destroy;
    if (typeof destroy === 'function') {
        destroy.call(connection);
        return;
    }
    void connection.end().catch(() => undefined);
}
async function runWithMysqlMigrationLock(connection, name, adapter, run) {
    // sha2(..., 256) yields 64 hex characters, exactly GET_LOCK's 64-character
    // lock name limit, so any additional prefix must go inside the hash input.
    let [lockRows] = await connection.query("select lock_name, get_lock(lock_name, 60) as `acquired` from (select sha2(concat(coalesce(database(), ''), ':', ?), 256) as lock_name) as migration_lock", [name]);
    let lockRow = isRowsResult(lockRows) ? lockRows[0] : undefined;
    let lockName = lockRow?.lock_name;
    if (typeof lockName !== 'string' || !toBooleanExists(lockRow?.acquired)) {
        throw new Error('MySQL migration lock could not be acquired');
    }
    let outcome;
    try {
        outcome = { status: 'success', value: await run(adapter) };
    }
    catch (error) {
        outcome = { status: 'failure', error };
    }
    let unlockFailed = false;
    let unlockError;
    try {
        let [unlockRows] = await connection.query('select release_lock(?) as `released`', [lockName]);
        if (!isRowsResult(unlockRows) || !toBooleanExists(unlockRows[0]?.released)) {
            throw new Error('MySQL migration lock was not held by the reserved connection');
        }
    }
    catch (error) {
        unlockFailed = true;
        unlockError = error;
    }
    if (outcome.status === 'failure') {
        throw outcome.error;
    }
    if (unlockFailed) {
        throw unlockError;
    }
    return outcome.value;
}
function isRowsResult(result) {
    return Array.isArray(result) && (result.length === 0 || !Array.isArray(result[0]));
}
function toBooleanExists(value) {
    if (typeof value === 'boolean') {
        return value;
    }
    if (typeof value === 'number') {
        return value > 0;
    }
    if (typeof value === 'bigint') {
        return value > 0n;
    }
    if (typeof value === 'string') {
        return value === '1' || value.toLowerCase() === 'true';
    }
    return false;
}
function normalizeRows(rows) {
    return rows.map((row) => ({ ...row }));
}
function normalizeHeader(result) {
    if (typeof result === 'object' && result !== null) {
        let header = result;
        return {
            affectedRows: typeof header.affectedRows === 'number' ? header.affectedRows : 0,
            insertId: header.insertId,
        };
    }
    return {
        affectedRows: 0,
        insertId: undefined,
    };
}
function normalizeCountRows(rows) {
    return rows.map((row) => {
        let count = row.count;
        if (typeof count === 'string') {
            let numeric = Number(count);
            if (!Number.isNaN(numeric)) {
                return {
                    ...row,
                    count: numeric,
                };
            }
        }
        if (typeof count === 'bigint') {
            return {
                ...row,
                count: Number(count),
            };
        }
        return row;
    });
}
function normalizeInsertId(kind, operation, header) {
    if (!isInsertOperationKind(kind) || !isInsertOperation(operation)) {
        return undefined;
    }
    if (getTablePrimaryKey(operation.table).length !== 1) {
        return undefined;
    }
    return header.insertId;
}
function quoteIdentifier(value) {
    return '`' + value.replace(/`/g, '``') + '`';
}
function isInsertOperationKind(kind) {
    return kind === 'insert' || kind === 'insertMany' || kind === 'upsert';
}
function isInsertOperation(operation) {
    return (operation.kind === 'insert' || operation.kind === 'insertMany' || operation.kind === 'upsert');
}
