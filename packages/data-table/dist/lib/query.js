import { DataTableQueryError, DataTableValidationError } from "./errors.js";
import { normalizeWhereInput } from "./operators.js";
import { normalizeColumnInput } from "./references.js";
import { getTableColumns, getTableName } from "./table.js";
export const bindQueryRuntime = Symbol('bindQueryRuntime');
export const querySnapshot = Symbol('querySnapshot');
export class Query {
    #table;
    #state;
    #plan;
    #runtime;
    constructor(table) {
        this.#table = table;
        this.#state = createInitialQueryState();
        this.#plan = { kind: 'all' };
    }
    static #createInternal(table, state, plan, runtime) {
        let output = new Query(table);
        output.#state = cloneQueryState(state);
        output.#plan = cloneQueryPlan(plan);
        output.#runtime = runtime;
        return output;
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
        return this.#clone({
            joins: [...this.#state.joins, { type, table: target, on: normalizedOn }],
        });
    }
    leftJoin(target, on) {
        return this.join(target, on, 'left');
    }
    rightJoin(target, on) {
        return this.join(target, on, 'right');
    }
    orderBy(column, direction = 'asc') {
        return this.#clone({
            orderBy: [...this.#state.orderBy, { column: normalizeColumnInput(column), direction }],
        });
    }
    groupBy(...columns) {
        return this.#clone({
            groupBy: [...this.#state.groupBy, ...columns.map((column) => normalizeColumnInput(column))],
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
    all() {
        return this.#boundRuntime().exec(this);
    }
    first() {
        return this.#resolveTerminal({ kind: 'first' });
    }
    find(value) {
        return this.#resolveTerminal({ kind: 'find', value });
    }
    count() {
        return this.#resolveTerminal({ kind: 'count' });
    }
    exists() {
        return this.#resolveTerminal({ kind: 'exists' });
    }
    insert(values, options) {
        assertWriteState(this.#state, 'insert', {
            where: false,
            orderBy: false,
            limit: false,
            offset: false,
        });
        return this.#resolveTerminal({ kind: 'insert', values, options });
    }
    insertMany(values, options) {
        assertWriteState(this.#state, 'insertMany', {
            where: false,
            orderBy: false,
            limit: false,
            offset: false,
        });
        return this.#resolveTerminal({ kind: 'insertMany', values, options });
    }
    update(changes, options) {
        assertWriteState(this.#state, 'update', {
            where: true,
            orderBy: true,
            limit: true,
            offset: true,
        });
        return this.#resolveTerminal({ kind: 'update', changes, options });
    }
    delete(options) {
        assertWriteState(this.#state, 'delete', {
            where: true,
            orderBy: true,
            limit: true,
            offset: true,
        });
        return this.#resolveTerminal({ kind: 'delete', options });
    }
    upsert(values, options) {
        assertWriteState(this.#state, 'upsert', {
            where: false,
            orderBy: false,
            limit: false,
            offset: false,
        });
        return this.#resolveTerminal({ kind: 'upsert', values, options });
    }
    [querySnapshot]() {
        return this.#snapshot();
    }
    #resolveTerminal(plan) {
        let next = this.#withPlan(plan);
        return (this.#runtime ? this.#runtime.exec(next) : next);
    }
    [bindQueryRuntime](runtime) {
        return Query.#createInternal(this.#table, this.#state, this.#plan, runtime);
    }
    #clone(patch) {
        return Query.#createInternal(this.#table, {
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
        }, this.#plan, this.#runtime);
    }
    #withPlan(plan) {
        return Query.#createInternal(this.#table, this.#state, plan, this.#runtime);
    }
    #snapshot() {
        return {
            table: this.#table,
            state: cloneQueryState(this.#state),
            plan: cloneQueryPlan(this.#plan),
        };
    }
    #boundRuntime() {
        if (!this.#runtime) {
            throw new DataTableQueryError('Use db.exec(query) to execute an unbound Query');
        }
        return this.#runtime;
    }
}
export function query(table) {
    return new Query(table);
}
export function cloneQueryState(state) {
    return {
        select: cloneSelection(state.select),
        distinct: state.distinct,
        joins: [...state.joins],
        where: [...state.where],
        groupBy: [...state.groupBy],
        having: [...state.having],
        orderBy: [...state.orderBy],
        limit: state.limit,
        offset: state.offset,
        with: { ...state.with },
    };
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
function cloneQueryPlan(plan) {
    switch (plan.kind) {
        case 'all':
            return { kind: 'all' };
        case 'first':
            return { kind: 'first' };
        case 'find':
            return {
                kind: 'find',
                value: clonePrimaryKeyValue(plan.value),
            };
        case 'count':
            return { kind: 'count' };
        case 'exists':
            return { kind: 'exists' };
        case 'insert':
            return {
                kind: 'insert',
                values: { ...plan.values },
                options: plan.options ? { ...plan.options } : undefined,
            };
        case 'insertMany':
            return {
                kind: 'insertMany',
                values: plan.values.map((value) => ({ ...value })),
                options: plan.options ? { ...plan.options } : undefined,
            };
        case 'update':
            return {
                kind: 'update',
                changes: { ...plan.changes },
                options: plan.options ? { ...plan.options } : undefined,
            };
        case 'delete':
            return {
                kind: 'delete',
                options: plan.options ? { ...plan.options } : undefined,
            };
        case 'upsert':
            return {
                kind: 'upsert',
                values: { ...plan.values },
                options: plan.options
                    ? {
                        ...plan.options,
                        conflictTarget: plan.options.conflictTarget
                            ? [...plan.options.conflictTarget]
                            : undefined,
                        update: plan.options.update ? { ...plan.options.update } : undefined,
                    }
                    : undefined,
            };
    }
}
function clonePrimaryKeyValue(value) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return value;
    }
    return { ...value };
}
function cloneSelection(selection) {
    if (selection === '*') {
        return '*';
    }
    return selection.map((column) => ({ ...column }));
}
function assertWriteState(state, operation, policy) {
    let unsupported = [];
    if (state.select !== '*')
        unsupported.push('select()');
    if (state.distinct)
        unsupported.push('distinct()');
    if (state.joins.length > 0)
        unsupported.push('join()');
    if (state.groupBy.length > 0)
        unsupported.push('groupBy()');
    if (state.having.length > 0)
        unsupported.push('having()');
    if (Object.keys(state.with).length > 0)
        unsupported.push('with()');
    if (!policy.where && state.where.length > 0)
        unsupported.push('where()');
    if (!policy.orderBy && state.orderBy.length > 0)
        unsupported.push('orderBy()');
    if (!policy.limit && state.limit !== undefined)
        unsupported.push('limit()');
    if (!policy.offset && state.offset !== undefined)
        unsupported.push('offset()');
    if (unsupported.length > 0) {
        throw new DataTableQueryError(operation + '() does not support these query modifiers: ' + unsupported.join(', '));
    }
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
        if (qualified)
            return qualified;
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
