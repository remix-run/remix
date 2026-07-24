import { DatabaseImplementation, } from '@remix-run/data-table/database-implementation';
import { AsyncLocalStorage } from 'node:async_hooks';
import { getTablePrimaryKey } from '@remix-run/data-table';
import pg from 'pg';
import { compilePostgresOperation } from "./sql-compiler.js";
const postgresCapabilities = Object.freeze({
    returning: true,
    savepoints: true,
    upsert: true,
    transactionalDdl: true,
    migrationLock: true,
});
/**
 * PostgreSQL database implementation for postgres-compatible clients.
 */
export class PostgresDatabaseImplementation extends DatabaseImplementation {
    /**
     * The SQL dialect identifier reported by this database.
     */
    get dialect() {
        return 'postgres';
    }
    /**
     * Feature flags describing the PostgreSQL behaviors supported by this database.
     */
    get capabilities() {
        return postgresCapabilities;
    }
    #config;
    #client;
    #maintenanceDatabase;
    #template;
    #transactions = new Map();
    #transactionCounter = 0;
    #migrationLockQueue = Promise.resolve();
    #migrationLockStore = new AsyncLocalStorage();
    #poolClosed = false;
    constructor(config, options = {}) {
        super(options);
        if (isPostgresQueryable(config)) {
            this.#client = config;
        }
        else {
            this.#config = config;
            this.#client = new pg.Pool(config);
        }
        this.#maintenanceDatabase = options.maintenanceDatabase ?? 'postgres';
        this.#template = options.template ?? 'template0';
    }
    /**
     * Compiles a data-manipulation operation to postgres SQL statements.
     * @param operation Operation to compile.
     * @returns Compiled SQL statements.
     */
    compileSql(operation) {
        let compiled = compilePostgresOperation(operation);
        return [{ text: compiled.text, values: compiled.values }];
    }
    /**
     * Executes a postgres data-manipulation request.
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
        let statement = compilePostgresOperation(request.operation);
        let client = this.#resolveClient(request.transaction);
        let result = await client.query(statement.text, statement.values);
        let rows = normalizeRows(result.rows);
        if (request.operation.kind === 'count' || request.operation.kind === 'exists') {
            rows = normalizeCountRows(rows);
        }
        return {
            rows,
            affectedRows: normalizeAffectedRows(request.operation.kind, result.rowCount, rows),
            insertId: normalizeInsertId(request.operation.kind, request.operation, rows),
        };
    }
    /**
     * Executes a multi-statement postgres SQL script.
     *
     * Postgres natively supports multi-statement scripts when `query` is called
     * without a parameter array.
     * @param sql SQL script to execute.
     * @param transaction Optional transaction token.
     * @returns A promise that resolves once execution completes.
     */
    async executeScript(sql, transaction) {
        let client = this.#resolveClient(transaction);
        await client.query(sql);
    }
    /**
     * Checks whether a table exists in postgres.
     * @param table Table reference to inspect.
     * @param transaction Optional transaction token.
     * @returns `true` when the table exists.
     */
    async hasTable(table, transaction) {
        let relation = toPostgresRelationName(table);
        let client = this.#resolveClient(transaction);
        let result = await client.query('select to_regclass($1) is not null as "exists"', [relation]);
        let row = result.rows[0];
        return toBooleanExists(row?.exists);
    }
    /**
     * Checks whether a column exists in postgres.
     * @param table Table reference to inspect.
     * @param column Column name to look up.
     * @param transaction Optional transaction token.
     * @returns `true` when the column exists.
     */
    async hasColumn(table, column, transaction) {
        let relation = toPostgresRelationName(table);
        let client = this.#resolveClient(transaction);
        let result = await client.query('select exists (select 1 from pg_attribute where attrelid = to_regclass($1) and attname = $2 and attnum > 0 and not attisdropped) as "exists"', [relation, column]);
        let row = result.rows[0];
        return toBooleanExists(row?.exists);
    }
    /**
     * Starts a postgres transaction.
     * @param options Transaction options.
     * @returns Transaction token.
     */
    async beginTransaction(options) {
        let releaseOnClose = false;
        let transactionClient;
        if (isPostgresPool(this.#client)) {
            transactionClient = await this.#client.connect();
            releaseOnClose = true;
        }
        else {
            transactionClient = this.#client;
        }
        try {
            await transactionClient.query('begin');
            if (options?.isolationLevel || options?.readOnly !== undefined) {
                await transactionClient.query(buildSetTransactionStatement(options));
            }
        }
        catch (error) {
            if (releaseOnClose) {
                destroyPostgresClient(transactionClient, error);
            }
            throw error;
        }
        this.#transactionCounter += 1;
        let token = { id: 'tx_' + String(this.#transactionCounter) };
        this.#transactions.set(token.id, {
            client: transactionClient,
            releaseOnClose,
        });
        return token;
    }
    /**
     * Commits an open postgres transaction.
     * @param token Transaction token to commit.
     * @returns A promise that resolves when the transaction is committed.
     */
    async commitTransaction(token) {
        let transaction = this.#transactions.get(token.id);
        if (!transaction) {
            throw new Error('Unknown transaction token: ' + token.id);
        }
        let failure;
        try {
            await transaction.client.query('commit');
        }
        catch (error) {
            failure = error;
            throw error;
        }
        finally {
            this.#transactions.delete(token.id);
            if (transaction.releaseOnClose) {
                if (failure === undefined) {
                    releasePostgresClient(transaction.client);
                }
                else {
                    destroyPostgresClient(transaction.client, failure);
                }
            }
        }
    }
    /**
     * Rolls back an open postgres transaction.
     * @param token Transaction token to roll back.
     * @returns A promise that resolves when the transaction is rolled back.
     */
    async rollbackTransaction(token) {
        let transaction = this.#transactions.get(token.id);
        if (!transaction) {
            throw new Error('Unknown transaction token: ' + token.id);
        }
        let failure;
        try {
            await transaction.client.query('rollback');
        }
        catch (error) {
            failure = error;
            throw error;
        }
        finally {
            this.#transactions.delete(token.id);
            if (transaction.releaseOnClose) {
                if (failure === undefined) {
                    releasePostgresClient(transaction.client);
                }
                else {
                    destroyPostgresClient(transaction.client, failure);
                }
            }
        }
    }
    /**
     * Creates a savepoint in an open postgres transaction.
     * @param token Transaction token to use.
     * @param name Savepoint name.
     * @returns A promise that resolves when the savepoint is created.
     */
    async createSavepoint(token, name) {
        let client = this.#transactionClient(token);
        await client.query('savepoint ' + quoteIdentifier(name));
    }
    /**
     * Rolls back to a savepoint in an open postgres transaction.
     * @param token Transaction token to use.
     * @param name Savepoint name.
     * @returns A promise that resolves when the rollback completes.
     */
    async rollbackToSavepoint(token, name) {
        let client = this.#transactionClient(token);
        await client.query('rollback to savepoint ' + quoteIdentifier(name));
    }
    /**
     * Releases a savepoint in an open postgres transaction.
     * @param token Transaction token to use.
     * @param name Savepoint name.
     * @returns A promise that resolves when the savepoint is released.
     */
    async releaseSavepoint(token, name) {
        let client = this.#transactionClient(token);
        await client.query('release savepoint ' + quoteIdentifier(name));
    }
    /**
     * Destructively recreates the configured PostgreSQL database.
     * @returns A promise that resolves when the database is ready for use.
     */
    async wipe() {
        let config = this.#configOrThrow('wipe');
        this.#assertNoOpenTransactions('wipe');
        let database = resolvePostgresDatabaseName(config);
        // Resolve the maintenance config before closing the pool so a config
        // error cannot leave the database without a usable pool.
        let maintenanceConfig = this.#maintenanceConfig(database);
        await this.#closePool();
        let maintenance;
        try {
            maintenance = new pg.Client(maintenanceConfig);
            await maintenance.connect();
            await maintenance.query('select pg_terminate_backend(pid) from pg_stat_activity where datname = $1 and pid <> pg_backend_pid()', [database]);
            await maintenance.query('drop database if exists ' + quoteIdentifier(database));
            await maintenance.query('create database ' +
                quoteIdentifier(database) +
                ' template ' +
                quoteIdentifier(this.#template));
        }
        finally {
            try {
                await maintenance?.end();
            }
            finally {
                await this.#replacePool();
            }
        }
    }
    /** Closes a pool created from configuration. Supplied clients and pools remain caller-owned. */
    async close() {
        this.#assertNoOpenTransactions('close');
        if (this.#config) {
            await this.#closePool();
        }
    }
    /**
     * Runs migration work on the postgres connection that owns the advisory lock.
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
            throw new Error('Postgres migration lock is already held by this database');
        }
        let waitForPreviousLock = this.#migrationLockQueue;
        let releaseQueue = () => undefined;
        this.#migrationLockQueue = new Promise((resolve) => {
            releaseQueue = resolve;
        });
        await waitForPreviousLock;
        try {
            let releaseOnClose = false;
            let client;
            if (isPostgresPool(this.#client)) {
                client = await this.#client.connect();
                releaseOnClose = true;
            }
            else {
                client = this.#client;
            }
            let adapter = releaseOnClose ? new PostgresDatabaseImplementation(client) : this;
            try {
                let value = await this.#migrationLockStore.run(true, () => runWithPostgresMigrationLock(client, name, adapter, run));
                if (releaseOnClose) {
                    releasePostgresClient(client);
                }
                return value;
            }
            catch (error) {
                // A failed run can leave the reserved session dirty (aborted
                // transaction, still-held advisory lock), so destroy the connection
                // instead of returning it to the pool.
                if (releaseOnClose) {
                    destroyPostgresClient(client, error);
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
        // pg pools reject end() when called twice, so ending must be tracked to
        // keep close() idempotent.
        if (isPostgresPool(this.#client) && !this.#poolClosed) {
            this.#poolClosed = true;
            await this.#client.end();
        }
    }
    #configOrThrow(method) {
        if (!this.#config) {
            throw new Error('Postgres database ' + method + '() requires config-based construction');
        }
        return this.#config;
    }
    #assertNoOpenTransactions(method) {
        if (this.#transactions.size > 0) {
            throw new Error('Postgres database cannot ' + method + ' while transactions are open');
        }
    }
    #maintenanceConfig(targetDatabase) {
        let maintenanceDatabase = this.#maintenanceDatabase;
        if (maintenanceDatabase === targetDatabase) {
            maintenanceDatabase = targetDatabase === 'postgres' ? 'template1' : 'postgres';
        }
        let config = this.#configOrThrow('maintenance');
        let connectionString = replaceDatabaseInConnectionString(config?.connectionString, maintenanceDatabase);
        return { ...config, connectionString, database: maintenanceDatabase };
    }
    async #replacePool() {
        await this.#closePool().catch(() => undefined);
        if (this.#config) {
            this.#client = new pg.Pool(this.#config);
            this.#poolClosed = false;
        }
    }
    #resolveClient(token) {
        if (!token) {
            return this.#client;
        }
        return this.#transactionClient(token);
    }
    #transactionClient(token) {
        let transaction = this.#transactions.get(token.id);
        if (!transaction) {
            throw new Error('Unknown transaction token: ' + token.id);
        }
        return transaction.client;
    }
}
function isPostgresQueryable(value) {
    return typeof value === 'object' && value !== null && 'query' in value;
}
function isPostgresPool(client) {
    if (client instanceof pg.Client) {
        return false;
    }
    return 'connect' in client && typeof client.connect === 'function' && !('release' in client);
}
function resolvePostgresDatabaseName(config) {
    let database = resolveDatabaseNameFromConnectionString(config?.connectionString) ??
        config?.database ??
        process.env.PGDATABASE;
    if (!database) {
        throw new Error('Postgres database config requires a database name');
    }
    return database;
}
function replaceDatabaseInConnectionString(connectionString, database) {
    if (!connectionString) {
        return undefined;
    }
    let url;
    try {
        url = new URL(connectionString);
    }
    catch (cause) {
        throw new Error('Postgres connection string must be a valid URL to resolve the maintenance database', { cause });
    }
    url.pathname = '/' + encodeURIComponent(database);
    return url.toString();
}
function resolveDatabaseNameFromConnectionString(connectionString) {
    if (!connectionString) {
        return undefined;
    }
    try {
        let url = new URL(connectionString);
        let database = decodeURIComponent(url.pathname.replace(/^\//, ''));
        return database || undefined;
    }
    catch {
        return undefined;
    }
}
function releasePostgresClient(client) {
    let release = client.release;
    release?.();
}
function destroyPostgresClient(client, error) {
    let release = client.release;
    if (typeof release === 'function') {
        // A truthy argument tells pg to destroy the client instead of pooling it.
        release.call(client, error instanceof Error ? error : true);
        return;
    }
    void client.end().catch(() => undefined);
}
// Matches the 60 second wait bound used by the MySQL adapter's get_lock().
const MIGRATION_LOCK_TIMEOUT_MS = 60_000;
async function runWithPostgresMigrationLock(client, name, adapter, run) {
    await client.query('set lock_timeout to ' + String(MIGRATION_LOCK_TIMEOUT_MS));
    try {
        await client.query('select pg_advisory_lock(hashtext($1))', [name]);
    }
    catch (cause) {
        await client.query('set lock_timeout to default').catch(() => undefined);
        throw new Error('Postgres migration lock could not be acquired', { cause });
    }
    await client.query('set lock_timeout to default');
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
        let result = await client.query('select pg_advisory_unlock(hashtext($1)) as "released"', [name]);
        let row = result.rows[0];
        if (!toBooleanExists(row?.released)) {
            throw new Error('Postgres migration lock was not held by the reserved connection');
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
function buildSetTransactionStatement(options) {
    let parts = ['set transaction'];
    if (options.isolationLevel) {
        parts.push('isolation level ' + options.isolationLevel);
    }
    if (options.readOnly !== undefined) {
        parts.push(options.readOnly ? 'read only' : 'read write');
    }
    return parts.join(' ');
}
function normalizeRows(rows) {
    return rows.map((row) => {
        if (typeof row !== 'object' || row === null) {
            return {};
        }
        return { ...row };
    });
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
function normalizeAffectedRows(kind, rowCount, rows) {
    if (kind === 'select' || kind === 'count' || kind === 'exists') {
        return undefined;
    }
    if (rowCount !== null) {
        return rowCount;
    }
    if (kind === 'raw') {
        return undefined;
    }
    return rows.length;
}
function normalizeInsertId(kind, operation, rows) {
    if (!isInsertOperationKind(kind) || !isInsertOperation(operation)) {
        return undefined;
    }
    let primaryKey = getTablePrimaryKey(operation.table);
    if (primaryKey.length !== 1) {
        return undefined;
    }
    let key = primaryKey[0];
    let row = rows[rows.length - 1];
    return row ? row[key] : undefined;
}
function quoteIdentifier(value) {
    return '"' + value.replace(/"/g, '""') + '"';
}
function toPostgresRelationName(table) {
    if (table.schema) {
        return quoteIdentifier(table.schema) + '.' + quoteIdentifier(table.name);
    }
    return quoteIdentifier(table.name);
}
function toBooleanExists(value) {
    if (typeof value === 'boolean') {
        return value;
    }
    if (typeof value === 'number') {
        return value > 0;
    }
    if (typeof value === 'string') {
        return value === 't' || value === 'true' || value === '1';
    }
    return false;
}
function isInsertOperationKind(kind) {
    return kind === 'insert' || kind === 'insertMany' || kind === 'upsert';
}
function isInsertOperation(operation) {
    return (operation.kind === 'insert' || operation.kind === 'insertMany' || operation.kind === 'upsert');
}
