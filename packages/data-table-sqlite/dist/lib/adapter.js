import { dirname } from 'node:path';
import { mkdir, rm } from 'node:fs/promises';
import { setTimeout } from 'node:timers/promises';
import { DatabaseImplementation, } from '@remix-run/data-table/database-implementation';
import { getTablePrimaryKey } from '@remix-run/data-table';
import { compileSqliteOperation } from "./sql-compiler.js";
const sqliteCapabilities = Object.freeze({
    returning: true,
    savepoints: true,
    upsert: true,
    transactionalDdl: true,
    migrationLock: false,
});
let loadedDriverConstructor;
// The runtime driver loads lazily on config-backed construction so client-backed databases
// keep working in environments that cannot resolve node:sqlite or bun:sqlite at import time,
// and so bundlers never try to resolve those specifiers statically.
function loadSqliteDatabaseConstructor() {
    if (!loadedDriverConstructor) {
        if ('Bun' in globalThis) {
            // import.meta.require is Bun's synchronous require for ES modules; Bun does not
            // implement process.getBuiltinModule
            let importMeta = import.meta;
            let driver = importMeta.require?.('bun:sqlite');
            loadedDriverConstructor = driver?.Database;
        }
        else {
            // process.getBuiltinModule loads node:sqlite synchronously (Node.js 22.3+)
            let driver = globalThis.process?.getBuiltinModule?.('node:sqlite');
            loadedDriverConstructor = driver?.DatabaseSync;
        }
        if (!loadedDriverConstructor) {
            throw new Error('SQLite config-based construction requires node:sqlite (Node.js 22.5+) or bun:sqlite; pass a SQLite database client instead');
        }
    }
    return loadedDriverConstructor;
}
/**
 * SQLite database implementation for synchronous SQLite clients.
 */
export class SqliteDatabaseImplementation extends DatabaseImplementation {
    /**
     * The SQL dialect identifier reported by this database.
     */
    get dialect() {
        return 'sqlite';
    }
    /**
     * Feature flags describing the SQLite behaviors supported by this database.
     */
    get capabilities() {
        return sqliteCapabilities;
    }
    #config;
    #database;
    #databaseOpen = true;
    #transactions = new Set();
    #transactionCounter = 0;
    constructor(input, options) {
        super(options);
        if (isSqliteDatabase(input)) {
            this.#database = input;
        }
        else {
            this.#config = input;
            this.#database = openSqliteDatabase(input);
        }
    }
    /**
     * Compiles a data-manipulation operation to sqlite SQL statements.
     * @param operation Operation to compile.
     * @returns Compiled SQL statements.
     */
    compileSql(operation) {
        let compiled = compileSqliteOperation(operation);
        return [{ text: compiled.text, values: compiled.values }];
    }
    /**
     * Executes a sqlite data-manipulation request.
     * @param request Request to execute.
     * @returns Execution result.
     */
    async execute(request) {
        this.#assertDatabaseOpen();
        if (request.operation.kind === 'insertMany' && request.operation.values.length === 0) {
            return {
                affectedRows: 0,
                insertId: undefined,
                rows: request.operation.returning ? [] : undefined,
            };
        }
        if (request.transaction) {
            this.#assertTransaction(request.transaction);
        }
        let statement = this.compileSql(request.operation)[0];
        let prepared = this.#database.prepare(statement.text);
        let values = normalizeStatementValues(statement.values);
        if (shouldReadStatement(request.operation, prepared)) {
            let rows = normalizeRows(prepared.all(...values));
            if (request.operation.kind === 'count' || request.operation.kind === 'exists') {
                rows = normalizeCountRows(rows);
            }
            return {
                rows,
                affectedRows: normalizeAffectedRowsForReader(request.operation.kind, rows),
                insertId: normalizeInsertIdForReader(request.operation.kind, request.operation, rows),
            };
        }
        let result = prepared.run(...values);
        return {
            affectedRows: normalizeAffectedRowsForRun(request.operation.kind, result),
            insertId: normalizeInsertIdForRun(request.operation.kind, request.operation, result),
        };
    }
    /**
     * Executes a multi-statement sqlite SQL script.
     * @param sql SQL script to execute.
     * @param transaction Optional transaction token (asserted when present).
     * @returns A promise that resolves once execution completes.
     */
    async executeScript(sql, transaction) {
        this.#assertDatabaseOpen();
        if (transaction) {
            this.#assertTransaction(transaction);
        }
        this.#database.exec(sql);
    }
    /**
     * Checks whether a table exists in sqlite.
     * @param table Table reference to inspect.
     * @param transaction Optional transaction token.
     * @returns `true` when the table exists.
     */
    async hasTable(table, transaction) {
        this.#assertDatabaseOpen();
        if (transaction) {
            this.#assertTransaction(transaction);
        }
        let masterTable = table.schema
            ? quoteIdentifier(table.schema) + '.sqlite_master'
            : 'sqlite_master';
        let statement = this.#database.prepare('select 1 from ' + masterTable + ' where type = ? and name = ? limit 1');
        // node:sqlite returns `undefined` for a missing row while bun:sqlite returns `null`
        let row = statement.get('table', table.name);
        return row != null;
    }
    /**
     * Checks whether a column exists in sqlite.
     * @param table Table reference to inspect.
     * @param column Column name to look up.
     * @param transaction Optional transaction token.
     * @returns `true` when the column exists.
     */
    async hasColumn(table, column, transaction) {
        this.#assertDatabaseOpen();
        if (transaction) {
            this.#assertTransaction(transaction);
        }
        let schemaPrefix = table.schema ? quoteIdentifier(table.schema) + '.' : '';
        let statement = this.#database.prepare('pragma ' + schemaPrefix + 'table_info(' + quoteIdentifier(table.name) + ')');
        let rows = statement.all();
        return rows.some((row) => row.name === column);
    }
    /**
     * Destructively recreates the configured SQLite database.
     * @returns A promise that resolves when the database is ready for use.
     */
    async wipe() {
        let config = this.#configOrThrow('wipe');
        this.#assertNoOpenTransactions('wipe');
        this.#closeDatabase();
        if (config.filename === ':memory:') {
            this.#replaceDatabase();
            return;
        }
        try {
            await mkdir(dirname(config.filename), { recursive: true });
            await removeDatabaseFile(config.filename);
            // SQLite associates a database file with -wal/-shm/-journal sidecars by path, so
            // stale sidecars left next to a freshly created database are a corruption vector
            await removeDatabaseFile(config.filename + '-wal');
            await removeDatabaseFile(config.filename + '-shm');
            await removeDatabaseFile(config.filename + '-journal');
        }
        finally {
            this.#replaceDatabase();
        }
    }
    /**
     * Closes a database connection created from configuration.
     *
     * Config-backed databases keep an open handle that locks the database file on
     * Windows until it is closed, so callers that need to move or delete the file
     * should close the database first. Supplied clients remain caller-owned. Safe
     * to call more than once.
     */
    close() {
        this.#assertNoOpenTransactions('close');
        if (this.#config) {
            this.#closeDatabase();
        }
    }
    /**
     * Starts a sqlite transaction.
     * @param options Transaction options.
     * @returns Transaction token.
     */
    async beginTransaction(options) {
        this.#assertDatabaseOpen();
        if (options?.isolationLevel === 'read uncommitted') {
            this.#database.exec('pragma read_uncommitted = true');
        }
        this.#database.exec('begin');
        this.#transactionCounter += 1;
        let token = { id: 'tx_' + String(this.#transactionCounter) };
        this.#transactions.add(token.id);
        return token;
    }
    /**
     * Commits an open sqlite transaction.
     * @param token Transaction token to commit.
     * @returns A promise that resolves when the transaction is committed.
     */
    async commitTransaction(token) {
        this.#assertTransaction(token);
        try {
            this.#database.exec('commit');
        }
        catch (commitError) {
            try {
                this.#database.exec('rollback');
            }
            catch (rollbackError) {
                let failures = [commitError, rollbackError];
                try {
                    this.#discardUncertainConnection();
                }
                catch (recoveryError) {
                    failures.push(recoveryError);
                }
                throw new AggregateError(failures, 'SQLite commit and rollback both failed', {
                    cause: commitError,
                });
            }
            throw commitError;
        }
        finally {
            this.#transactions.delete(token.id);
        }
    }
    /**
     * Rolls back an open sqlite transaction.
     * @param token Transaction token to roll back.
     * @returns A promise that resolves when the transaction is rolled back.
     */
    async rollbackTransaction(token) {
        this.#assertTransaction(token);
        try {
            this.#database.exec('rollback');
        }
        catch (rollbackError) {
            try {
                this.#discardUncertainConnection();
            }
            catch (recoveryError) {
                throw new AggregateError([rollbackError, recoveryError], 'SQLite rollback and connection cleanup both failed', { cause: rollbackError });
            }
            throw rollbackError;
        }
        finally {
            this.#transactions.delete(token.id);
        }
    }
    /**
     * Creates a savepoint in an open sqlite transaction.
     * @param token Transaction token to use.
     * @param name Savepoint name.
     * @returns A promise that resolves when the savepoint is created.
     */
    async createSavepoint(token, name) {
        this.#assertTransaction(token);
        this.#database.exec('savepoint ' + quoteIdentifier(name));
    }
    /**
     * Rolls back to a savepoint in an open sqlite transaction.
     * @param token Transaction token to use.
     * @param name Savepoint name.
     * @returns A promise that resolves when the rollback completes.
     */
    async rollbackToSavepoint(token, name) {
        this.#assertTransaction(token);
        this.#database.exec('rollback to savepoint ' + quoteIdentifier(name));
    }
    /**
     * Releases a savepoint in an open sqlite transaction.
     * @param token Transaction token to use.
     * @param name Savepoint name.
     * @returns A promise that resolves when the savepoint is released.
     */
    async releaseSavepoint(token, name) {
        this.#assertTransaction(token);
        this.#database.exec('release savepoint ' + quoteIdentifier(name));
    }
    #replaceDatabase() {
        if (this.#config) {
            this.#database = openSqliteDatabase(this.#config);
            this.#databaseOpen = true;
        }
    }
    #closeDatabase() {
        if (this.#databaseOpen) {
            this.#databaseOpen = false;
            this.#database.close?.();
        }
    }
    #discardUncertainConnection() {
        if (this.#config) {
            this.#closeDatabase();
            this.#replaceDatabase();
        }
        else {
            // The supplied client remains caller-owned, but this wrapper cannot safely
            // reuse a connection whose transaction state is unknown.
            this.#databaseOpen = false;
        }
    }
    #configOrThrow(method) {
        if (!this.#config) {
            throw new Error('SQLite database ' + method + '() requires config-based construction');
        }
        return this.#config;
    }
    #assertNoOpenTransactions(method) {
        if (this.#transactions.size > 0) {
            throw new Error('SQLite database cannot ' + method + ' while transactions are open');
        }
    }
    #assertTransaction(token) {
        this.#assertDatabaseOpen();
        if (!this.#transactions.has(token.id)) {
            throw new Error('Unknown transaction token: ' + token.id);
        }
    }
    #assertDatabaseOpen() {
        if (!this.#databaseOpen) {
            throw new Error('SQLite database is closed');
        }
    }
}
const REMOVE_RETRIES = 10;
const REMOVE_RETRY_DELAY_MS = 100;
async function removeDatabaseFile(filename) {
    // Windows keeps a just-closed database file locked for a short window (deferred handle
    // release, antivirus scans), so removal is retried with a linear backoff
    for (let attempt = 0;; attempt++) {
        try {
            await rm(filename, { force: true });
            return;
        }
        catch (error) {
            if (attempt >= REMOVE_RETRIES || !isRetryableRemoveError(error)) {
                throw error;
            }
        }
        await setTimeout(REMOVE_RETRY_DELAY_MS * (attempt + 1));
    }
}
function isRetryableRemoveError(error) {
    let code = error?.code;
    return code === 'EBUSY' || code === 'EPERM' || code === 'EMFILE' || code === 'ENFILE';
}
function openSqliteDatabase(config) {
    let SqliteDatabaseConstructor = loadSqliteDatabaseConstructor();
    let database = new SqliteDatabaseConstructor(config.filename);
    // node:sqlite enables foreign keys by default while bun:sqlite follows SQLite's default
    // (off), so set the pragma explicitly to make the option authoritative on both runtimes
    database.exec('pragma foreign_keys = ' + (config.foreignKeys ? 'on' : 'off'));
    // node:sqlite defaults to busy_timeout 0, which fails immediately with SQLITE_BUSY when
    // another process holds a write lock
    database.exec('pragma busy_timeout = ' + String(config.busyTimeout ?? 5000));
    return database;
}
function isSqliteDatabase(input) {
    return ('prepare' in input &&
        typeof input.prepare === 'function' &&
        'exec' in input &&
        typeof input.exec === 'function');
}
function normalizeRows(rows) {
    return rows.map((row) => {
        if (typeof row !== 'object' || row === null) {
            return {};
        }
        return { ...row };
    });
}
function normalizeStatementValues(values) {
    return values.map((value) => (value === undefined ? null : value));
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
function normalizeAffectedRowsForReader(kind, rows) {
    if (isWriteOperationKind(kind)) {
        return rows.length;
    }
    return undefined;
}
function normalizeInsertIdForReader(kind, operation, rows) {
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
function normalizeAffectedRowsForRun(kind, result) {
    if (kind === 'select' || kind === 'count' || kind === 'exists') {
        return undefined;
    }
    return Number(result.changes);
}
function normalizeInsertIdForRun(kind, operation, result) {
    if (!isInsertOperationKind(kind) || !isInsertOperation(operation)) {
        return undefined;
    }
    if (getTablePrimaryKey(operation.table).length !== 1) {
        return undefined;
    }
    return result.lastInsertRowid;
}
function shouldReadStatement(operation, statement) {
    if (operation.kind === 'select' || operation.kind === 'count' || operation.kind === 'exists') {
        return true;
    }
    if (operation.kind !== 'raw') {
        return operation.returning !== undefined;
    }
    if (typeof statement.reader === 'boolean') {
        return statement.reader;
    }
    if (statement.columns) {
        return statement.columns().length > 0;
    }
    try {
        return statement.columnNames !== undefined && statement.columnNames.length > 0;
    }
    catch {
        return false;
    }
}
function quoteIdentifier(value) {
    return '"' + value.replace(/"/g, '""') + '"';
}
function isWriteOperationKind(kind) {
    return (kind === 'insert' ||
        kind === 'insertMany' ||
        kind === 'update' ||
        kind === 'delete' ||
        kind === 'upsert');
}
function isInsertOperationKind(kind) {
    return kind === 'insert' || kind === 'insertMany' || kind === 'upsert';
}
function isInsertOperation(operation) {
    return (operation.kind === 'insert' || operation.kind === 'insertMany' || operation.kind === 'upsert');
}
