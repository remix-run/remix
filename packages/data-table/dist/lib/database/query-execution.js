import { DataTableQueryError } from "../errors.js";
import { normalizeWhereInput } from "../operators.js";
import { cloneQueryState, querySnapshot } from "../query.js";
import { getPrimaryKeyObject, getTableName } from "../table.js";
import { executeOperation } from "./execution-context.js";
import { buildPrimaryKeyPredicate, hasScopedWriteModifiers, loadPrimaryKeyRowsForScope, } from "./helpers.js";
import { loadRelationsForRows } from "./relations.js";
import { applyAfterReadHooksToLoadedRows, applyAfterReadHooksToRows, assertReturningCapability, normalizeReturningSelection, prepareInsertValues, prepareUpdateValues, runAfterDeleteHook, runAfterWriteHook, runBeforeDeleteHook, } from "./write-lifecycle.js";
export async function executeQuery(database, input) {
    let snapshot = input[querySnapshot]();
    switch (snapshot.plan.kind) {
        case 'all':
            return (await executeAll(database, snapshot.table, snapshot.state));
        case 'first':
            return (await executeFirst(database, snapshot.table, snapshot.state));
        case 'find':
            return (await executeFind(database, snapshot.table, snapshot.state, snapshot.plan.value));
        case 'count':
            return (await executeCount(database, snapshot.table, snapshot.state));
        case 'exists':
            return (await executeExists(database, snapshot.table, snapshot.state));
        case 'insert':
            return (await executeInsert(database, snapshot.table, snapshot.plan.values, snapshot.plan.options));
        case 'insertMany':
            return (await executeInsertMany(database, snapshot.table, snapshot.plan.values, snapshot.plan.options));
        case 'update':
            return (await executeUpdate(database, snapshot.table, snapshot.state, snapshot.plan.changes, snapshot.plan.options));
        case 'delete':
            return (await executeDelete(database, snapshot.table, snapshot.state, snapshot.plan.options));
        case 'upsert':
            return (await executeUpsert(database, snapshot.table, snapshot.plan.values, snapshot.plan.options));
        default:
            throw new DataTableQueryError('Unknown query execution mode');
    }
}
export async function loadRowsWithRelationsForQuery(database, input) {
    let snapshot = input[querySnapshot]();
    return loadRowsWithRelationsForState(database, snapshot.table, snapshot.state);
}
export async function loadRowsWithRelationsForState(database, table, state) {
    let operation = createSelectOperation(table, state);
    let result = await database[executeOperation](operation);
    let rows = normalizeRows(result.rows);
    if (Object.keys(state.with).length === 0) {
        return rows;
    }
    return loadRelationsForRows(database, table, rows, state.with);
}
async function executeAll(database, table, state) {
    let rows = await loadRowsWithRelationsForState(database, table, state);
    return applyAfterReadHooksToLoadedRows(table, rows, state.with);
}
async function executeFirst(database, table, state) {
    let rows = await executeAll(database, table, {
        ...cloneQueryState(state),
        limit: 1,
    });
    return rows[0] ?? null;
}
async function executeFind(database, table, state, value) {
    let scopedState = cloneQueryState(state);
    scopedState.where.push(normalizeWhereInput(getPrimaryKeyObject(table, value)));
    return executeFirst(database, table, scopedState);
}
async function executeCount(database, table, state) {
    let operation = {
        kind: 'count',
        table,
        joins: [...state.joins],
        where: [...state.where],
        groupBy: [...state.groupBy],
        having: [...state.having],
    };
    let result = await database[executeOperation](operation);
    if (result.rows && result.rows[0] && typeof result.rows[0].count === 'number') {
        return result.rows[0].count;
    }
    if (result.rows) {
        return result.rows.length;
    }
    return 0;
}
async function executeExists(database, table, state) {
    let operation = {
        kind: 'exists',
        table,
        joins: [...state.joins],
        where: [...state.where],
        groupBy: [...state.groupBy],
        having: [...state.having],
    };
    let result = await database[executeOperation](operation);
    if (result.rows && result.rows[0] && typeof result.rows[0].exists === 'boolean') {
        return result.rows[0].exists;
    }
    if (result.rows && result.rows[0] && typeof result.rows[0].count === 'number') {
        return Number(result.rows[0].count) > 0;
    }
    return Boolean(result.rows && result.rows.length > 0);
}
async function executeInsert(database, table, values, options) {
    let preparedValues = prepareInsertValues(table, values, database.now(), options?.touch ?? true);
    let returning = options?.returning;
    assertReturningCapability(database.adapter, 'insert', returning);
    if (returning) {
        let operation = {
            kind: 'insert',
            table,
            values: preparedValues,
            returning: normalizeReturningSelection(returning),
        };
        let result = await database[executeOperation](operation);
        let row = applyAfterReadHooksToRows(table, normalizeRows(result.rows))[0] ?? null;
        let affectedRows = result.affectedRows ?? 0;
        runAfterWriteHook(table, {
            operation: 'create',
            tableName: getTableName(table),
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
        table,
        values: preparedValues,
    };
    let result = await database[executeOperation](operation);
    let affectedRows = result.affectedRows ?? 0;
    runAfterWriteHook(table, {
        operation: 'create',
        tableName: getTableName(table),
        values: [preparedValues],
        affectedRows,
        insertId: result.insertId,
    });
    return {
        affectedRows,
        insertId: result.insertId,
    };
}
async function executeInsertMany(database, table, values, options) {
    let preparedValues = values.map((value) => prepareInsertValues(table, value, database.now(), options?.touch ?? true));
    if (preparedValues.length > 0 &&
        preparedValues.every((preparedValue) => Object.keys(preparedValue).length === 0)) {
        throw new DataTableQueryError('insertMany() requires at least one explicit value across the batch');
    }
    let returning = options?.returning;
    assertReturningCapability(database.adapter, 'insertMany', returning);
    if (returning) {
        let operation = {
            kind: 'insertMany',
            table,
            values: preparedValues,
            returning: normalizeReturningSelection(returning),
        };
        let result = await database[executeOperation](operation);
        let affectedRows = result.affectedRows ?? 0;
        runAfterWriteHook(table, {
            operation: 'create',
            tableName: getTableName(table),
            values: preparedValues,
            affectedRows,
            insertId: result.insertId,
        });
        return {
            affectedRows,
            insertId: result.insertId,
            rows: applyAfterReadHooksToRows(table, normalizeRows(result.rows)),
        };
    }
    let operation = {
        kind: 'insertMany',
        table,
        values: preparedValues,
    };
    let result = await database[executeOperation](operation);
    let affectedRows = result.affectedRows ?? 0;
    runAfterWriteHook(table, {
        operation: 'create',
        tableName: getTableName(table),
        values: preparedValues,
        affectedRows,
        insertId: result.insertId,
    });
    return {
        affectedRows,
        insertId: result.insertId,
    };
}
async function executeUpdate(database, table, state, changes, options) {
    let returning = options?.returning;
    assertReturningCapability(database.adapter, 'update', returning);
    let preparedChanges = prepareUpdateValues(table, changes, database.now(), options?.touch ?? true);
    if (Object.keys(preparedChanges).length === 0) {
        throw new DataTableQueryError('update() requires at least one change');
    }
    let result;
    if (hasScopedWriteModifiers(state)) {
        result = await database.transaction(async (tx) => {
            let primaryKeys = await loadPrimaryKeyRowsForScope(tx, table, state);
            let primaryKeyPredicate = buildPrimaryKeyPredicate(table, primaryKeys);
            if (!primaryKeyPredicate) {
                return {
                    affectedRows: 0,
                    insertId: undefined,
                    rows: returning ? [] : undefined,
                };
            }
            return tx[executeOperation]({
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
            table,
            changes: preparedChanges,
            where: [...state.where],
            returning: returning ? normalizeReturningSelection(returning) : undefined,
        };
        result = await database[executeOperation](operation);
    }
    let affectedRows = result.affectedRows ?? 0;
    runAfterWriteHook(table, {
        operation: 'update',
        tableName: getTableName(table),
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
        rows: applyAfterReadHooksToRows(table, normalizeRows(result.rows)),
    };
}
async function executeDelete(database, table, state, options) {
    let returning = options?.returning;
    assertReturningCapability(database.adapter, 'delete', returning);
    let tableName = getTableName(table);
    let deleteContext = {
        tableName,
        where: [...state.where],
        orderBy: [...state.orderBy],
        limit: state.limit,
        offset: state.offset,
    };
    runBeforeDeleteHook(table, deleteContext);
    let result;
    if (hasScopedWriteModifiers(state)) {
        result = await database.transaction(async (tx) => {
            let primaryKeys = await loadPrimaryKeyRowsForScope(tx, table, state);
            let primaryKeyPredicate = buildPrimaryKeyPredicate(table, primaryKeys);
            if (!primaryKeyPredicate) {
                return {
                    affectedRows: 0,
                    insertId: undefined,
                    rows: returning ? [] : undefined,
                };
            }
            return tx[executeOperation]({
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
            table,
            where: [...state.where],
            returning: returning ? normalizeReturningSelection(returning) : undefined,
        };
        result = await database[executeOperation](operation);
    }
    let affectedRows = result.affectedRows ?? 0;
    runAfterDeleteHook(table, {
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
        rows: applyAfterReadHooksToRows(table, normalizeRows(result.rows)),
    };
}
async function executeUpsert(database, table, values, options) {
    if (!database.adapter.capabilities.upsert) {
        throw new DataTableQueryError('Adapter does not support upsert');
    }
    let preparedValues = prepareInsertValues(table, values, database.now(), options?.touch ?? true);
    let updateChanges = options?.update
        ? prepareUpdateValues(table, options.update, database.now(), options?.touch ?? true, 'create')
        : undefined;
    let returning = options?.returning;
    assertReturningCapability(database.adapter, 'upsert', returning);
    if (returning) {
        let operation = {
            kind: 'upsert',
            table,
            values: preparedValues,
            conflictTarget: options?.conflictTarget ? [...options.conflictTarget] : undefined,
            update: updateChanges,
            returning: normalizeReturningSelection(returning),
        };
        let result = await database[executeOperation](operation);
        let row = applyAfterReadHooksToRows(table, normalizeRows(result.rows))[0] ?? null;
        let affectedRows = result.affectedRows ?? 0;
        let preparedWriteValues = updateChanges ? [preparedValues, updateChanges] : [preparedValues];
        runAfterWriteHook(table, {
            operation: 'create',
            tableName: getTableName(table),
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
        table,
        values: preparedValues,
        conflictTarget: options?.conflictTarget ? [...options.conflictTarget] : undefined,
        update: updateChanges,
    };
    let result = await database[executeOperation](operation);
    let affectedRows = result.affectedRows ?? 0;
    let preparedWriteValues = updateChanges ? [preparedValues, updateChanges] : [preparedValues];
    runAfterWriteHook(table, {
        operation: 'create',
        tableName: getTableName(table),
        values: preparedWriteValues,
        affectedRows,
        insertId: result.insertId,
    });
    return {
        affectedRows,
        insertId: result.insertId,
    };
}
function createSelectOperation(table, state) {
    let clonedState = cloneQueryState(state);
    return {
        kind: 'select',
        table,
        select: cloneSelection(clonedState.select),
        distinct: clonedState.distinct,
        joins: clonedState.joins,
        where: clonedState.where,
        groupBy: clonedState.groupBy,
        having: clonedState.having,
        orderBy: clonedState.orderBy,
        limit: clonedState.limit,
        offset: clonedState.offset,
    };
}
function cloneSelection(selection) {
    if (selection === '*') {
        return '*';
    }
    return selection.map((column) => ({ ...column }));
}
function normalizeRows(rows) {
    if (!rows) {
        return [];
    }
    return rows.map((row) => ({ ...row }));
}
