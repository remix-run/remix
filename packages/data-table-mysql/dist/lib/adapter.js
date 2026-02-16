import { getTablePrimaryKey } from '@remix-run/data-table';
import { compileMysqlStatement } from "./sql-compiler.js";
/**
 * `DatabaseAdapter` implementation for mysql-compatible clients.
 */
export class MysqlDatabaseAdapter {
    dialect = 'mysql';
    capabilities;
    #client;
    #transactions = new Map();
    #transactionCounter = 0;
    constructor(client, options) {
        this.#client = client;
        this.capabilities = {
            returning: options?.capabilities?.returning ?? false,
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
        let statement = compileMysqlStatement(request.statement);
        let client = this.#resolveClient(request.transaction);
        let [result] = await client.query(statement.text, statement.values);
        if (isRowsResult(result)) {
            let rows = normalizeRows(result);
            if (request.statement.kind === 'count' || request.statement.kind === 'exists') {
                rows = normalizeCountRows(rows);
            }
            return { rows };
        }
        let header = normalizeHeader(result);
        return {
            affectedRows: header.affectedRows,
            insertId: normalizeInsertId(request.statement.kind, request.statement, header),
        };
    }
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
            if (transaction.releaseOnClose) {
                transaction.connection.release?.();
            }
        }
    }
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
            if (transaction.releaseOnClose) {
                transaction.connection.release?.();
            }
        }
    }
    async createSavepoint(token, name) {
        let connection = this.#transactionConnection(token);
        await connection.query('savepoint ' + quoteIdentifier(name));
    }
    async rollbackToSavepoint(token, name) {
        let connection = this.#transactionConnection(token);
        await connection.query('rollback to savepoint ' + quoteIdentifier(name));
    }
    async releaseSavepoint(token, name) {
        let connection = this.#transactionConnection(token);
        await connection.query('release savepoint ' + quoteIdentifier(name));
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
 * @param client Mysql pool or connection.
 * @param options Optional adapter capability overrides.
 * @returns A configured mysql adapter.
 */
export function createMysqlDatabaseAdapter(client, options) {
    return new MysqlDatabaseAdapter(client, options);
}
function isMysqlPool(client) {
    return typeof client.getConnection === 'function';
}
function isRowsResult(result) {
    return Array.isArray(result) && (result.length === 0 || !Array.isArray(result[0]));
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
function normalizeInsertId(kind, statement, header) {
    if (!isInsertStatementKind(kind) || !isInsertStatement(statement)) {
        return undefined;
    }
    if (getTablePrimaryKey(statement.table).length !== 1) {
        return undefined;
    }
    return header.insertId;
}
function quoteIdentifier(value) {
    return '`' + value.replace(/`/g, '``') + '`';
}
function isInsertStatementKind(kind) {
    return kind === 'insert' || kind === 'insertMany' || kind === 'upsert';
}
function isInsertStatement(statement) {
    return (statement.kind === 'insert' || statement.kind === 'insertMany' || statement.kind === 'upsert');
}
