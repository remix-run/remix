import { DataTableAdapterError, DataTableQueryError, DataTableValidationError } from "./errors.js";
import { getCompositeKey, getTableAfterDelete, getTableAfterRead, getTableAfterWrite, getTableBeforeDelete, getPrimaryKeyObject, getTableColumns, getTableName, getTableBeforeWrite, getTablePrimaryKey, getTableTimestamps, getTableValidator, } from "./table.js";
import { and, eq, inList, normalizeWhereInput, or } from "./operators.js";
import { rawSql } from "./sql.js";
import { normalizeColumnInput } from "./references.js";
const executeOperation = Symbol('executeOperation');
const loadRowsWithRelations = Symbol('loadRowsWithRelations');
class DatabaseRuntime {
    #adapter;
    #token;
    #now;
    #savepointCounter;
    constructor(options) {
        this.#adapter = options.adapter;
        this.#token = options.token;
        this.#now = options.now;
        this.#savepointCounter = options.savepointCounter;
    }
    get adapter() {
        return this.#adapter;
    }
    now() {
        return this.#now();
    }
    query = (table) => new QueryBuilder(this, table, createInitialQueryState());
    async create(table, values, options) {
        let touch = options?.touch;
        let query = this.query(asQueryTableInput(table));
        if (options?.returnRow !== true) {
            let result = await query.insert(values, { touch });
            return toWriteResult(result);
        }
        if (this.#adapter.capabilities.returning) {
            let result = (await query.insert(values, {
                returning: '*',
                touch,
            }));
            let row = result.row;
            if (!row) {
                throw new DataTableQueryError('create({ returnRow: true }) failed to return an inserted row');
            }
            if (!options.with) {
                return row;
            }
            let where = getPrimaryKeyWhereFromRow(table, row);
            let loaded = await this.findOne(table, {
                where,
                with: options.with,
            });
            if (!loaded) {
                throw new DataTableQueryError('create({ returnRow: true }) failed to load inserted row');
            }
            return loaded;
        }
        let insertResult = await query.insert(values, { touch });
        let where = resolveCreateRowWhere(table, values, toWriteResult(insertResult).insertId);
        let loaded = await this.findOne(table, {
            where,
            with: options.with,
        });
        if (!loaded) {
            throw new DataTableQueryError('create({ returnRow: true }) failed to load inserted row');
        }
        return loaded;
    }
    async createMany(table, values, options) {
        let query = this.query(asQueryTableInput(table));
        if (options?.returnRows === true) {
            if (!this.#adapter.capabilities.returning) {
                throw new DataTableQueryError('createMany({ returnRows: true }) is not supported by this adapter');
            }
            let result = (await query.insertMany(values, {
                returning: '*',
                touch: options.touch,
            }));
            return result.rows;
        }
        let result = await query.insertMany(values, {
            touch: options?.touch,
        });
        return toWriteResult(result);
    }
    async find(table, value, options) {
        if (value == null) {
            return null;
        }
        let query = this.query(asQueryTableInput(table));
        if (options?.with) {
            return query
                .with(options.with)
                .find(value);
        }
        return query.find(value);
    }
    async findOne(table, options) {
        let query = this.query(asQueryTableInput(table)).where(options.where);
        let orderBy = normalizeOrderByInput(options.orderBy);
        for (let [column, direction] of orderBy) {
            query = query.orderBy(column, direction);
        }
        if (options.with) {
            return query.with(options.with).first();
        }
        return query.first();
    }
    async findMany(table, options) {
        let query = this.query(asQueryTableInput(table));
        if (options?.where) {
            query = query.where(options.where);
        }
        let orderBy = normalizeOrderByInput(options?.orderBy);
        for (let [column, direction] of orderBy) {
            query = query.orderBy(column, direction);
        }
        if (options?.limit !== undefined) {
            query = query.limit(options.limit);
        }
        if (options?.offset !== undefined) {
            query = query.offset(options.offset);
        }
        if (options?.with) {
            return query.with(options.with).all();
        }
        return query.all();
    }
    async count(table, options) {
        let query = this.query(asQueryTableInput(table));
        if (options?.where) {
            query = query.where(options.where);
        }
        return query.count();
    }
    async update(table, value, changes, options) {
        let where = getPrimaryKeyWhere(table, value);
        if (this.#adapter.capabilities.returning) {
            let updateResult = (await this.query(asQueryTableInput(table)).where(where).update(changes, {
                touch: options?.touch,
                returning: '*',
            }));
            let updatedRow = updateResult.rows[0];
            if (!updatedRow) {
                throw new DataTableQueryError('update() failed to find row for table "' + getTableName(table) + '"');
            }
            if (!options?.with) {
                return updatedRow;
            }
            let loaded = await this.findOne(table, {
                where: getPrimaryKeyWhereFromRow(table, updatedRow),
                with: options.with,
            });
            if (!loaded) {
                throw new DataTableQueryError('update() failed to find row for table "' + getTableName(table) + '"');
            }
            return loaded;
        }
        await this.query(asQueryTableInput(table)).where(where).update(changes, {
            touch: options?.touch,
        });
        let loaded = await this.find(table, value, { with: options?.with });
        if (!loaded) {
            throw new DataTableQueryError('update() failed to find row for table "' + getTableName(table) + '"');
        }
        return loaded;
    }
    async updateMany(table, changes, options) {
        let query = this.query(asQueryTableInput(table)).where(options.where);
        let orderBy = normalizeOrderByInput(options.orderBy);
        for (let [column, direction] of orderBy) {
            query = query.orderBy(column, direction);
        }
        if (options.limit !== undefined) {
            query = query.limit(options.limit);
        }
        if (options.offset !== undefined) {
            query = query.offset(options.offset);
        }
        let result = await query.update(changes, { touch: options.touch });
        return toWriteResult(result);
    }
    async delete(table, value) {
        let where = getPrimaryKeyWhere(table, value);
        let result = await this.query(asQueryTableInput(table)).where(where).delete();
        return toWriteResult(result).affectedRows > 0;
    }
    async deleteMany(table, options) {
        let query = this.query(asQueryTableInput(table)).where(options.where);
        let orderBy = normalizeOrderByInput(options.orderBy);
        for (let [column, direction] of orderBy) {
            query = query.orderBy(column, direction);
        }
        if (options.limit !== undefined) {
            query = query.limit(options.limit);
        }
        if (options.offset !== undefined) {
            query = query.offset(options.offset);
        }
        let result = await query.delete();
        return toWriteResult(result);
    }
    async exec(statement, values = []) {
        let sqlStatement = typeof statement === 'string' ? rawSql(statement, values) : statement;
        return this[executeOperation]({
            kind: 'raw',
            sql: sqlStatement,
        });
    }
    async transaction(callback, options) {
        if (!this.#token) {
            let token = await this.#adapter.beginTransaction(options);
            let tx = new DatabaseRuntime({
                adapter: this.#adapter,
                token,
                now: this.#now,
                savepointCounter: this.#savepointCounter,
            });
            try {
                let result = await callback(tx);
                await this.#adapter.commitTransaction(token);
                return result;
            }
            catch (error) {
                await this.#adapter.rollbackTransaction(token);
                throw error;
            }
        }
        if (!this.#adapter.capabilities.savepoints) {
            throw new DataTableQueryError('Nested transactions require adapter savepoint support');
        }
        let savepointName = 'sp_' + String(this.#savepointCounter.value);
        this.#savepointCounter.value += 1;
        await this.#adapter.createSavepoint(this.#token, savepointName);
        try {
            let result = await callback(this);
            await this.#adapter.releaseSavepoint(this.#token, savepointName);
            return result;
        }
        catch (error) {
            await this.#adapter.rollbackToSavepoint(this.#token, savepointName);
            await this.#adapter.releaseSavepoint(this.#token, savepointName);
            throw error;
        }
    }
    async [executeOperation](operation) {
        try {
            return await this.#adapter.execute({
                operation,
                transaction: this.#token,
            });
        }
        catch (error) {
            throw new DataTableAdapterError('Adapter execution failed', {
                cause: error,
                metadata: {
                    dialect: this.#adapter.dialect,
                    operationKind: operation.kind,
                },
            });
        }
    }
}
/**
 * Creates a database runtime from an adapter.
 * @param adapter Adapter implementation responsible for SQL execution.
 * @param options Optional runtime options.
 * @param options.now Clock function used for auto-managed timestamps.
 * @returns A `Database` API instance.
 * @example
 * ```ts
 * import { column as c, createDatabase, table } from 'remix/data-table'
 *
 * let users = table({
 *   name: 'users',
 *   columns: {
 *     id: c.integer(),
 *     email: c.varchar(255),
 *   },
 * })
 *
 * let db = createDatabase(adapter)
 * let rows = await db.query(users).where({ id: 1 }).all()
 * ```
 */
export function createDatabase(adapter, options) {
    let now = options?.now ?? defaultNow;
    return new DatabaseRuntime({
        adapter,
        token: undefined,
        now,
        savepointCounter: { value: 0 },
    });
}
/**
 * Creates a database runtime bound to an existing adapter transaction token.
 * This is an internal helper used by the migration runner.
 * @param adapter Adapter implementation responsible for SQL execution.
 * @param token Active adapter transaction token.
 * @param options Optional runtime options.
 * @param options.now Clock function used for auto-managed timestamps.
 * @returns A `Database` API instance bound to the provided transaction.
 */
export function createDatabaseWithTransaction(adapter, token, options) {
    let now = options?.now ?? defaultNow;
    return new DatabaseRuntime({
        adapter,
        token,
        now,
        savepointCounter: { value: 0 },
    });
}
/**
 * Immutable query builder used by `db.query(table)`.
 */
export class QueryBuilder {
    #database;
    #table;
    #state;
    constructor(database, table, state) {
        this.#database = database;
        this.#table = table;
        this.#state = state;
    }
    select(...input) {
        if (input.length === 1 &&
            typeof input[0] === 'object' &&
            input[0] !== null &&
            !Array.isArray(input[0])) {
            let selection = input[0];
            let aliases = Object.keys(selection);
            let select = aliases.map((alias) => ({
                column: normalizeColumnInput(selection[alias]),
                alias,
            }));
            return this.#clone({ select });
        }
        let columns = input;
        return this.#clone({
            select: columns.map((column) => ({ column, alias: column })),
        });
    }
    /**
     * Toggles `distinct` selection.
     * @param value When `true`, eliminates duplicate rows.
     * @returns A cloned query builder with updated distinct state.
     */
    distinct(value = true) {
        return this.#clone({ distinct: value });
    }
    /**
     * Adds a where predicate.
     * @param input Predicate expression or column-value shorthand.
     * @returns A cloned query builder with the appended where predicate.
     */
    where(input) {
        let predicate = normalizeWhereInput(input);
        let normalizedPredicate = normalizePredicateValues(predicate, createPredicateColumnResolver([this.#table, ...this.#state.joins.map((join) => join.table)]));
        return this.#clone({
            where: [...this.#state.where, normalizedPredicate],
        });
    }
    /**
     * Adds a having predicate.
     * @param input Predicate expression or aggregate filter shorthand.
     * @returns A cloned query builder with the appended having predicate.
     */
    having(input) {
        let predicate = normalizeWhereInput(input);
        let normalizedPredicate = normalizePredicateValues(predicate, createPredicateColumnResolver([this.#table, ...this.#state.joins.map((join) => join.table)]));
        return this.#clone({
            having: [...this.#state.having, normalizedPredicate],
        });
    }
    /**
     * Adds a join clause.
     * @param target Target table to join.
     * @param on Join predicate.
     * @param type Join type.
     * @returns A query builder whose column map includes joined table columns.
     */
    join(target, on, type = 'inner') {
        let normalizedOn = normalizePredicateValues(on, createPredicateColumnResolver([
            this.#table,
            ...this.#state.joins.map((join) => join.table),
            target,
        ]));
        return new QueryBuilder(this.#database, this.#table, {
            select: cloneSelection(this.#state.select),
            distinct: this.#state.distinct,
            joins: [...this.#state.joins, { type, table: target, on: normalizedOn }],
            where: [...this.#state.where],
            groupBy: [...this.#state.groupBy],
            having: [...this.#state.having],
            orderBy: [...this.#state.orderBy],
            limit: this.#state.limit,
            offset: this.#state.offset,
            with: { ...this.#state.with },
        });
    }
    /**
     * Adds a left join clause.
     * @param target Target table to join.
     * @param on Join predicate.
     * @returns A query builder whose column map includes joined table columns.
     */
    leftJoin(target, on) {
        return this.join(target, on, 'left');
    }
    /**
     * Adds a right join clause.
     * @param target Target table to join.
     * @param on Join predicate.
     * @returns A query builder whose column map includes joined table columns.
     */
    rightJoin(target, on) {
        return this.join(target, on, 'right');
    }
    /**
     * Appends an order-by clause.
     * @param column Column to sort by.
     * @param direction Sort direction.
     * @returns A cloned query builder with the appended order-by clause.
     */
    orderBy(column, direction = 'asc') {
        return this.#clone({
            orderBy: [...this.#state.orderBy, { column: normalizeColumnInput(column), direction }],
        });
    }
    /**
     * Appends group-by columns.
     * @param columns Columns to include in the grouping set.
     * @returns A cloned query builder with appended group-by columns.
     */
    groupBy(...columns) {
        return this.#clone({
            groupBy: [...this.#state.groupBy, ...columns.map((column) => normalizeColumnInput(column))],
        });
    }
    /**
     * Limits returned rows.
     * @param value Maximum number of rows to return.
     * @returns A cloned query builder with a row limit.
     */
    limit(value) {
        return this.#clone({ limit: value });
    }
    /**
     * Skips returned rows.
     * @param value Number of rows to skip.
     * @returns A cloned query builder with a row offset.
     */
    offset(value) {
        return this.#clone({ offset: value });
    }
    /**
     * Configures eager-loaded relations.
     * @param relations Relation map describing nested eager-load behavior.
     * @returns A cloned query builder with relation loading configuration.
     */
    with(relations) {
        return this.#clone({
            with: {
                ...this.#state.with,
                ...relations,
            },
        });
    }
    /**
     * Executes the query and returns all rows.
     * @returns All matching rows with requested eager-loaded relations.
     */
    async all() {
        let rows = await this[loadRowsWithRelations]();
        return applyAfterReadHooksToLoadedRows(this.#table, rows, this.#state.with);
    }
    async [loadRowsWithRelations]() {
        let operation = this.#toSelectOperation();
        let result = await this.#database[executeOperation](operation);
        let rows = normalizeRows(result.rows);
        if (Object.keys(this.#state.with).length === 0) {
            return rows;
        }
        return loadRelationsForRows(this.#database, this.#table, rows, this.#state.with);
    }
    /**
     * Executes the query and returns the first row.
     * @returns The first matching row, or `null` when no rows match.
     */
    async first() {
        let rows = await this.limit(1).all();
        return rows[0] ?? null;
    }
    /**
     * Loads a single row by primary key.
     * @param value Primary-key value or composite-key object.
     * @returns The matching row, or `null` when no row exists.
     */
    async find(value) {
        let where = getPrimaryKeyObject(this.#table, value);
        return this.where(where).first();
    }
    /**
     * Executes a count query.
     * @returns Number of rows that match the current query scope.
     */
    async count() {
        let operation = {
            kind: 'count',
            table: this.#table,
            joins: [...this.#state.joins],
            where: [...this.#state.where],
            groupBy: [...this.#state.groupBy],
            having: [...this.#state.having],
        };
        let result = await this.#database[executeOperation](operation);
        if (result.rows && result.rows[0] && typeof result.rows[0].count === 'number') {
            return result.rows[0].count;
        }
        if (result.rows) {
            return result.rows.length;
        }
        return 0;
    }
    /**
     * Executes an existence query.
     * @returns `true` when at least one row matches the current query scope.
     */
    async exists() {
        let operation = {
            kind: 'exists',
            table: this.#table,
            joins: [...this.#state.joins],
            where: [...this.#state.where],
            groupBy: [...this.#state.groupBy],
            having: [...this.#state.having],
        };
        let result = await this.#database[executeOperation](operation);
        if (result.rows && result.rows[0] && typeof result.rows[0].exists === 'boolean') {
            return result.rows[0].exists;
        }
        if (result.rows && result.rows[0] && typeof result.rows[0].count === 'number') {
            return Number(result.rows[0].count) > 0;
        }
        return Boolean(result.rows && result.rows.length > 0);
    }
    /**
     * Inserts one row.
     * @param values Values to insert.
     * @param options Insert options.
     * @param options.returning Optional return selection for adapters that support returning.
     * @param options.touch When `true`, manages timestamp columns automatically.
     * @returns Insert metadata, and optionally the returned row.
     */
    async insert(values, options) {
        assertWriteState(this.#state, 'insert', {
            where: false,
            orderBy: false,
            limit: false,
            offset: false,
        });
        let preparedValues = prepareInsertValues(this.#table, values, this.#database.now(), options?.touch ?? true);
        let returning = options?.returning;
        assertReturningCapability(this.#database.adapter, 'insert', returning);
        if (returning) {
            let operation = {
                kind: 'insert',
                table: this.#table,
                values: preparedValues,
                returning: normalizeReturningSelection(returning),
            };
            let result = await this.#database[executeOperation](operation);
            let row = (applyAfterReadHooksToRows(this.#table, normalizeRows(result.rows))[0] ??
                null);
            let affectedRows = result.affectedRows ?? 0;
            runAfterWriteHook(this.#table, {
                operation: 'create',
                tableName: getTableName(this.#table),
                values: [preparedValues],
                affectedRows,
                insertId: result.insertId,
            });
            return {
                affectedRows,
                insertId: result.insertId,
                row,
            };
        }
        let operation = {
            kind: 'insert',
            table: this.#table,
            values: preparedValues,
        };
        let result = await this.#database[executeOperation](operation);
        let affectedRows = result.affectedRows ?? 0;
        runAfterWriteHook(this.#table, {
            operation: 'create',
            tableName: getTableName(this.#table),
            values: [preparedValues],
            affectedRows,
            insertId: result.insertId,
        });
        let metadata = {
            affectedRows,
            insertId: result.insertId,
        };
        return metadata;
    }
    /**
     * Inserts many rows.
     * @param values Values to insert.
     * @param options Insert options.
     * @param options.returning Optional return selection for adapters that support returning.
     * @param options.touch When `true`, manages timestamp columns automatically.
     * @returns Insert metadata, and optionally the returned rows.
     */
    async insertMany(values, options) {
        assertWriteState(this.#state, 'insertMany', {
            where: false,
            orderBy: false,
            limit: false,
            offset: false,
        });
        let preparedValues = values.map((value) => prepareInsertValues(this.#table, value, this.#database.now(), options?.touch ?? true));
        if (preparedValues.length > 0 &&
            preparedValues.every((preparedValue) => Object.keys(preparedValue).length === 0)) {
            throw new DataTableQueryError('insertMany() requires at least one explicit value across the batch');
        }
        let returning = options?.returning;
        assertReturningCapability(this.#database.adapter, 'insertMany', returning);
        if (returning) {
            let operation = {
                kind: 'insertMany',
                table: this.#table,
                values: preparedValues,
                returning: normalizeReturningSelection(returning),
            };
            let result = await this.#database[executeOperation](operation);
            let affectedRows = result.affectedRows ?? 0;
            runAfterWriteHook(this.#table, {
                operation: 'create',
                tableName: getTableName(this.#table),
                values: preparedValues,
                affectedRows,
                insertId: result.insertId,
            });
            return {
                affectedRows,
                insertId: result.insertId,
                rows: applyAfterReadHooksToRows(this.#table, normalizeRows(result.rows)),
            };
        }
        let operation = {
            kind: 'insertMany',
            table: this.#table,
            values: preparedValues,
        };
        let result = await this.#database[executeOperation](operation);
        let affectedRows = result.affectedRows ?? 0;
        runAfterWriteHook(this.#table, {
            operation: 'create',
            tableName: getTableName(this.#table),
            values: preparedValues,
            affectedRows,
            insertId: result.insertId,
        });
        let metadata = {
            affectedRows,
            insertId: result.insertId,
        };
        return metadata;
    }
    /**
     * Updates scoped rows.
     * @param changes Column changes to apply.
     * @param options Update options.
     * @param options.returning Optional return selection for adapters that support returning.
     * @param options.touch When `true`, updates timestamp columns automatically.
     * @returns Update metadata, and optionally the returned rows.
     */
    async update(changes, options) {
        assertWriteState(this.#state, 'update', {
            where: true,
            orderBy: true,
            limit: true,
            offset: true,
        });
        let returning = options?.returning;
        assertReturningCapability(this.#database.adapter, 'update', returning);
        let preparedChanges = prepareUpdateValues(this.#table, changes, this.#database.now(), options?.touch ?? true);
        if (Object.keys(preparedChanges).length === 0) {
            throw new DataTableQueryError('update() requires at least one change');
        }
        let result;
        if (hasScopedWriteModifiers(this.#state)) {
            let table = this.#table;
            let queryState = this.#state;
            result = await this.#database.transaction(async (tx) => {
                let primaryKeys = await loadPrimaryKeyRowsForScope(tx, table, queryState);
                let primaryKeyPredicate = buildPrimaryKeyPredicate(table, primaryKeys);
                if (!primaryKeyPredicate) {
                    return {
                        affectedRows: 0,
                        insertId: undefined,
                        rows: returning ? [] : undefined,
                    };
                }
                let txRuntime = tx;
                return txRuntime[executeOperation]({
                    kind: 'update',
                    table,
                    changes: preparedChanges,
                    where: [primaryKeyPredicate],
                    returning: returning ? normalizeReturningSelection(returning) : undefined,
                });
            });
        }
        else {
            let operation = {
                kind: 'update',
                table: this.#table,
                changes: preparedChanges,
                where: [...this.#state.where],
                returning: returning ? normalizeReturningSelection(returning) : undefined,
            };
            result = await this.#database[executeOperation](operation);
        }
        let affectedRows = result.affectedRows ?? 0;
        runAfterWriteHook(this.#table, {
            operation: 'update',
            tableName: getTableName(this.#table),
            values: [preparedChanges],
            affectedRows,
            insertId: result.insertId,
        });
        if (!returning) {
            return {
                affectedRows,
                insertId: result.insertId,
            };
        }
        return {
            affectedRows,
            insertId: result.insertId,
            rows: applyAfterReadHooksToRows(this.#table, normalizeRows(result.rows)),
        };
    }
    /**
     * Deletes scoped rows.
     * @param options Delete options.
     * @param options.returning Optional return selection for adapters that support returning.
     * @returns Delete metadata, and optionally the returned rows.
     */
    async delete(options) {
        assertWriteState(this.#state, 'delete', {
            where: true,
            orderBy: true,
            limit: true,
            offset: true,
        });
        let returning = options?.returning;
        assertReturningCapability(this.#database.adapter, 'delete', returning);
        let tableName = getTableName(this.#table);
        let deleteContext = {
            tableName,
            where: [...this.#state.where],
            orderBy: [...this.#state.orderBy],
            limit: this.#state.limit,
            offset: this.#state.offset,
        };
        runBeforeDeleteHook(this.#table, deleteContext);
        let result;
        if (hasScopedWriteModifiers(this.#state)) {
            let table = this.#table;
            let queryState = this.#state;
            result = await this.#database.transaction(async (tx) => {
                let primaryKeys = await loadPrimaryKeyRowsForScope(tx, table, queryState);
                let primaryKeyPredicate = buildPrimaryKeyPredicate(table, primaryKeys);
                if (!primaryKeyPredicate) {
                    return {
                        affectedRows: 0,
                        insertId: undefined,
                        rows: returning ? [] : undefined,
                    };
                }
                let txRuntime = tx;
                return txRuntime[executeOperation]({
                    kind: 'delete',
                    table,
                    where: [primaryKeyPredicate],
                    returning: returning ? normalizeReturningSelection(returning) : undefined,
                });
            });
        }
        else {
            let operation = {
                kind: 'delete',
                table: this.#table,
                where: [...this.#state.where],
                returning: returning ? normalizeReturningSelection(returning) : undefined,
            };
            result = await this.#database[executeOperation](operation);
        }
        let affectedRows = result.affectedRows ?? 0;
        runAfterDeleteHook(this.#table, {
            tableName,
            where: deleteContext.where,
            orderBy: deleteContext.orderBy,
            limit: deleteContext.limit,
            offset: deleteContext.offset,
            affectedRows,
        });
        if (!returning) {
            return {
                affectedRows,
                insertId: result.insertId,
            };
        }
        return {
            affectedRows,
            insertId: result.insertId,
            rows: applyAfterReadHooksToRows(this.#table, normalizeRows(result.rows)),
        };
    }
    /**
     * Performs an upsert operation.
     * @param values Values to insert.
     * @param options Upsert options.
     * @param options.returning Optional return selection for adapters that support returning.
     * @param options.touch When `true`, manages timestamp columns automatically.
     * @param options.conflictTarget Conflict target columns for adapters that require them.
     * @param options.update Optional update payload used when a conflict occurs.
     * @returns Upsert metadata, and optionally the returned row.
     */
    async upsert(values, options) {
        assertWriteState(this.#state, 'upsert', {
            where: false,
            orderBy: false,
            limit: false,
            offset: false,
        });
        if (!this.#database.adapter.capabilities.upsert) {
            throw new DataTableQueryError('Adapter does not support upsert');
        }
        let preparedValues = prepareInsertValues(this.#table, values, this.#database.now(), options?.touch ?? true);
        let updateChanges = options?.update
            ? prepareUpdateValues(this.#table, options.update, this.#database.now(), options?.touch ?? true, 'create')
            : undefined;
        let returning = options?.returning;
        assertReturningCapability(this.#database.adapter, 'upsert', returning);
        if (returning) {
            let operation = {
                kind: 'upsert',
                table: this.#table,
                values: preparedValues,
                conflictTarget: options?.conflictTarget ? [...options.conflictTarget] : undefined,
                update: updateChanges,
                returning: normalizeReturningSelection(returning),
            };
            let result = await this.#database[executeOperation](operation);
            let row = (applyAfterReadHooksToRows(this.#table, normalizeRows(result.rows))[0] ??
                null);
            let affectedRows = result.affectedRows ?? 0;
            let preparedWriteValues = updateChanges
                ? [preparedValues, updateChanges]
                : [preparedValues];
            runAfterWriteHook(this.#table, {
                operation: 'create',
                tableName: getTableName(this.#table),
                values: preparedWriteValues,
                affectedRows,
                insertId: result.insertId,
            });
            return {
                affectedRows,
                insertId: result.insertId,
                row,
            };
        }
        let operation = {
            kind: 'upsert',
            table: this.#table,
            values: preparedValues,
            conflictTarget: options?.conflictTarget ? [...options.conflictTarget] : undefined,
            update: updateChanges,
        };
        let result = await this.#database[executeOperation](operation);
        let affectedRows = result.affectedRows ?? 0;
        let preparedWriteValues = updateChanges
            ? [preparedValues, updateChanges]
            : [preparedValues];
        runAfterWriteHook(this.#table, {
            operation: 'create',
            tableName: getTableName(this.#table),
            values: preparedWriteValues,
            affectedRows,
            insertId: result.insertId,
        });
        let metadata = {
            affectedRows,
            insertId: result.insertId,
        };
        return metadata;
    }
    #toSelectOperation() {
        return {
            kind: 'select',
            table: this.#table,
            select: cloneSelection(this.#state.select),
            distinct: this.#state.distinct,
            joins: [...this.#state.joins],
            where: [...this.#state.where],
            groupBy: [...this.#state.groupBy],
            having: [...this.#state.having],
            orderBy: [...this.#state.orderBy],
            limit: this.#state.limit,
            offset: this.#state.offset,
        };
    }
    #clone(patch) {
        return new QueryBuilder(this.#database, this.#table, {
            select: patch.select ?? cloneSelection(this.#state.select),
            distinct: patch.distinct ?? this.#state.distinct,
            joins: patch.joins ? [...patch.joins] : [...this.#state.joins],
            where: patch.where ? [...patch.where] : [...this.#state.where],
            groupBy: patch.groupBy ? [...patch.groupBy] : [...this.#state.groupBy],
            having: patch.having ? [...patch.having] : [...this.#state.having],
            orderBy: patch.orderBy ? [...patch.orderBy] : [...this.#state.orderBy],
            limit: patch.limit === undefined ? this.#state.limit : patch.limit,
            offset: patch.offset === undefined ? this.#state.offset : patch.offset,
            with: patch.with ? { ...patch.with } : { ...this.#state.with },
        });
    }
}
async function loadRelationsForRows(database, sourceTable, rows, relationMap) {
    let output = rows.map((row) => ({ ...row }));
    let relationNames = Object.keys(relationMap);
    for (let relationName of relationNames) {
        let relation = relationMap[relationName];
        if (relation.sourceTable !== sourceTable) {
            throw new DataTableQueryError('Relation "' +
                relationName +
                '" is not defined for source table "' +
                getTableName(sourceTable) +
                '"');
        }
        let values = await resolveRelationValues(database, output, relation);
        let index = 0;
        while (index < output.length) {
            output[index][relationName] = values[index];
            index += 1;
        }
    }
    return output;
}
async function resolveRelationValues(database, sourceRows, relation) {
    if (relation.relationKind === 'hasManyThrough') {
        return loadHasManyThroughValues(database, sourceRows, relation);
    }
    return loadDirectRelationValues(database, sourceRows, relation);
}
async function loadDirectRelationValues(database, sourceRows, relation) {
    if (sourceRows.length === 0) {
        return [];
    }
    let sourceTuples = uniqueTuples(sourceRows, relation.sourceKey);
    if (sourceTuples.length === 0) {
        return sourceRows.map(() => (relation.cardinality === 'many' ? [] : null));
    }
    let query = database.query(relation.targetTable);
    let linkPredicate = buildLinkPredicate(relation.targetKey, sourceTuples);
    if (linkPredicate) {
        query = query.where(linkPredicate);
    }
    query = applyRelationModifiers(query, relation, {
        includePagination: false,
    });
    let relatedRows = await query[loadRowsWithRelations]();
    let grouped = groupRowsByTuple(relatedRows, relation.targetKey);
    return sourceRows.map((sourceRow) => {
        let key = getCompositeKey(sourceRow, relation.sourceKey);
        let matches = grouped.get(key) ?? [];
        let pagedMatches = applyPagination(matches, relation.modifiers.limit, relation.modifiers.offset);
        if (relation.cardinality === 'many') {
            return pagedMatches;
        }
        return pagedMatches[0] ?? null;
    });
}
async function loadHasManyThroughValues(database, sourceRows, relation) {
    if (!relation.through) {
        throw new DataTableQueryError('hasManyThrough relation is missing through metadata');
    }
    if (sourceRows.length === 0) {
        return [];
    }
    let throughRelation = relation.through.relation;
    let sourceTuples = uniqueTuples(sourceRows, throughRelation.sourceKey);
    if (sourceTuples.length === 0) {
        return sourceRows.map(() => []);
    }
    let throughQuery = database.query(throughRelation.targetTable);
    let throughPredicate = buildLinkPredicate(throughRelation.targetKey, sourceTuples);
    if (throughPredicate) {
        throughQuery = throughQuery.where(throughPredicate);
    }
    throughQuery = applyRelationModifiers(throughQuery, throughRelation, {
        includePagination: false,
    });
    let throughRows = await throughQuery[loadRowsWithRelations]();
    if (throughRows.length === 0) {
        return sourceRows.map(() => []);
    }
    let throughRowsBySource = groupRowsByTuple(throughRows, throughRelation.targetKey);
    let pagedThroughRowsBySource = new Map();
    let pagedThroughRows = [];
    for (let sourceRow of sourceRows) {
        let sourceKey = getCompositeKey(sourceRow, throughRelation.sourceKey);
        let matchedThroughRows = throughRowsBySource.get(sourceKey) ?? [];
        let pagedMatchedRows = applyPagination(matchedThroughRows, throughRelation.modifiers.limit, throughRelation.modifiers.offset);
        pagedThroughRowsBySource.set(sourceKey, pagedMatchedRows);
        pagedThroughRows.push(...pagedMatchedRows);
    }
    let throughTuples = uniqueTuples(pagedThroughRows, relation.through.throughSourceKey);
    if (throughTuples.length === 0) {
        return sourceRows.map(() => []);
    }
    let targetQuery = database.query(relation.targetTable);
    let targetPredicate = buildLinkPredicate(relation.through.throughTargetKey, throughTuples);
    if (targetPredicate) {
        targetQuery = targetQuery.where(targetPredicate);
    }
    targetQuery = applyRelationModifiers(targetQuery, relation, {
        includePagination: false,
    });
    let relatedRows = await targetQuery[loadRowsWithRelations]();
    let targetRowsByThrough = groupRowsByTuple(relatedRows, relation.through.throughTargetKey);
    return sourceRows.map((sourceRow) => {
        let sourceKey = getCompositeKey(sourceRow, throughRelation.sourceKey);
        let matchedThroughRows = pagedThroughRowsBySource.get(sourceKey) ?? [];
        let outputRows = [];
        let seen = new Set();
        for (let throughRow of matchedThroughRows) {
            let throughKey = getCompositeKey(throughRow, relation.through.throughSourceKey);
            let rowsForThrough = targetRowsByThrough.get(throughKey) ?? [];
            for (let row of rowsForThrough) {
                let rowIdentity = getCompositeKey(row, getTablePrimaryKey(relation.targetTable));
                if (!seen.has(rowIdentity)) {
                    seen.add(rowIdentity);
                    outputRows.push(row);
                }
            }
        }
        return applyPagination(outputRows, relation.modifiers.limit, relation.modifiers.offset);
    });
}
function applyRelationModifiers(query, relation, options) {
    let next = query;
    for (let predicate of relation.modifiers.where) {
        next = next.where(predicate);
    }
    for (let clause of relation.modifiers.orderBy) {
        next = next.orderBy(clause.column, clause.direction);
    }
    if (options.includePagination && relation.modifiers.limit !== undefined) {
        next = next.limit(relation.modifiers.limit);
    }
    if (options.includePagination && relation.modifiers.offset !== undefined) {
        next = next.offset(relation.modifiers.offset);
    }
    if (Object.keys(relation.modifiers.with).length > 0) {
        next = next.with(relation.modifiers.with);
    }
    return next;
}
function applyPagination(rows, limit, offset) {
    let offsetRows = offset === undefined ? rows : rows.slice(offset);
    return limit === undefined ? offsetRows : offsetRows.slice(0, limit);
}
function normalizeRows(rows) {
    if (!rows) {
        return [];
    }
    return rows.map((row) => ({ ...row }));
}
function hasScopedWriteModifiers(state) {
    return state.orderBy.length > 0 || state.limit !== undefined || state.offset !== undefined;
}
function asQueryTableInput(table) {
    return table;
}
function getPrimaryKeyWhere(table, value) {
    return getPrimaryKeyObject(table, value);
}
function getPrimaryKeyWhereFromRow(table, row) {
    let where = {};
    for (let key of getTablePrimaryKey(table)) {
        where[key] = row[key];
    }
    return where;
}
function resolveCreateRowWhere(table, values, insertId) {
    let primaryKey = getTablePrimaryKey(table);
    if (primaryKey.length === 1) {
        let key = primaryKey[0];
        if (Object.prototype.hasOwnProperty.call(values, key)) {
            return {
                [key]: values[key],
            };
        }
        if (insertId !== undefined) {
            return {
                [key]: insertId,
            };
        }
    }
    let where = {};
    for (let key of primaryKey) {
        if (!Object.prototype.hasOwnProperty.call(values, key)) {
            throw new DataTableQueryError('create({ returnRow: true }) requires primary key values for table "' +
                getTableName(table) +
                '" when adapter does not support RETURNING');
        }
        where[key] = values[key];
    }
    return where;
}
function normalizeOrderByInput(input) {
    if (!input) {
        return [];
    }
    if (input.length === 0) {
        return [];
    }
    if (Array.isArray(input[0])) {
        return input;
    }
    return [input];
}
function toWriteResult(result) {
    return {
        affectedRows: result.affectedRows,
        insertId: result.insertId,
    };
}
function assertWriteState(state, operation, policy) {
    let unsupported = [];
    if (state.select !== '*') {
        unsupported.push('select()');
    }
    if (state.distinct) {
        unsupported.push('distinct()');
    }
    if (state.joins.length > 0) {
        unsupported.push('join()');
    }
    if (state.groupBy.length > 0) {
        unsupported.push('groupBy()');
    }
    if (state.having.length > 0) {
        unsupported.push('having()');
    }
    if (Object.keys(state.with).length > 0) {
        unsupported.push('with()');
    }
    if (!policy.where && state.where.length > 0) {
        unsupported.push('where()');
    }
    if (!policy.orderBy && state.orderBy.length > 0) {
        unsupported.push('orderBy()');
    }
    if (!policy.limit && state.limit !== undefined) {
        unsupported.push('limit()');
    }
    if (!policy.offset && state.offset !== undefined) {
        unsupported.push('offset()');
    }
    if (unsupported.length > 0) {
        throw new DataTableQueryError(operation + '() does not support these query modifiers: ' + unsupported.join(', '));
    }
}
async function loadPrimaryKeyRowsForScope(database, table, state) {
    let query = database.query(table);
    for (let predicate of state.where) {
        query = query.where(predicate);
    }
    for (let clause of state.orderBy) {
        query = query.orderBy(clause.column, clause.direction);
    }
    if (state.limit !== undefined) {
        query = query.limit(state.limit);
    }
    if (state.offset !== undefined) {
        query = query.offset(state.offset);
    }
    let rows = await query
        .select(...getTablePrimaryKey(table))[loadRowsWithRelations]();
    let primaryKeys = getTablePrimaryKey(table);
    return rows.map((row) => {
        let keyObject = {};
        for (let key of rowKeys(row, primaryKeys)) {
            keyObject[key] = row[key];
        }
        return keyObject;
    });
}
function createInitialQueryState() {
    return {
        select: '*',
        distinct: false,
        joins: [],
        where: [],
        groupBy: [],
        having: [],
        orderBy: [],
        with: {},
    };
}
function cloneSelection(selection) {
    if (selection === '*') {
        return '*';
    }
    return selection.map((column) => ({ ...column }));
}
function defaultNow() {
    return new Date();
}
function prepareInsertValues(table, values, now, touch) {
    let output = validateWriteValues(table, values, 'create');
    let timestamps = getTableTimestamps(table);
    let columns = getTableColumns(table);
    if (touch && timestamps) {
        let createdAt = timestamps.createdAt;
        let updatedAt = timestamps.updatedAt;
        if (Object.prototype.hasOwnProperty.call(columns, createdAt) &&
            output[createdAt] === undefined) {
            output[createdAt] = now;
        }
        if (Object.prototype.hasOwnProperty.call(columns, updatedAt) &&
            output[updatedAt] === undefined) {
            output[updatedAt] = now;
        }
    }
    return output;
}
function prepareUpdateValues(table, values, now, touch, operation = 'update') {
    let output = validateWriteValues(table, values, operation);
    let timestamps = getTableTimestamps(table);
    let columns = getTableColumns(table);
    if (touch && timestamps) {
        let updatedAt = timestamps.updatedAt;
        if (Object.prototype.hasOwnProperty.call(columns, updatedAt) &&
            output[updatedAt] === undefined) {
            output[updatedAt] = now;
        }
    }
    return output;
}
function validateWriteValues(table, values, operation) {
    let tableName = getTableName(table);
    let normalizedInput = normalizeWriteObject(table, values, operation);
    let beforeWrite = getTableBeforeWrite(table);
    if (beforeWrite) {
        let beforeWriteResult = beforeWrite({
            operation,
            tableName,
            value: normalizedInput,
        });
        assertSynchronousCallbackResult(tableName, operation, 'beforeWrite', beforeWriteResult);
        if (hasIssues(beforeWriteResult)) {
            throwValidationIssues(tableName, beforeWriteResult.issues, operation, 'beforeWrite');
        }
        if (!hasValue(beforeWriteResult)) {
            throw new DataTableValidationError('Invalid beforeWrite callback result for table "' + tableName + '"', [{ message: 'Expected beforeWrite to return { value } or { issues }' }], {
                metadata: {
                    table: tableName,
                    operation,
                    source: 'beforeWrite',
                },
            });
        }
        normalizedInput = normalizeWriteObject(table, beforeWriteResult.value, operation, 'beforeWrite');
    }
    let validator = getTableValidator(table);
    if (!validator) {
        return normalizedInput;
    }
    let validationResult = validator({
        operation,
        tableName,
        value: normalizedInput,
    });
    assertSynchronousCallbackResult(tableName, operation, 'validate', validationResult);
    if (hasIssues(validationResult)) {
        throwValidationIssues(tableName, validationResult.issues, operation, 'validate');
    }
    if (!hasValue(validationResult)) {
        throw new DataTableValidationError('Invalid validator result for table "' + tableName + '"', [{ message: 'Expected validator to return { value } or { issues }' }], {
            metadata: {
                table: tableName,
                operation,
                source: 'validate',
            },
        });
    }
    return normalizeWriteObject(table, validationResult.value, operation, 'validate');
}
function hasIssues(value) {
    return typeof value === 'object' && value !== null && 'issues' in value;
}
function hasValue(value) {
    return typeof value === 'object' && value !== null && 'value' in value;
}
function normalizeWriteObject(table, value, operation, source) {
    let tableName = getTableName(table);
    let columns = getTableColumns(table);
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        throw new DataTableValidationError('Invalid value for table "' + tableName + '"', [{ message: 'Expected object' }], {
            metadata: {
                table: tableName,
                operation,
                ...(source ? { source } : {}),
            },
        });
    }
    let output = {};
    for (let key in value) {
        if (!Object.prototype.hasOwnProperty.call(value, key)) {
            continue;
        }
        if (!Object.prototype.hasOwnProperty.call(columns, key)) {
            throw new DataTableValidationError('Unknown column "' + key + '" for table "' + tableName + '"', [], {
                metadata: {
                    table: tableName,
                    column: key,
                    operation,
                    ...(source ? { source } : {}),
                },
            });
        }
        output[key] = value[key];
    }
    return output;
}
function throwValidationIssues(tableName, issues, operation, source) {
    let firstIssue = issues[0];
    let issuePath = firstIssue?.path;
    let firstPathSegment = issuePath && issuePath.length > 0 ? issuePath[0] : undefined;
    let column = typeof firstPathSegment === 'string' ? firstPathSegment : undefined;
    if (column) {
        throw new DataTableValidationError('Invalid value for column "' + column + '" in table "' + tableName + '"', issues, {
            metadata: {
                table: tableName,
                column,
                operation,
                ...(source ? { source } : {}),
            },
        });
    }
    throw new DataTableValidationError('Invalid value for table "' + tableName + '"', issues, {
        metadata: {
            table: tableName,
            operation,
            ...(source ? { source } : {}),
        },
    });
}
function assertSynchronousCallbackResult(tableName, operation, callbackName, value) {
    if (!isPromiseLike(value)) {
        return;
    }
    throw new DataTableValidationError('Invalid ' + callbackName + ' callback result for table "' + tableName + '"', [{ message: callbackName + ' callbacks must be synchronous and cannot return a Promise' }], {
        metadata: {
            table: tableName,
            operation,
            source: callbackName,
        },
    });
}
function isPromiseLike(value) {
    return ((typeof value === 'object' || typeof value === 'function') &&
        value !== null &&
        'then' in value &&
        typeof value.then === 'function');
}
function runBeforeDeleteHook(table, context) {
    let callback = getTableBeforeDelete(table);
    if (!callback) {
        return;
    }
    let callbackResult = callback(context);
    assertSynchronousCallbackResult(context.tableName, 'delete', 'beforeDelete', callbackResult);
    if (callbackResult === undefined) {
        return;
    }
    if (hasIssues(callbackResult)) {
        throwValidationIssues(context.tableName, callbackResult.issues, 'delete', 'beforeDelete');
    }
    throw new DataTableValidationError('Invalid beforeDelete callback result for table "' + context.tableName + '"', [{ message: 'Expected beforeDelete to return nothing or { issues }' }], {
        metadata: {
            table: context.tableName,
            operation: 'delete',
            source: 'beforeDelete',
        },
    });
}
function runAfterWriteHook(table, context) {
    let callback = getTableAfterWrite(table);
    if (!callback) {
        return;
    }
    let callbackResult = callback(context);
    assertSynchronousCallbackResult(context.tableName, context.operation, 'afterWrite', callbackResult);
}
function runAfterDeleteHook(table, context) {
    let callback = getTableAfterDelete(table);
    if (!callback) {
        return;
    }
    let callbackResult = callback(context);
    assertSynchronousCallbackResult(context.tableName, 'delete', 'afterDelete', callbackResult);
}
function applyAfterReadHooksToRows(table, rows) {
    let callback = getTableAfterRead(table);
    if (!callback || rows.length === 0) {
        return rows;
    }
    let tableName = getTableName(table);
    return rows.map((row) => {
        let callbackResult = callback({
            tableName,
            value: row,
        });
        assertSynchronousCallbackResult(tableName, 'read', 'afterRead', callbackResult);
        if (hasIssues(callbackResult)) {
            throwValidationIssues(tableName, callbackResult.issues, 'read', 'afterRead');
        }
        if (!hasValue(callbackResult)) {
            throw new DataTableValidationError('Invalid afterRead callback result for table "' + tableName + '"', [{ message: 'Expected afterRead to return { value } or { issues }' }], {
                metadata: {
                    table: tableName,
                    operation: 'read',
                    source: 'afterRead',
                },
            });
        }
        return normalizeReadObject(tableName, callbackResult.value);
    });
}
function applyAfterReadHooksToLoadedRows(table, rows, relationMap) {
    if (rows.length === 0) {
        return rows;
    }
    let relationNames = Object.keys(relationMap);
    if (relationNames.length > 0) {
        for (let row of rows) {
            for (let relationName of relationNames) {
                let relation = relationMap[relationName];
                let relationValue = row[relationName];
                if (relation.cardinality === 'many') {
                    if (!Array.isArray(relationValue)) {
                        continue;
                    }
                    row[relationName] = applyAfterReadHooksToLoadedRows(relation.targetTable, relationValue, relation.modifiers.with);
                    continue;
                }
                if (relationValue === null || relationValue === undefined) {
                    continue;
                }
                if (typeof relationValue !== 'object' || Array.isArray(relationValue)) {
                    continue;
                }
                let transformed = applyAfterReadHooksToLoadedRows(relation.targetTable, [relationValue], relation.modifiers.with);
                row[relationName] = transformed[0] ?? null;
            }
        }
    }
    return applyAfterReadHooksToRows(table, rows);
}
function normalizeReadObject(tableName, value) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        throw new DataTableValidationError('Invalid afterRead callback result for table "' + tableName + '"', [{ message: 'Expected afterRead to return an object value' }], {
            metadata: {
                table: tableName,
                operation: 'read',
                source: 'afterRead',
            },
        });
    }
    return {
        ...value,
    };
}
function createPredicateColumnResolver(tables) {
    let qualifiedColumns = new Map();
    let unqualifiedColumns = new Map();
    let ambiguousColumns = new Set();
    for (let table of tables) {
        let tableColumns = getTableColumns(table);
        let tableName = getTableName(table);
        for (let columnName in tableColumns) {
            if (!Object.prototype.hasOwnProperty.call(tableColumns, columnName)) {
                continue;
            }
            let resolvedColumn = {
                tableName,
                columnName,
            };
            qualifiedColumns.set(tableName + '.' + columnName, resolvedColumn);
            if (ambiguousColumns.has(columnName)) {
                continue;
            }
            if (unqualifiedColumns.has(columnName)) {
                unqualifiedColumns.delete(columnName);
                ambiguousColumns.add(columnName);
                continue;
            }
            unqualifiedColumns.set(columnName, resolvedColumn);
        }
    }
    return function resolveColumn(column) {
        let qualified = qualifiedColumns.get(column);
        if (qualified) {
            return qualified;
        }
        if (column.includes('.')) {
            throw new DataTableQueryError('Unknown predicate column "' + column + '"');
        }
        if (ambiguousColumns.has(column)) {
            throw new DataTableQueryError('Ambiguous predicate column "' + column + '". Use a qualified column name');
        }
        let unqualified = unqualifiedColumns.get(column);
        if (!unqualified) {
            throw new DataTableQueryError('Unknown predicate column "' + column + '"');
        }
        return unqualified;
    };
}
function normalizePredicateValues(predicate, resolveColumn) {
    if (predicate.type === 'comparison') {
        let column = resolveColumn(predicate.column);
        if (predicate.valueType === 'column') {
            resolveColumn(predicate.value);
            return predicate;
        }
        if (predicate.operator === 'in' || predicate.operator === 'notIn') {
            if (!Array.isArray(predicate.value)) {
                throw new DataTableValidationError('Invalid filter value for column "' +
                    column.columnName +
                    '" in table "' +
                    column.tableName +
                    '"', [{ message: 'Expected an array value for "' + predicate.operator + '" predicate' }], {
                    metadata: {
                        table: column.tableName,
                        column: column.columnName,
                    },
                });
            }
            return predicate;
        }
        return predicate;
    }
    if (predicate.type === 'between') {
        resolveColumn(predicate.column);
        return predicate;
    }
    if (predicate.type === 'null') {
        resolveColumn(predicate.column);
        return predicate;
    }
    return {
        ...predicate,
        predicates: predicate.predicates.map((child) => normalizePredicateValues(child, resolveColumn)),
    };
}
function uniqueTuples(rows, columns) {
    let output = [];
    let seen = new Set();
    for (let row of rows) {
        let tuple = columns.map((column) => row[column]);
        let key = tuple.map(stringifyForKey).join('::');
        if (!seen.has(key)) {
            seen.add(key);
            output.push(tuple);
        }
    }
    return output;
}
function buildLinkPredicate(targetColumns, tuples) {
    if (tuples.length === 0) {
        return undefined;
    }
    if (targetColumns.length === 1) {
        return inList(targetColumns[0], tuples.map((tuple) => tuple[0]));
    }
    let tuplePredicates = tuples.map((tuple) => {
        let comparisons = targetColumns.map((column, index) => eq(column, tuple[index]));
        return and(...comparisons);
    });
    return or(...tuplePredicates);
}
function groupRowsByTuple(rows, columns) {
    let output = new Map();
    for (let row of rows) {
        let key = getCompositeKey(row, columns);
        let group = output.get(key);
        if (group) {
            group.push(row);
            continue;
        }
        output.set(key, [row]);
    }
    return output;
}
function stringifyForKey(value) {
    if (value === null) {
        return 'null';
    }
    if (value === undefined) {
        return 'undefined';
    }
    if (value instanceof Date) {
        return 'date:' + value.toISOString();
    }
    if (typeof value === 'string') {
        return JSON.stringify(value);
    }
    if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
        return String(value);
    }
    return JSON.stringify(value);
}
function normalizeReturningSelection(returning) {
    if (returning === '*') {
        return '*';
    }
    return [...returning];
}
function buildPrimaryKeyPredicate(table, keyObjects) {
    let primaryKey = getTablePrimaryKey(table);
    if (keyObjects.length === 0) {
        return undefined;
    }
    if (primaryKey.length === 1) {
        let key = primaryKey[0];
        return inList(key, keyObjects.map((objectValue) => objectValue[key]));
    }
    let predicates = keyObjects.map((objectValue) => {
        let comparisons = primaryKey.map((key) => {
            let typedKey = key;
            return eq(typedKey, objectValue[typedKey]);
        });
        return and(...comparisons);
    });
    return or(...predicates);
}
function rowKeys(row, keys) {
    let output = [];
    for (let key of keys) {
        if (Object.prototype.hasOwnProperty.call(row, key)) {
            output.push(key);
        }
    }
    return output;
}
function assertReturningCapability(adapter, operation, returning) {
    if (returning && !adapter.capabilities.returning) {
        throw new DataTableQueryError(operation + '() returning is not supported by this adapter');
    }
}
