import { getTablePrimaryKey } from '@remix-run/data-table';
import { isDataManipulationOperation as isDataManipulationOperationHelper, quoteLiteral as quoteLiteralHelper, quoteTableRef as quoteTableRefHelper, } from '@remix-run/data-table/sql-helpers';
import { compileSqliteOperation } from "./sql-compiler.js";
/**
 * `DatabaseAdapter` implementation for Better SQLite3.
 */
export class SqliteDatabaseAdapter {
    /**
     * The SQL dialect identifier reported by this adapter.
     */
    dialect = 'sqlite';
    /**
     * Feature flags describing the sqlite behaviors supported by this adapter.
     */
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
            transactionalDdl: options?.capabilities?.transactionalDdl ?? true,
            migrationLock: options?.capabilities?.migrationLock ?? false,
        };
    }
    /**
     * Compiles a data or migration operation to sqlite SQL statements.
     * @param operation Operation to compile.
     * @returns Compiled SQL statements.
     */
    compileSql(operation) {
        if (isDataManipulationOperation(operation)) {
            let compiled = compileSqliteOperation(operation);
            return [{ text: compiled.text, values: compiled.values }];
        }
        return compileSqliteMigrationOperations(operation);
    }
    /**
     * Executes a sqlite data-manipulation request.
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
        let statement = this.compileSql(request.operation)[0];
        let prepared = this.#database.prepare(statement.text);
        if (prepared.reader) {
            let rows = normalizeRows(prepared.all(...statement.values));
            if (request.operation.kind === 'count' || request.operation.kind === 'exists') {
                rows = normalizeCountRows(rows);
            }
            return {
                rows,
                affectedRows: normalizeAffectedRowsForReader(request.operation.kind, rows),
                insertId: normalizeInsertIdForReader(request.operation.kind, request.operation, rows),
            };
        }
        let result = prepared.run(...statement.values);
        return {
            affectedRows: normalizeAffectedRowsForRun(request.operation.kind, result),
            insertId: normalizeInsertIdForRun(request.operation.kind, request.operation, result),
        };
    }
    /**
     * Executes sqlite migration operations.
     * @param request Migration request to execute.
     * @returns Migration result.
     */
    async migrate(request) {
        let statements = this.compileSql(request.operation);
        for (let statement of statements) {
            let prepared = this.#database.prepare(statement.text);
            prepared.run(...statement.values);
        }
        return {
            affectedOperations: statements.length,
        };
    }
    /**
     * Checks whether a table exists in sqlite.
     * @param table Table reference to inspect.
     * @param transaction Optional transaction token.
     * @returns `true` when the table exists.
     */
    async hasTable(table, transaction) {
        if (transaction) {
            this.#assertTransaction(transaction);
        }
        let masterTable = table.schema
            ? quoteIdentifier(table.schema) + '.sqlite_master'
            : 'sqlite_master';
        let statement = this.#database.prepare('select 1 from ' + masterTable + ' where type = ? and name = ? limit 1');
        let row = statement.get('table', table.name);
        return row !== undefined;
    }
    /**
     * Checks whether a column exists in sqlite.
     * @param table Table reference to inspect.
     * @param column Column name to look up.
     * @param transaction Optional transaction token.
     * @returns `true` when the column exists.
     */
    async hasColumn(table, column, transaction) {
        if (transaction) {
            this.#assertTransaction(transaction);
        }
        let schemaPrefix = table.schema ? quoteIdentifier(table.schema) + '.' : '';
        let statement = this.#database.prepare('pragma ' + schemaPrefix + 'table_info(' + quoteIdentifier(table.name) + ')');
        let rows = statement.all();
        return rows.some((row) => row.name === column);
    }
    /**
     * Starts a sqlite transaction.
     * @param options Transaction options.
     * @returns Transaction token.
     */
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
    /**
     * Commits an open sqlite transaction.
     * @param token Transaction token to commit.
     * @returns A promise that resolves when the transaction is committed.
     */
    async commitTransaction(token) {
        this.#assertTransaction(token);
        this.#database.exec('commit');
        this.#transactions.delete(token.id);
    }
    /**
     * Rolls back an open sqlite transaction.
     * @param token Transaction token to roll back.
     * @returns A promise that resolves when the transaction is rolled back.
     */
    async rollbackTransaction(token) {
        this.#assertTransaction(token);
        this.#database.exec('rollback');
        this.#transactions.delete(token.id);
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
    #assertTransaction(token) {
        if (!this.#transactions.has(token.id)) {
            throw new Error('Unknown transaction token: ' + token.id);
        }
    }
}
/**
 * Creates a sqlite `DatabaseAdapter`.
 * @param database Better SQLite3 database instance.
 * @param options Optional adapter capability overrides.
 * @returns A configured sqlite adapter.
 * @example
 * ```ts
 * import BetterSqlite3 from 'better-sqlite3'
 * import { createDatabase } from 'remix/data-table'
 * import { createSqliteDatabaseAdapter } from 'remix/data-table-sqlite'
 *
 * let sqlite = new BetterSqlite3('./data/app.db')
 * let adapter = createSqliteDatabaseAdapter(sqlite)
 * let db = createDatabase(adapter)
 * ```
 */
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
    return result.changes;
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
function quoteIdentifier(value) {
    return '"' + value.replace(/"/g, '""') + '"';
}
function quoteTableRef(table) {
    return quoteTableRefHelper(table, quoteIdentifier);
}
function quoteLiteral(value) {
    return quoteLiteralHelper(value, { booleansAsIntegers: true });
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
function isDataManipulationOperation(operation) {
    return isDataManipulationOperationHelper(operation);
}
function compileSqliteMigrationOperations(operation) {
    if (operation.kind === 'raw') {
        return [{ text: operation.sql.text, values: [...operation.sql.values] }];
    }
    if (operation.kind === 'createTable') {
        let columns = Object.keys(operation.columns).map((columnName) => quoteIdentifier(columnName) + ' ' + compileSqliteColumn(operation.columns[columnName]));
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
        return [
            {
                text: 'create table ' +
                    (operation.ifNotExists ? 'if not exists ' : '') +
                    quoteTableRef(operation.table) +
                    ' (' +
                    [...columns, ...constraints].join(', ') +
                    ')',
                values: [],
            },
        ];
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
                        compileSqliteColumn(change.definition);
            }
            else if (change.kind === 'changeColumn') {
                sql +=
                    'alter column ' +
                        quoteIdentifier(change.column) +
                        ' type ' +
                        compileSqliteColumnType(change.definition);
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
                sql += 'drop constraint ' + quoteIdentifier(change.name);
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
                sql += 'drop constraint ' + quoteIdentifier(change.name);
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
                sql += 'drop constraint ' + quoteIdentifier(change.name);
            }
            else if (change.kind === 'setTableComment') {
                continue;
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
                text: 'alter table ' +
                    quoteTableRef(operation.from) +
                    ' rename to ' +
                    quoteIdentifier(operation.to.name),
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
                    (operation.ifNotExists ? 'if not exists ' : '') +
                    quoteIdentifier(operation.index.name) +
                    ' on ' +
                    quoteTableRef(operation.index.table) +
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
                text: 'drop index ' +
                    (operation.ifExists ? 'if exists ' : '') +
                    quoteIdentifier(operation.name),
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
                    ' drop constraint ' +
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
                    ' drop constraint ' +
                    quoteIdentifier(operation.name),
                values: [],
            },
        ];
    }
    throw new Error('Unsupported data migration operation kind');
}
function compileSqliteColumn(definition) {
    let parts = [compileSqliteColumnType(definition)];
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
function compileSqliteColumnType(definition) {
    if (definition.type === 'varchar') {
        return 'text';
    }
    if (definition.type === 'text') {
        return 'text';
    }
    if (definition.type === 'integer') {
        return 'integer';
    }
    if (definition.type === 'bigint') {
        return 'integer';
    }
    if (definition.type === 'decimal') {
        return 'numeric';
    }
    if (definition.type === 'boolean') {
        return 'integer';
    }
    if (definition.type === 'uuid') {
        return 'text';
    }
    if (definition.type === 'date') {
        return 'text';
    }
    if (definition.type === 'time') {
        return 'text';
    }
    if (definition.type === 'timestamp') {
        return 'text';
    }
    if (definition.type === 'json') {
        return 'text';
    }
    if (definition.type === 'binary') {
        return 'blob';
    }
    if (definition.type === 'enum') {
        return 'text';
    }
    return 'text';
}
