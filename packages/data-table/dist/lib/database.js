import { parseSafe } from '@remix-run/data-schema';
import { DataTableAdapterError, DataTableQueryError, DataTableValidationError } from "./errors.js";
import { getCompositeKey, getPrimaryKeyObject } from "./model.js";
import { and, eq, inList, normalizeWhereInput, or } from "./operators.js";
import { rawSql, isSqlStatement } from "./sql.js";
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
    query(table) {
        return new QueryBuilder(this, table, createInitialQueryState());
    }
    async exec(statement, values = []) {
        let sqlStatement = isSqlStatement(statement) ? statement : rawSql(statement, values);
        return this.execute({
            kind: 'raw',
            sql: sqlStatement,
        });
    }
    async transaction(callback, options) {
        if (!this.#token) {
            let token = await this.#adapter.beginTransaction(options);
            let transactionDatabase = new DatabaseRuntime({
                adapter: this.#adapter,
                token,
                now: this.#now,
                savepointCounter: this.#savepointCounter,
            });
            try {
                let result = await callback(transactionDatabase);
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
    async execute(statement) {
        try {
            return await this.#adapter.execute({
                statement,
                transaction: this.#token,
            });
        }
        catch (error) {
            throw new DataTableAdapterError('Adapter execution failed', {
                cause: error,
                metadata: {
                    dialect: this.#adapter.dialect,
                    statementKind: statement.kind,
                },
            });
        }
    }
}
export function createDatabase(adapter, options) {
    let now = options?.now ?? defaultNow;
    return new DatabaseRuntime({
        adapter,
        token: undefined,
        now,
        savepointCounter: { value: 0 },
    });
}
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
                column: selection[alias],
                alias,
            }));
            return this.#clone({ select });
        }
        let columns = input;
        return this.#clone({
            select: columns.map((column) => ({ column, alias: column })),
        });
    }
    distinct(value = true) {
        return this.#clone({ distinct: value });
    }
    where(input) {
        let predicate = normalizeWhereInput(input);
        let normalizedPredicate = normalizePredicateValues(predicate, createPredicateColumnResolver([this.#table, ...this.#state.joins.map((join) => join.table)]));
        return this.#clone({
            where: [...this.#state.where, normalizedPredicate],
        });
    }
    having(input) {
        let predicate = normalizeWhereInput(input);
        let normalizedPredicate = normalizePredicateValues(predicate, createPredicateColumnResolver([this.#table, ...this.#state.joins.map((join) => join.table)]));
        return this.#clone({
            having: [...this.#state.having, normalizedPredicate],
        });
    }
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
    leftJoin(target, on) {
        return this.join(target, on, 'left');
    }
    rightJoin(target, on) {
        return this.join(target, on, 'right');
    }
    fullJoin(target, on) {
        return this.join(target, on, 'full');
    }
    orderBy(column, direction = 'asc') {
        return this.#clone({
            orderBy: [...this.#state.orderBy, { column, direction }],
        });
    }
    groupBy(...columns) {
        return this.#clone({
            groupBy: [...this.#state.groupBy, ...columns],
        });
    }
    limit(value) {
        return this.#clone({ limit: value });
    }
    offset(value) {
        return this.#clone({ offset: value });
    }
    with(relations) {
        return this.#clone({
            with: {
                ...this.#state.with,
                ...relations,
            },
        });
    }
    async all() {
        let statement = this.#toSelectStatement();
        let result = await this.#database.execute(statement);
        let rows = normalizeRows(result.rows);
        if (Object.keys(this.#state.with).length === 0) {
            return rows;
        }
        let rowsWithRelations = await loadRelationsForRows(this.#database, this.#table, rows, this.#state.with);
        return rowsWithRelations;
    }
    async first() {
        let rows = await this.limit(1).all();
        return rows[0] ?? null;
    }
    async find(value) {
        let where = getPrimaryKeyObject(this.#table, value);
        return this.where(where).first();
    }
    async count() {
        let statement = {
            kind: 'count',
            table: this.#table,
            joins: [...this.#state.joins],
            where: [...this.#state.where],
            groupBy: [...this.#state.groupBy],
            having: [...this.#state.having],
        };
        let result = await this.#database.execute(statement);
        if (result.rows && result.rows[0] && typeof result.rows[0].count === 'number') {
            return result.rows[0].count;
        }
        if (result.rows) {
            return result.rows.length;
        }
        return 0;
    }
    async exists() {
        let statement = {
            kind: 'exists',
            table: this.#table,
            joins: [...this.#state.joins],
            where: [...this.#state.where],
            groupBy: [...this.#state.groupBy],
            having: [...this.#state.having],
        };
        let result = await this.#database.execute(statement);
        if (result.rows && result.rows[0] && typeof result.rows[0].exists === 'boolean') {
            return result.rows[0].exists;
        }
        if (result.rows && result.rows[0] && typeof result.rows[0].count === 'number') {
            return Number(result.rows[0].count) > 0;
        }
        return Boolean(result.rows && result.rows.length > 0);
    }
    async insert(values, options) {
        assertWriteState(this.#state, 'insert', {
            where: false,
            orderBy: false,
            limit: false,
            offset: false,
        });
        let preparedValues = prepareInsertValues(this.#table, values, this.#database.now(), options?.touch ?? true);
        let returning = options?.returning;
        if (returning && this.#database.adapter.capabilities.returning) {
            let statement = {
                kind: 'insert',
                table: this.#table,
                values: preparedValues,
                returning: normalizeReturningSelection(returning),
            };
            let result = await this.#database.execute(statement);
            let row = (normalizeRows(result.rows)[0] ?? null);
            return {
                affectedRows: result.affectedRows ?? 0,
                insertId: result.insertId,
                row,
            };
        }
        let statement = {
            kind: 'insert',
            table: this.#table,
            values: preparedValues,
        };
        let result = await this.#database.execute(statement);
        let metadata = {
            affectedRows: result.affectedRows ?? 0,
            insertId: result.insertId,
        };
        if (!returning) {
            return metadata;
        }
        let row = await this.#loadInsertedRow(preparedValues, result.insertId, returning);
        return {
            ...metadata,
            row,
        };
    }
    async insertMany(values, options) {
        assertWriteState(this.#state, 'insertMany', {
            where: false,
            orderBy: false,
            limit: false,
            offset: false,
        });
        let preparedValues = values.map((value) => prepareInsertValues(this.#table, value, this.#database.now(), options?.touch ?? true));
        let returning = options?.returning;
        if (returning && this.#database.adapter.capabilities.returning) {
            let statement = {
                kind: 'insertMany',
                table: this.#table,
                values: preparedValues,
                returning: normalizeReturningSelection(returning),
            };
            let result = await this.#database.execute(statement);
            return {
                affectedRows: result.affectedRows ?? 0,
                insertId: result.insertId,
                rows: normalizeRows(result.rows),
            };
        }
        let statement = {
            kind: 'insertMany',
            table: this.#table,
            values: preparedValues,
        };
        let result = await this.#database.execute(statement);
        let metadata = {
            affectedRows: result.affectedRows ?? 0,
            insertId: result.insertId,
        };
        if (!returning) {
            return metadata;
        }
        let rows = await this.#loadInsertedRows(preparedValues, returning);
        return {
            ...metadata,
            rows,
        };
    }
    async update(changes, options) {
        assertWriteState(this.#state, 'update', {
            where: true,
            orderBy: true,
            limit: true,
            offset: true,
        });
        let preparedChanges = prepareUpdateValues(this.#table, changes, this.#database.now(), options?.touch ?? true);
        let returning = options?.returning;
        if (Object.keys(preparedChanges).length === 0) {
            throw new DataTableQueryError('update() requires at least one change');
        }
        if (hasScopedWriteModifiers(this.#state)) {
            let table = this.#table;
            let queryState = this.#state;
            return this.#database.transaction(async (transactionDatabase) => {
                let primaryKeys = await loadPrimaryKeyRowsForScope(transactionDatabase, table, queryState);
                let primaryKeyPredicate = buildPrimaryKeyPredicate(table, primaryKeys);
                if (!primaryKeyPredicate) {
                    if (!returning) {
                        return {
                            affectedRows: 0,
                            insertId: undefined,
                        };
                    }
                    return {
                        affectedRows: 0,
                        insertId: undefined,
                        rows: [],
                    };
                }
                return transactionDatabase.query(table).where(primaryKeyPredicate).update(changes, options);
            });
        }
        if (returning && !this.#database.adapter.capabilities.returning) {
            let primaryKeys = await this.#loadCurrentPrimaryKeyRows();
            let statement = {
                kind: 'update',
                table: this.#table,
                changes: preparedChanges,
                where: [...this.#state.where],
            };
            let result = await this.#database.execute(statement);
            let rows = await this.#loadRowsByPrimaryKeys(primaryKeys, returning);
            return {
                affectedRows: result.affectedRows ?? 0,
                insertId: result.insertId,
                rows,
            };
        }
        let statement = {
            kind: 'update',
            table: this.#table,
            changes: preparedChanges,
            where: [...this.#state.where],
            returning: returning ? normalizeReturningSelection(returning) : undefined,
        };
        let result = await this.#database.execute(statement);
        if (!returning) {
            return {
                affectedRows: result.affectedRows ?? 0,
                insertId: result.insertId,
            };
        }
        return {
            affectedRows: result.affectedRows ?? 0,
            insertId: result.insertId,
            rows: normalizeRows(result.rows),
        };
    }
    async delete(options) {
        assertWriteState(this.#state, 'delete', {
            where: true,
            orderBy: true,
            limit: true,
            offset: true,
        });
        let returning = options?.returning;
        if (hasScopedWriteModifiers(this.#state)) {
            let table = this.#table;
            let queryState = this.#state;
            return this.#database.transaction(async (transactionDatabase) => {
                let primaryKeys = await loadPrimaryKeyRowsForScope(transactionDatabase, table, queryState);
                let primaryKeyPredicate = buildPrimaryKeyPredicate(table, primaryKeys);
                if (!primaryKeyPredicate) {
                    if (!returning) {
                        return {
                            affectedRows: 0,
                            insertId: undefined,
                        };
                    }
                    return {
                        affectedRows: 0,
                        insertId: undefined,
                        rows: [],
                    };
                }
                return transactionDatabase.query(table).where(primaryKeyPredicate).delete(options);
            });
        }
        if (returning && !this.#database.adapter.capabilities.returning) {
            let rowsBeforeDelete = await this.#selectCurrentRows(returning);
            let statement = {
                kind: 'delete',
                table: this.#table,
                where: [...this.#state.where],
            };
            let result = await this.#database.execute(statement);
            return {
                affectedRows: result.affectedRows ?? 0,
                insertId: result.insertId,
                rows: rowsBeforeDelete,
            };
        }
        let statement = {
            kind: 'delete',
            table: this.#table,
            where: [...this.#state.where],
            returning: returning ? normalizeReturningSelection(returning) : undefined,
        };
        let result = await this.#database.execute(statement);
        if (!returning) {
            return {
                affectedRows: result.affectedRows ?? 0,
                insertId: result.insertId,
            };
        }
        return {
            affectedRows: result.affectedRows ?? 0,
            insertId: result.insertId,
            rows: normalizeRows(result.rows),
        };
    }
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
            ? prepareUpdateValues(this.#table, options.update, this.#database.now(), options?.touch ?? true)
            : undefined;
        let returning = options?.returning;
        if (returning && this.#database.adapter.capabilities.returning) {
            let statement = {
                kind: 'upsert',
                table: this.#table,
                values: preparedValues,
                conflictTarget: options?.conflictTarget ? [...options.conflictTarget] : undefined,
                update: updateChanges,
                returning: normalizeReturningSelection(returning),
            };
            let result = await this.#database.execute(statement);
            let row = (normalizeRows(result.rows)[0] ?? null);
            return {
                affectedRows: result.affectedRows ?? 0,
                insertId: result.insertId,
                row,
            };
        }
        let statement = {
            kind: 'upsert',
            table: this.#table,
            values: preparedValues,
            conflictTarget: options?.conflictTarget ? [...options.conflictTarget] : undefined,
            update: updateChanges,
        };
        let result = await this.#database.execute(statement);
        let metadata = {
            affectedRows: result.affectedRows ?? 0,
            insertId: result.insertId,
        };
        if (!returning) {
            return metadata;
        }
        let row = await this.#loadInsertedRow(preparedValues, result.insertId, returning);
        return {
            ...metadata,
            row,
        };
    }
    #toSelectStatement() {
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
    async #loadInsertedRow(values, insertId, returning) {
        let keyObject = getInsertPrimaryKeyObject(this.#table, values, insertId);
        if (!keyObject) {
            throw new DataTableQueryError('Cannot load returning row without adapter RETURNING support unless primary key values are available');
        }
        let rows = await this.#loadRowsByPrimaryKeys([keyObject], returning);
        return rows[0] ?? null;
    }
    async #loadInsertedRows(values, returning) {
        let keyObjects = [];
        for (let row of values) {
            let keyObject = getInsertPrimaryKeyObject(this.#table, row, undefined);
            if (!keyObject) {
                throw new DataTableQueryError('insertMany returning fallback requires explicit primary key values when adapter RETURNING is unavailable');
            }
            keyObjects.push(keyObject);
        }
        return this.#loadRowsByPrimaryKeys(keyObjects, returning);
    }
    async #loadRowsByPrimaryKeys(keyObjects, returning) {
        if (keyObjects.length === 0) {
            return [];
        }
        let query = this.#database.query(this.#table);
        let predicate = buildPrimaryKeyPredicate(this.#table, keyObjects);
        if (predicate) {
            query = query.where(predicate);
        }
        query = applyReturningSelection(query, returning);
        let rows = await query.all();
        return rows;
    }
    async #selectCurrentRows(returning) {
        let query = this.#database.query(this.#table);
        for (let predicate of this.#state.where) {
            query = query.where(predicate);
        }
        for (let clause of this.#state.orderBy) {
            query = query.orderBy(clause.column, clause.direction);
        }
        if (this.#state.limit !== undefined) {
            query = query.limit(this.#state.limit);
        }
        if (this.#state.offset !== undefined) {
            query = query.offset(this.#state.offset);
        }
        query = applyReturningSelection(query, returning);
        let rows = await query.all();
        return rows;
    }
    async #loadCurrentPrimaryKeyRows() {
        let query = this.#database.query(this.#table);
        for (let predicate of this.#state.where) {
            query = query.where(predicate);
        }
        for (let clause of this.#state.orderBy) {
            query = query.orderBy(clause.column, clause.direction);
        }
        if (this.#state.limit !== undefined) {
            query = query.limit(this.#state.limit);
        }
        if (this.#state.offset !== undefined) {
            query = query.offset(this.#state.offset);
        }
        query = query.select(...this.#table.primaryKey);
        let rows = await query.all();
        let primaryKeys = this.#table.primaryKey;
        return rows.map((row) => {
            let keyObject = {};
            for (let key of rowKeys(row, primaryKeys)) {
                keyObject[key] = row[key];
            }
            return keyObject;
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
                sourceTable.name +
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
        return sourceRows.map(() => relation.cardinality === 'many' ? [] : null);
    }
    let query = database.query(relation.targetTable);
    let linkPredicate = buildLinkPredicate(relation.targetKey, sourceTuples);
    if (linkPredicate) {
        query = query.where(linkPredicate);
    }
    query = applyRelationModifiers(query, relation, {
        includePagination: false,
    });
    let relatedRows = (await query.all());
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
    let throughRows = (await throughQuery.all());
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
    let relatedRows = (await targetQuery.all());
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
                let rowIdentity = getCompositeKey(row, relation.targetTable.primaryKey);
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
    query = query.select(...table.primaryKey);
    let rows = await query.all();
    let primaryKeys = table.primaryKey;
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
    let output = validatePartialRow(table, values);
    if (touch && table.timestamps) {
        let createdAt = table.timestamps.createdAt;
        let updatedAt = table.timestamps.updatedAt;
        if (Object.prototype.hasOwnProperty.call(table.columns, createdAt) &&
            output[createdAt] === undefined) {
            output[createdAt] = now;
        }
        if (Object.prototype.hasOwnProperty.call(table.columns, updatedAt) &&
            output[updatedAt] === undefined) {
            output[updatedAt] = now;
        }
    }
    return output;
}
function prepareUpdateValues(table, values, now, touch) {
    let output = validatePartialRow(table, values);
    if (touch && table.timestamps) {
        let updatedAt = table.timestamps.updatedAt;
        if (Object.prototype.hasOwnProperty.call(table.columns, updatedAt) &&
            output[updatedAt] === undefined) {
            output[updatedAt] = now;
        }
    }
    return output;
}
function validatePartialRow(table, values) {
    let output = {};
    for (let key in values) {
        if (!Object.prototype.hasOwnProperty.call(values, key)) {
            continue;
        }
        if (!Object.prototype.hasOwnProperty.call(table.columns, key)) {
            throw new DataTableValidationError('Unknown column "' + key + '" for table "' + table.name + '"', []);
        }
        let schema = table.columns[key];
        let inputValue = values[key];
        let result = parseSafe(schema, inputValue);
        if (!result.success) {
            throw new DataTableValidationError('Invalid value for column "' + key + '" in table "' + table.name + '"', result.issues, {
                metadata: {
                    table: table.name,
                    column: key,
                },
            });
        }
        output[key] = result.value;
    }
    return output;
}
function createPredicateColumnResolver(tables) {
    let qualifiedColumns = new Map();
    let unqualifiedColumns = new Map();
    let ambiguousColumns = new Set();
    for (let table of tables) {
        for (let columnName in table.columns) {
            if (!Object.prototype.hasOwnProperty.call(table.columns, columnName)) {
                continue;
            }
            let resolvedColumn = {
                tableName: table.name,
                columnName,
                schema: table.columns[columnName],
            };
            qualifiedColumns.set(table.name + '.' + columnName, resolvedColumn);
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
        if ((predicate.operator === 'eq' || predicate.operator === 'ne') &&
            (predicate.value === null || predicate.value === undefined)) {
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
            let parsedValues = predicate.value.map((value) => parsePredicateValue(column, value));
            return {
                ...predicate,
                value: parsedValues,
            };
        }
        return {
            ...predicate,
            value: parsePredicateValue(column, predicate.value),
        };
    }
    if (predicate.type === 'between') {
        let column = resolveColumn(predicate.column);
        return {
            ...predicate,
            lower: parsePredicateValue(column, predicate.lower),
            upper: parsePredicateValue(column, predicate.upper),
        };
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
function parsePredicateValue(column, value) {
    let result = parseSafe(column.schema, value);
    if (!result.success) {
        throw new DataTableValidationError('Invalid filter value for column "' + column.columnName + '" in table "' + column.tableName + '"', result.issues, {
            metadata: {
                table: column.tableName,
                column: column.columnName,
            },
        });
    }
    return result.value;
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
function getInsertPrimaryKeyObject(table, values, insertId) {
    let keyObject = {};
    for (let key of table.primaryKey) {
        if (Object.prototype.hasOwnProperty.call(values, key)) {
            keyObject[key] = values[key];
            continue;
        }
        if (table.primaryKey.length === 1 && insertId !== undefined) {
            keyObject[key] = insertId;
            continue;
        }
        return null;
    }
    return keyObject;
}
function buildPrimaryKeyPredicate(table, keyObjects) {
    if (keyObjects.length === 0) {
        return undefined;
    }
    if (table.primaryKey.length === 1) {
        let key = table.primaryKey[0];
        return inList(key, keyObjects.map((objectValue) => objectValue[key]));
    }
    let predicates = keyObjects.map((objectValue) => {
        let comparisons = table.primaryKey.map((key) => {
            let typedKey = key;
            return eq(typedKey, objectValue[typedKey]);
        });
        return and(...comparisons);
    });
    return or(...predicates);
}
function applyReturningSelection(query, returning) {
    if (returning === '*') {
        return query;
    }
    return query.select(...returning);
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
