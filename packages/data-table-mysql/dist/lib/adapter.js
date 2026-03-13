import { getTablePrimaryKey } from '@remix-run/data-table';
import { isDataManipulationOperation as isDataManipulationOperationHelper, quoteLiteral as quoteLiteralHelper, quoteTableRef as quoteTableRefHelper, } from '@remix-run/data-table/sql-helpers';
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
    #client;
    #transactions = new Map();
    #transactionCounter = 0;
    constructor(client, options) {
        this.#client = client;
        this.capabilities = {
            returning: options?.capabilities?.returning ?? false,
            savepoints: options?.capabilities?.savepoints ?? true,
            upsert: options?.capabilities?.upsert ?? true,
            transactionalDdl: options?.capabilities?.transactionalDdl ?? false,
            migrationLock: options?.capabilities?.migrationLock ?? true,
        };
    }
    /**
     * Compiles a data or migration operation to mysql SQL statements.
     * @param operation Operation to compile.
     * @returns Compiled SQL statements.
     */
    compileSql(operation) {
        if (isDataManipulationOperation(operation)) {
            let compiled = compileMysqlOperation(operation);
            return [{ text: compiled.text, values: compiled.values }];
        }
        return compileMysqlMigrationOperations(operation);
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
     * Executes mysql migration operations.
     * @param request Migration request to execute.
     * @returns Migration result.
     */
    async migrate(request) {
        let statements = this.compileSql(request.operation);
        let client = this.#resolveClient(request.transaction);
        for (let statement of statements) {
            await client.query(statement.text, statement.values);
        }
        return {
            affectedOperations: statements.length,
        };
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
            if (transaction.releaseOnClose) {
                transaction.connection.release?.();
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
            if (transaction.releaseOnClose) {
                transaction.connection.release?.();
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
     * Acquires the mysql migration lock.
     * @returns A promise that resolves when the lock is acquired.
     */
    async acquireMigrationLock() {
        await this.#client.query('select get_lock(?, 60)', ['data_table_migrations']);
    }
    /**
     * Releases the mysql migration lock.
     * @returns A promise that resolves when the lock is released.
     */
    async releaseMigrationLock() {
        await this.#client.query('select release_lock(?)', ['data_table_migrations']);
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
export function createMysqlDatabaseAdapter(client, options) {
    return new MysqlDatabaseAdapter(client, options);
}
function isMysqlPool(client) {
    return typeof client.getConnection === 'function';
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
function quoteTableRef(table) {
    return quoteTableRefHelper(table, quoteIdentifier);
}
function quoteLiteral(value) {
    return quoteLiteralHelper(value);
}
function isInsertOperationKind(kind) {
    return kind === 'insert' || kind === 'insertMany' || kind === 'upsert';
}
function isInsertOperation(operation) {
    return (operation.kind === 'insert' || operation.kind === 'insertMany' || operation.kind === 'upsert');
}
function isDataManipulationOperation(operation) {
    return isDataManipulationOperationHelper(operation);
}
function compileMysqlMigrationOperations(operation) {
    if (operation.kind === 'raw') {
        return [{ text: operation.sql.text, values: [...operation.sql.values] }];
    }
    if (operation.kind === 'createTable') {
        let columns = Object.keys(operation.columns).map((columnName) => quoteIdentifier(columnName) + ' ' + compileMysqlColumn(operation.columns[columnName]));
        let constraints = [];
        if (operation.primaryKey) {
            constraints.push('constraint ' +
                quoteIdentifier(operation.primaryKey.name) +
                ' primary key (' +
                operation.primaryKey.columns.map((column) => quoteIdentifier(column)).join(', ') +
                ')');
        }
        for (let unique of operation.uniques ?? []) {
            constraints.push('constraint ' +
                quoteIdentifier(unique.name) +
                ' ' +
                'unique (' +
                unique.columns.map((column) => quoteIdentifier(column)).join(', ') +
                ')');
        }
        for (let check of operation.checks ?? []) {
            constraints.push('constraint ' + quoteIdentifier(check.name) + ' ' + 'check (' + check.expression + ')');
        }
        for (let foreignKey of operation.foreignKeys ?? []) {
            let clause = 'constraint ' +
                quoteIdentifier(foreignKey.name) +
                ' ' +
                'foreign key (' +
                foreignKey.columns.map((column) => quoteIdentifier(column)).join(', ') +
                ') references ' +
                quoteTableRef(foreignKey.references.table) +
                ' (' +
                foreignKey.references.columns.map((column) => quoteIdentifier(column)).join(', ') +
                ')';
            if (foreignKey.onDelete) {
                clause += ' on delete ' + foreignKey.onDelete;
            }
            if (foreignKey.onUpdate) {
                clause += ' on update ' + foreignKey.onUpdate;
            }
            constraints.push(clause);
        }
        let sql = 'create table ' +
            (operation.ifNotExists ? 'if not exists ' : '') +
            quoteTableRef(operation.table) +
            ' (' +
            [...columns, ...constraints].join(', ') +
            ')';
        let statements = [{ text: sql, values: [] }];
        if (operation.comment) {
            statements.push({
                text: 'alter table ' +
                    quoteTableRef(operation.table) +
                    ' comment = ' +
                    quoteLiteral(operation.comment),
                values: [],
            });
        }
        return statements;
    }
    if (operation.kind === 'alterTable') {
        let statements = [];
        for (let change of operation.changes) {
            let sql = 'alter table ' + quoteTableRef(operation.table) + ' ';
            if (change.kind === 'addColumn') {
                sql +=
                    'add column ' +
                        quoteIdentifier(change.column) +
                        ' ' +
                        compileMysqlColumn(change.definition);
            }
            else if (change.kind === 'changeColumn') {
                sql +=
                    'modify column ' +
                        quoteIdentifier(change.column) +
                        ' ' +
                        compileMysqlColumn(change.definition);
            }
            else if (change.kind === 'renameColumn') {
                sql += 'rename column ' + quoteIdentifier(change.from) + ' to ' + quoteIdentifier(change.to);
            }
            else if (change.kind === 'dropColumn') {
                sql += 'drop column ' + quoteIdentifier(change.column);
            }
            else if (change.kind === 'addPrimaryKey') {
                sql +=
                    'add primary key (' +
                        change.constraint.columns.map((column) => quoteIdentifier(column)).join(', ') +
                        ')';
            }
            else if (change.kind === 'dropPrimaryKey') {
                sql += 'drop primary key';
            }
            else if (change.kind === 'addUnique') {
                sql +=
                    'add ' +
                        'constraint ' +
                        quoteIdentifier(change.constraint.name) +
                        ' ' +
                        'unique (' +
                        change.constraint.columns.map((column) => quoteIdentifier(column)).join(', ') +
                        ')';
            }
            else if (change.kind === 'dropUnique') {
                sql += 'drop index ' + quoteIdentifier(change.name);
            }
            else if (change.kind === 'addForeignKey') {
                sql +=
                    'add ' +
                        'constraint ' +
                        quoteIdentifier(change.constraint.name) +
                        ' ' +
                        'foreign key (' +
                        change.constraint.columns.map((column) => quoteIdentifier(column)).join(', ') +
                        ') references ' +
                        quoteTableRef(change.constraint.references.table) +
                        ' (' +
                        change.constraint.references.columns.map((column) => quoteIdentifier(column)).join(', ') +
                        ')';
            }
            else if (change.kind === 'dropForeignKey') {
                sql += 'drop foreign key ' + quoteIdentifier(change.name);
            }
            else if (change.kind === 'addCheck') {
                sql +=
                    'add ' +
                        'constraint ' +
                        quoteIdentifier(change.constraint.name) +
                        ' ' +
                        'check (' +
                        change.constraint.expression +
                        ')';
            }
            else if (change.kind === 'dropCheck') {
                sql += 'drop check ' + quoteIdentifier(change.name);
            }
            else if (change.kind === 'setTableComment') {
                sql += 'comment = ' + quoteLiteral(change.comment);
            }
            else {
                continue;
            }
            statements.push({ text: sql, values: [] });
        }
        return statements;
    }
    if (operation.kind === 'renameTable') {
        return [
            {
                text: 'rename table ' + quoteTableRef(operation.from) + ' to ' + quoteTableRef(operation.to),
                values: [],
            },
        ];
    }
    if (operation.kind === 'dropTable') {
        return [
            {
                text: 'drop table ' + (operation.ifExists ? 'if exists ' : '') + quoteTableRef(operation.table),
                values: [],
            },
        ];
    }
    if (operation.kind === 'createIndex') {
        return [
            {
                text: 'create ' +
                    (operation.index.unique ? 'unique ' : '') +
                    'index ' +
                    quoteIdentifier(operation.index.name) +
                    ' on ' +
                    quoteTableRef(operation.index.table) +
                    (operation.index.using ? ' using ' + operation.index.using : '') +
                    ' (' +
                    operation.index.columns.map((column) => quoteIdentifier(column)).join(', ') +
                    ')' +
                    (operation.index.where ? ' where ' + operation.index.where : ''),
                values: [],
            },
        ];
    }
    if (operation.kind === 'dropIndex') {
        return [
            {
                text: 'drop index ' + quoteIdentifier(operation.name) + ' on ' + quoteTableRef(operation.table),
                values: [],
            },
        ];
    }
    if (operation.kind === 'renameIndex') {
        return [
            {
                text: 'alter table ' +
                    quoteTableRef(operation.table) +
                    ' rename index ' +
                    quoteIdentifier(operation.from) +
                    ' to ' +
                    quoteIdentifier(operation.to),
                values: [],
            },
        ];
    }
    if (operation.kind === 'addForeignKey') {
        return [
            {
                text: 'alter table ' +
                    quoteTableRef(operation.table) +
                    ' add ' +
                    'constraint ' +
                    quoteIdentifier(operation.constraint.name) +
                    ' ' +
                    'foreign key (' +
                    operation.constraint.columns.map((column) => quoteIdentifier(column)).join(', ') +
                    ') references ' +
                    quoteTableRef(operation.constraint.references.table) +
                    ' (' +
                    operation.constraint.references.columns
                        .map((column) => quoteIdentifier(column))
                        .join(', ') +
                    ')' +
                    (operation.constraint.onDelete ? ' on delete ' + operation.constraint.onDelete : '') +
                    (operation.constraint.onUpdate ? ' on update ' + operation.constraint.onUpdate : ''),
                values: [],
            },
        ];
    }
    if (operation.kind === 'dropForeignKey') {
        return [
            {
                text: 'alter table ' +
                    quoteTableRef(operation.table) +
                    ' drop foreign key ' +
                    quoteIdentifier(operation.name),
                values: [],
            },
        ];
    }
    if (operation.kind === 'addCheck') {
        return [
            {
                text: 'alter table ' +
                    quoteTableRef(operation.table) +
                    ' add ' +
                    'constraint ' +
                    quoteIdentifier(operation.constraint.name) +
                    ' ' +
                    'check (' +
                    operation.constraint.expression +
                    ')',
                values: [],
            },
        ];
    }
    if (operation.kind === 'dropCheck') {
        return [
            {
                text: 'alter table ' +
                    quoteTableRef(operation.table) +
                    ' drop check ' +
                    quoteIdentifier(operation.name),
                values: [],
            },
        ];
    }
    throw new Error('Unsupported data migration operation kind');
}
function compileMysqlColumn(definition) {
    let parts = [compileMysqlColumnType(definition)];
    if (definition.nullable === false) {
        parts.push('not null');
    }
    if (definition.default) {
        if (definition.default.kind === 'now') {
            parts.push('default current_timestamp');
        }
        else if (definition.default.kind === 'sql') {
            parts.push('default ' + definition.default.expression);
        }
        else {
            parts.push('default ' + quoteLiteral(definition.default.value));
        }
    }
    if (definition.autoIncrement) {
        parts.push('auto_increment');
    }
    if (definition.primaryKey) {
        parts.push('primary key');
    }
    if (definition.unique) {
        parts.push('unique');
    }
    if (definition.computed) {
        parts.push('generated always as (' + definition.computed.expression + ')');
        parts.push(definition.computed.stored ? 'stored' : 'virtual');
    }
    if (definition.references) {
        let clause = 'references ' +
            quoteTableRef(definition.references.table) +
            ' (' +
            definition.references.columns.map((column) => quoteIdentifier(column)).join(', ') +
            ')';
        if (definition.references.onDelete) {
            clause += ' on delete ' + definition.references.onDelete;
        }
        if (definition.references.onUpdate) {
            clause += ' on update ' + definition.references.onUpdate;
        }
        parts.push(clause);
    }
    if (definition.checks && definition.checks.length > 0) {
        for (let check of definition.checks) {
            parts.push('check (' + check.expression + ')');
        }
    }
    return parts.join(' ');
}
function compileMysqlColumnType(definition) {
    if (definition.type === 'varchar') {
        return 'varchar(' + String(definition.length ?? 255) + ')';
    }
    if (definition.type === 'text') {
        return 'text';
    }
    if (definition.type === 'integer') {
        return definition.unsigned ? 'int unsigned' : 'int';
    }
    if (definition.type === 'bigint') {
        return definition.unsigned ? 'bigint unsigned' : 'bigint';
    }
    if (definition.type === 'decimal') {
        if (definition.precision !== undefined && definition.scale !== undefined) {
            return 'decimal(' + String(definition.precision) + ', ' + String(definition.scale) + ')';
        }
        return 'decimal';
    }
    if (definition.type === 'boolean') {
        return 'boolean';
    }
    if (definition.type === 'uuid') {
        return 'char(36)';
    }
    if (definition.type === 'date') {
        return 'date';
    }
    if (definition.type === 'time') {
        return 'time';
    }
    if (definition.type === 'timestamp') {
        return 'timestamp';
    }
    if (definition.type === 'json') {
        return 'json';
    }
    if (definition.type === 'binary') {
        return 'blob';
    }
    if (definition.type === 'enum') {
        if (definition.enumValues && definition.enumValues.length > 0) {
            return 'enum(' + definition.enumValues.map((value) => quoteLiteral(value)).join(', ') + ')';
        }
        return 'text';
    }
    return 'text';
}
