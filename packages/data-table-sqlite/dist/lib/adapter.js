import { compileSqliteStatement } from "./sql-compiler.js";
export class SqliteDatabaseAdapter {
    dialect = 'sqlite';
    capabilities;
    #database;
    #transactions = new Set();
    #transactionCounter = 0;
    constructor(database, options) {
        this.#database = database;
        this.capabilities = {
            returning: options?.capabilities?.returning ?? true,
            savepoints: options?.capabilities?.savepoints ?? true,
            upsert: options?.capabilities?.upsert ?? true,
        };
    }
    async execute(request) {
        if (request.statement.kind === 'insertMany' && request.statement.values.length === 0) {
            return {
                affectedRows: 0,
                insertId: undefined,
                rows: request.statement.returning ? [] : undefined,
            };
        }
        let statement = compileSqliteStatement(request.statement);
        let prepared = this.#database.prepare(statement.text);
        if (prepared.reader) {
            let rows = normalizeRows(prepared.all(...statement.values));
            if (request.statement.kind === 'count' || request.statement.kind === 'exists') {
                rows = normalizeCountRows(rows);
            }
            return {
                rows,
                affectedRows: normalizeAffectedRowsForReader(request.statement.kind, rows),
                insertId: normalizeInsertIdForReader(request.statement.kind, request.statement, rows),
            };
        }
        let result = prepared.run(...statement.values);
        return {
            affectedRows: normalizeAffectedRowsForRun(request.statement.kind, result),
            insertId: normalizeInsertIdForRun(request.statement.kind, request.statement, result),
        };
    }
    async beginTransaction(options) {
        if (options?.isolationLevel === 'read uncommitted') {
            this.#database.pragma('read_uncommitted = true');
        }
        this.#database.exec('begin');
        this.#transactionCounter += 1;
        let token = { id: 'tx_' + String(this.#transactionCounter) };
        this.#transactions.add(token.id);
        return token;
    }
    async commitTransaction(token) {
        this.#assertTransaction(token);
        this.#database.exec('commit');
        this.#transactions.delete(token.id);
    }
    async rollbackTransaction(token) {
        this.#assertTransaction(token);
        this.#database.exec('rollback');
        this.#transactions.delete(token.id);
    }
    async createSavepoint(token, name) {
        this.#assertTransaction(token);
        this.#database.exec('savepoint ' + quoteIdentifier(name));
    }
    async rollbackToSavepoint(token, name) {
        this.#assertTransaction(token);
        this.#database.exec('rollback to savepoint ' + quoteIdentifier(name));
    }
    async releaseSavepoint(token, name) {
        this.#assertTransaction(token);
        this.#database.exec('release savepoint ' + quoteIdentifier(name));
    }
    #assertTransaction(token) {
        if (!this.#transactions.has(token.id)) {
            throw new Error('Unknown transaction token: ' + token.id);
        }
    }
}
export function createSqliteDatabaseAdapter(database, options) {
    return new SqliteDatabaseAdapter(database, options);
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
function normalizeAffectedRowsForReader(kind, rows) {
    if (kind === 'insert' || kind === 'insertMany' || kind === 'update' || kind === 'delete' || kind === 'upsert') {
        return rows.length;
    }
    return undefined;
}
function normalizeInsertIdForReader(kind, statement, rows) {
    if (kind !== 'insert' && kind !== 'insertMany' && kind !== 'upsert') {
        return undefined;
    }
    if (statement.kind !== 'insert' && statement.kind !== 'insertMany' && statement.kind !== 'upsert') {
        return undefined;
    }
    if (statement.table.primaryKey.length !== 1) {
        return undefined;
    }
    let key = statement.table.primaryKey[0];
    let row = rows[rows.length - 1];
    return row ? row[key] : undefined;
}
function normalizeAffectedRowsForRun(kind, result) {
    if (kind === 'select' || kind === 'count' || kind === 'exists') {
        return undefined;
    }
    return result.changes;
}
function normalizeInsertIdForRun(kind, statement, result) {
    if (kind !== 'insert' && kind !== 'insertMany' && kind !== 'upsert') {
        return undefined;
    }
    if (statement.kind !== 'insert' && statement.kind !== 'insertMany' && statement.kind !== 'upsert') {
        return undefined;
    }
    if (statement.table.primaryKey.length !== 1) {
        return undefined;
    }
    return result.lastInsertRowid;
}
function quoteIdentifier(value) {
    return '"' + value.replace(/"/g, '""') + '"';
}
