import type {
  CountOperation,
  DataManipulationResult,
  DeleteOperation,
  ExistsOperation,
  InsertManyOperation,
  InsertOperation,
  SelectColumn,
  SelectOperation,
  UpdateOperation,
  UpsertOperation,
} from '../adapter.ts'
import { DataTableQueryError } from '../errors.ts'
import type {
  QueryTableInput,
  ReturningInput,
  WriteResult,
  WriteRowResult,
  WriteRowsResult,
} from '../database.ts'
import type { WhereInput } from '../operators.ts'
import type {
  DeleteCommand,
  ExecutableQueryInput,
  Query,
  QueryExecutionResult,
  QueryState,
  UpsertCommand,
} from '../query.ts'
import { cloneQueryState, createQueryWithState, getQueryInternals, isQuery } from '../query.ts'
import type { AnyTable } from '../table.ts'
import { getPrimaryKeyObject, getTableName } from '../table.ts'

import { executeOperation, type QueryExecutionContext } from './execution-context.ts'
import {
  buildPrimaryKeyPredicate,
  hasScopedWriteModifiers,
  loadPrimaryKeyRowsForScope,
} from './helpers.ts'
import { loadRelationsForRows } from './relations.ts'
import {
  applyAfterReadHooksToLoadedRows,
  applyAfterReadHooksToRows,
  assertReturningCapability,
  normalizeReturningSelection,
  prepareInsertValues,
  prepareUpdateValues,
  runAfterDeleteHook,
  runAfterWriteHook,
  runBeforeDeleteHook,
} from './write-lifecycle.ts'

export async function executeQueryInput<input extends ExecutableQueryInput>(
  database: QueryExecutionContext,
  input: input,
): Promise<QueryExecutionResult<input>> {
  if (isQuery(input)) {
    let internals = getQueryInternals(input)
    return (await executeAll(
      database,
      internals.table,
      internals.state,
    )) as QueryExecutionResult<input>
  }

  switch (input.kind) {
    case 'first':
      return (await executeFirst(database, input.table, input.state)) as QueryExecutionResult<input>
    case 'find':
      return (await executeFind(
        database,
        input.table,
        input.state,
        input.value,
      )) as QueryExecutionResult<input>
    case 'count':
      return (await executeCount(database, input.table, input.state)) as QueryExecutionResult<input>
    case 'exists':
      return (await executeExists(
        database,
        input.table,
        input.state,
      )) as QueryExecutionResult<input>
    case 'insert':
      return (await executeInsert(
        database,
        input.table,
        input.values,
        input.options,
      )) as QueryExecutionResult<input>
    case 'insertMany':
      return (await executeInsertMany(
        database,
        input.table,
        input.values,
        input.options,
      )) as QueryExecutionResult<input>
    case 'update':
      return (await executeUpdate(
        database,
        input.table,
        input.state,
        input.changes,
        input.options,
      )) as QueryExecutionResult<input>
    case 'delete':
      return (await executeDelete(
        database,
        input.table,
        input.state,
        input.options,
      )) as QueryExecutionResult<input>
    case 'upsert':
      return (await executeUpsert(
        database,
        input.table,
        input.values,
        input.options,
      )) as QueryExecutionResult<input>
    default:
      throw new DataTableQueryError('Unknown executable query input')
  }
}

export async function loadRowsWithRelationsForQuery(
  database: QueryExecutionContext,
  input: Query<any, any, any, any, any, any>,
): Promise<Record<string, unknown>[]> {
  let internals = getQueryInternals(input)
  return loadRowsWithRelationsForState(database, internals.table, internals.state)
}

export async function loadRowsWithRelationsForState(
  database: QueryExecutionContext,
  table: AnyTable,
  state: QueryState,
): Promise<Record<string, unknown>[]> {
  let operation = createSelectOperation(table, state)
  let result = await database[executeOperation](operation)
  let rows = normalizeRows(result.rows)

  if (Object.keys(state.with).length === 0) {
    return rows
  }

  return loadRelationsForRows(database, table, rows, state.with)
}

async function executeAll(
  database: QueryExecutionContext,
  table: AnyTable,
  state: QueryState,
): Promise<Record<string, unknown>[]> {
  let rows = await loadRowsWithRelationsForState(database, table, state)
  return applyAfterReadHooksToLoadedRows(table, rows, state.with)
}

async function executeFirst(
  database: QueryExecutionContext,
  table: AnyTable,
  state: QueryState,
): Promise<Record<string, unknown> | null> {
  let rows = await executeAll(database, table, {
    ...cloneQueryState(state),
    limit: 1,
  })

  return rows[0] ?? null
}

async function executeFind(
  database: QueryExecutionContext,
  table: AnyTable,
  state: QueryState,
  value: unknown,
): Promise<Record<string, unknown> | null> {
  let scopedQuery = createQueryWithState(
    table as QueryTableInput<any, any, any>,
    cloneQueryState(state),
  ).where(getPrimaryKeyObject(table, value as never) as WhereInput<any>)

  let internals = getQueryInternals(scopedQuery)
  return executeFirst(database, internals.table, internals.state)
}

async function executeCount(
  database: QueryExecutionContext,
  table: AnyTable,
  state: QueryState,
): Promise<number> {
  let operation: CountOperation<AnyTable> = {
    kind: 'count',
    table,
    joins: [...state.joins],
    where: [...state.where],
    groupBy: [...state.groupBy],
    having: [...state.having],
  }

  let result = await database[executeOperation](operation)

  if (result.rows && result.rows[0] && typeof result.rows[0].count === 'number') {
    return result.rows[0].count as number
  }

  if (result.rows) {
    return result.rows.length
  }

  return 0
}

async function executeExists(
  database: QueryExecutionContext,
  table: AnyTable,
  state: QueryState,
): Promise<boolean> {
  let operation: ExistsOperation<AnyTable> = {
    kind: 'exists',
    table,
    joins: [...state.joins],
    where: [...state.where],
    groupBy: [...state.groupBy],
    having: [...state.having],
  }

  let result = await database[executeOperation](operation)

  if (result.rows && result.rows[0] && typeof result.rows[0].exists === 'boolean') {
    return result.rows[0].exists as boolean
  }

  if (result.rows && result.rows[0] && typeof result.rows[0].count === 'number') {
    return Number(result.rows[0].count) > 0
  }

  return Boolean(result.rows && result.rows.length > 0)
}

async function executeInsert(
  database: QueryExecutionContext,
  table: AnyTable,
  values: Record<string, unknown>,
  options?: { returning?: ReturningInput<Record<string, unknown>>; touch?: boolean },
): Promise<WriteResult | WriteRowResult<Record<string, unknown>>> {
  let preparedValues = prepareInsertValues(
    table,
    values as never,
    database.now(),
    options?.touch ?? true,
  )
  let returning = options?.returning

  assertReturningCapability(database.adapter, 'insert', returning)

  if (returning) {
    let operation: InsertOperation<AnyTable> = {
      kind: 'insert',
      table,
      values: preparedValues,
      returning: normalizeReturningSelection(returning),
    }

    let result = await database[executeOperation](operation)
    let row = applyAfterReadHooksToRows(table, normalizeRows(result.rows))[0] ?? null
    let affectedRows = result.affectedRows ?? 0
    runAfterWriteHook(table, {
      operation: 'create',
      tableName: getTableName(table),
      values: [preparedValues],
      affectedRows,
      insertId: result.insertId,
    })

    return {
      affectedRows,
      insertId: result.insertId,
      row,
    }
  }

  let operation: InsertOperation<AnyTable> = {
    kind: 'insert',
    table,
    values: preparedValues,
  }

  let result = await database[executeOperation](operation)
  let affectedRows = result.affectedRows ?? 0
  runAfterWriteHook(table, {
    operation: 'create',
    tableName: getTableName(table),
    values: [preparedValues],
    affectedRows,
    insertId: result.insertId,
  })

  return {
    affectedRows,
    insertId: result.insertId,
  }
}

async function executeInsertMany(
  database: QueryExecutionContext,
  table: AnyTable,
  values: Record<string, unknown>[],
  options?: { returning?: ReturningInput<Record<string, unknown>>; touch?: boolean },
): Promise<WriteResult | WriteRowsResult<Record<string, unknown>>> {
  let preparedValues = values.map((value) =>
    prepareInsertValues(table, value as never, database.now(), options?.touch ?? true),
  )

  if (
    preparedValues.length > 0 &&
    preparedValues.every((preparedValue) => Object.keys(preparedValue).length === 0)
  ) {
    throw new DataTableQueryError(
      'insertMany() requires at least one explicit value across the batch',
    )
  }

  let returning = options?.returning
  assertReturningCapability(database.adapter, 'insertMany', returning)

  if (returning) {
    let operation: InsertManyOperation<AnyTable> = {
      kind: 'insertMany',
      table,
      values: preparedValues,
      returning: normalizeReturningSelection(returning),
    }

    let result = await database[executeOperation](operation)
    let affectedRows = result.affectedRows ?? 0
    runAfterWriteHook(table, {
      operation: 'create',
      tableName: getTableName(table),
      values: preparedValues,
      affectedRows,
      insertId: result.insertId,
    })

    return {
      affectedRows,
      insertId: result.insertId,
      rows: applyAfterReadHooksToRows(table, normalizeRows(result.rows)),
    }
  }

  let operation: InsertManyOperation<AnyTable> = {
    kind: 'insertMany',
    table,
    values: preparedValues,
  }

  let result = await database[executeOperation](operation)
  let affectedRows = result.affectedRows ?? 0
  runAfterWriteHook(table, {
    operation: 'create',
    tableName: getTableName(table),
    values: preparedValues,
    affectedRows,
    insertId: result.insertId,
  })

  return {
    affectedRows,
    insertId: result.insertId,
  }
}

async function executeUpdate(
  database: QueryExecutionContext,
  table: AnyTable,
  state: QueryState,
  changes: Record<string, unknown>,
  options?: { returning?: ReturningInput<Record<string, unknown>>; touch?: boolean },
): Promise<WriteResult | WriteRowsResult<Record<string, unknown>>> {
  let returning = options?.returning
  assertReturningCapability(database.adapter, 'update', returning)
  let preparedChanges = prepareUpdateValues(
    table,
    changes as never,
    database.now(),
    options?.touch ?? true,
  )

  if (Object.keys(preparedChanges).length === 0) {
    throw new DataTableQueryError('update() requires at least one change')
  }

  let result: DataManipulationResult

  if (hasScopedWriteModifiers(state)) {
    result = await database.transaction(async (tx) => {
      let primaryKeys = await loadPrimaryKeyRowsForScope(
        tx as unknown as QueryExecutionContext,
        table,
        state,
      )
      let primaryKeyPredicate = buildPrimaryKeyPredicate(table, primaryKeys)

      if (!primaryKeyPredicate) {
        return {
          affectedRows: 0,
          insertId: undefined,
          rows: returning ? [] : undefined,
        }
      }

      let txRuntime = tx as unknown as QueryExecutionContext
      return txRuntime[executeOperation]({
        kind: 'update',
        table,
        changes: preparedChanges,
        where: [primaryKeyPredicate],
        returning: returning ? normalizeReturningSelection(returning) : undefined,
      })
    })
  } else {
    let operation: UpdateOperation<AnyTable> = {
      kind: 'update',
      table,
      changes: preparedChanges,
      where: [...state.where],
      returning: returning ? normalizeReturningSelection(returning) : undefined,
    }

    result = await database[executeOperation](operation)
  }

  let affectedRows = result.affectedRows ?? 0
  runAfterWriteHook(table, {
    operation: 'update',
    tableName: getTableName(table),
    values: [preparedChanges],
    affectedRows,
    insertId: result.insertId,
  })

  if (!returning) {
    return {
      affectedRows,
      insertId: result.insertId,
    }
  }

  return {
    affectedRows,
    insertId: result.insertId,
    rows: applyAfterReadHooksToRows(table, normalizeRows(result.rows)),
  }
}

async function executeDelete(
  database: QueryExecutionContext,
  table: AnyTable,
  state: QueryState,
  options?: DeleteCommand<any, any, any, any, any>['options'],
): Promise<WriteResult | WriteRowsResult<Record<string, unknown>>> {
  let returning = options?.returning
  assertReturningCapability(database.adapter, 'delete', returning)
  let tableName = getTableName(table)
  let deleteContext = {
    tableName,
    where: [...state.where],
    orderBy: [...state.orderBy],
    limit: state.limit,
    offset: state.offset,
  }

  runBeforeDeleteHook(table, deleteContext)
  let result: DataManipulationResult

  if (hasScopedWriteModifiers(state)) {
    result = await database.transaction(async (tx) => {
      let primaryKeys = await loadPrimaryKeyRowsForScope(
        tx as unknown as QueryExecutionContext,
        table,
        state,
      )
      let primaryKeyPredicate = buildPrimaryKeyPredicate(table, primaryKeys)

      if (!primaryKeyPredicate) {
        return {
          affectedRows: 0,
          insertId: undefined,
          rows: returning ? [] : undefined,
        }
      }

      let txRuntime = tx as unknown as QueryExecutionContext
      return txRuntime[executeOperation]({
        kind: 'delete',
        table,
        where: [primaryKeyPredicate],
        returning: returning ? normalizeReturningSelection(returning) : undefined,
      })
    })
  } else {
    let operation: DeleteOperation<AnyTable> = {
      kind: 'delete',
      table,
      where: [...state.where],
      returning: returning ? normalizeReturningSelection(returning) : undefined,
    }

    result = await database[executeOperation](operation)
  }

  let affectedRows = result.affectedRows ?? 0
  runAfterDeleteHook(table, {
    tableName,
    where: deleteContext.where,
    orderBy: deleteContext.orderBy,
    limit: deleteContext.limit,
    offset: deleteContext.offset,
    affectedRows,
  })

  if (!returning) {
    return {
      affectedRows,
      insertId: result.insertId,
    }
  }

  return {
    affectedRows,
    insertId: result.insertId,
    rows: applyAfterReadHooksToRows(table, normalizeRows(result.rows)),
  }
}

async function executeUpsert(
  database: QueryExecutionContext,
  table: AnyTable,
  values: Record<string, unknown>,
  options?: UpsertCommand<any, any, any, any, any>['options'],
): Promise<WriteResult | WriteRowResult<Record<string, unknown>>> {
  if (!database.adapter.capabilities.upsert) {
    throw new DataTableQueryError('Adapter does not support upsert')
  }

  let preparedValues = prepareInsertValues(
    table,
    values as never,
    database.now(),
    options?.touch ?? true,
  )
  let updateChanges = options?.update
    ? prepareUpdateValues(
        table,
        options.update as never,
        database.now(),
        options?.touch ?? true,
        'create',
      )
    : undefined
  let returning = options?.returning
  assertReturningCapability(database.adapter, 'upsert', returning)

  if (returning) {
    let operation: UpsertOperation<AnyTable> = {
      kind: 'upsert',
      table,
      values: preparedValues,
      conflictTarget: options?.conflictTarget ? [...options.conflictTarget] : undefined,
      update: updateChanges,
      returning: normalizeReturningSelection(returning),
    }

    let result = await database[executeOperation](operation)
    let row = applyAfterReadHooksToRows(table, normalizeRows(result.rows))[0] ?? null
    let affectedRows = result.affectedRows ?? 0
    let preparedWriteValues = updateChanges ? [preparedValues, updateChanges] : [preparedValues]
    runAfterWriteHook(table, {
      operation: 'create',
      tableName: getTableName(table),
      values: preparedWriteValues,
      affectedRows,
      insertId: result.insertId,
    })

    return {
      affectedRows,
      insertId: result.insertId,
      row,
    }
  }

  let operation: UpsertOperation<AnyTable> = {
    kind: 'upsert',
    table,
    values: preparedValues,
    conflictTarget: options?.conflictTarget ? [...options.conflictTarget] : undefined,
    update: updateChanges,
  }

  let result = await database[executeOperation](operation)
  let affectedRows = result.affectedRows ?? 0
  let preparedWriteValues = updateChanges ? [preparedValues, updateChanges] : [preparedValues]
  runAfterWriteHook(table, {
    operation: 'create',
    tableName: getTableName(table),
    values: preparedWriteValues,
    affectedRows,
    insertId: result.insertId,
  })

  return {
    affectedRows,
    insertId: result.insertId,
  }
}

function createSelectOperation(table: AnyTable, state: QueryState): SelectOperation<AnyTable> {
  let clonedState = cloneQueryState(state)

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
  }
}

function cloneSelection(selection: '*' | SelectColumn[]): '*' | SelectColumn[] {
  if (selection === '*') {
    return '*'
  }

  return selection.map((column) => ({ ...column }))
}

function normalizeRows(rows: DataManipulationResult['rows']): Record<string, unknown>[] {
  if (!rows) {
    return []
  }

  return rows.map((row) => ({ ...row }))
}
