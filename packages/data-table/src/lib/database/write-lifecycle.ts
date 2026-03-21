import type { DatabaseAdapter, ReturningSelection } from '../adapter.ts'
import { DataTableQueryError, DataTableValidationError } from '../errors.ts'
import type { ReturningInput } from '../database.ts'
import type { AnyRelation } from '../table-relations.ts'
import type {
  AnyTable,
  TableAfterDeleteContext,
  TableAfterWriteContext,
  TableBeforeDeleteContext,
  TableLifecycleOperation,
  TableRow,
  TableWriteOperation,
  ValidationIssue,
} from '../table.ts'
import {
  getTableAfterDelete,
  getTableAfterRead,
  getTableAfterWrite,
  getTableBeforeDelete,
  getTableBeforeWrite,
  getTableColumns,
  getTableName,
  getTableTimestamps,
  getTableValidator,
} from '../table.ts'

type LifecycleCallbackSource =
  | 'beforeWrite'
  | 'validate'
  | 'afterWrite'
  | 'beforeDelete'
  | 'afterDelete'
  | 'afterRead'

export function prepareInsertValues<table extends AnyTable>(
  table: table,
  values: Partial<TableRow<table>>,
  now: unknown,
  touch: boolean,
): Record<string, unknown> {
  let output = validateWriteValues(table, values, 'create')
  let timestamps = getTableTimestamps(table)
  let columns = getTableColumns(table)

  if (touch && timestamps) {
    touchTimestampColumn(output, columns, timestamps.createdAt, now)
    touchTimestampColumn(output, columns, timestamps.updatedAt, now)
  }

  return output
}

export function prepareUpdateValues<table extends AnyTable>(
  table: table,
  values: Partial<TableRow<table>>,
  now: unknown,
  touch: boolean,
  operation: TableWriteOperation = 'update',
): Record<string, unknown> {
  let output = validateWriteValues(table, values, operation)
  let timestamps = getTableTimestamps(table)
  let columns = getTableColumns(table)

  if (touch && timestamps) {
    touchTimestampColumn(output, columns, timestamps.updatedAt, now)
  }

  return output
}

export function applyAfterReadHooksToRows<table extends AnyTable>(
  table: table,
  rows: Record<string, unknown>[],
): Record<string, unknown>[] {
  let callback = getTableAfterRead(table)

  if (!callback || rows.length === 0) {
    return rows
  }

  let tableName = getTableName(table)

  return rows.map((row) => {
    let callbackResult = callback({
      tableName,
      value: row as Partial<TableRow<table>>,
    })
    assertSynchronousCallbackResult(tableName, 'read', 'afterRead', callbackResult)

    if (hasIssues(callbackResult)) {
      throwValidationIssues(tableName, callbackResult.issues, 'read', 'afterRead')
    }

    if (!hasValue(callbackResult)) {
      throw new DataTableValidationError(
        'Invalid afterRead callback result for table "' + tableName + '"',
        [{ message: 'Expected afterRead to return { value } or { issues }' }],
        {
          metadata: {
            table: tableName,
            operation: 'read',
            source: 'afterRead',
          },
        },
      )
    }

    return normalizeReadObject(tableName, callbackResult.value)
  })
}

export function applyAfterReadHooksToLoadedRows(
  table: AnyTable,
  rows: Record<string, unknown>[],
  relationMap: Record<string, AnyRelation>,
): Record<string, unknown>[] {
  if (rows.length === 0) {
    return rows
  }

  let relationNames = Object.keys(relationMap)

  if (relationNames.length > 0) {
    for (let row of rows) {
      for (let relationName of relationNames) {
        let relation = relationMap[relationName]
        let relationValue = row[relationName]

        if (relation.cardinality === 'many') {
          if (!isRowArray(relationValue)) {
            continue
          }

          row[relationName] = applyAfterReadHooksToLoadedRows(
            relation.targetTable,
            relationValue,
            relation.modifiers.with,
          )
          continue
        }

        if (!isRowRecord(relationValue)) {
          continue
        }

        let transformed = applyAfterReadHooksToLoadedRows(
          relation.targetTable,
          [relationValue],
          relation.modifiers.with,
        )
        row[relationName] = transformed[0] ?? null
      }
    }
  }

  return applyAfterReadHooksToRows(table, rows)
}

export function runBeforeDeleteHook<table extends AnyTable>(
  table: table,
  context: TableBeforeDeleteContext,
): void {
  let callback = getTableBeforeDelete(table)

  if (!callback) {
    return
  }

  let callbackResult = callback(context)
  assertSynchronousCallbackResult(context.tableName, 'delete', 'beforeDelete', callbackResult)

  if (callbackResult === undefined) {
    return
  }

  if (hasIssues(callbackResult)) {
    throwValidationIssues(context.tableName, callbackResult.issues, 'delete', 'beforeDelete')
  }

  throw new DataTableValidationError(
    'Invalid beforeDelete callback result for table "' + context.tableName + '"',
    [{ message: 'Expected beforeDelete to return nothing or { issues }' }],
    {
      metadata: {
        table: context.tableName,
        operation: 'delete',
        source: 'beforeDelete',
      },
    },
  )
}

export function runAfterWriteHook<table extends AnyTable>(
  table: table,
  context: TableAfterWriteContext<TableRow<table>>,
): void {
  let callback = getTableAfterWrite(table)

  if (!callback) {
    return
  }

  let callbackResult = callback(context)
  assertSynchronousCallbackResult(
    context.tableName,
    context.operation,
    'afterWrite',
    callbackResult,
  )
}

export function runAfterDeleteHook<table extends AnyTable>(
  table: table,
  context: TableAfterDeleteContext,
): void {
  let callback = getTableAfterDelete(table)

  if (!callback) {
    return
  }

  let callbackResult = callback(context)
  assertSynchronousCallbackResult(context.tableName, 'delete', 'afterDelete', callbackResult)
}

export function assertReturningCapability<row extends Record<string, unknown>>(
  adapter: DatabaseAdapter,
  operation: 'insert' | 'insertMany' | 'update' | 'delete' | 'upsert',
  returning: ReturningInput<row> | undefined,
): void {
  if (returning && !adapter.capabilities.returning) {
    throw new DataTableQueryError(operation + '() returning is not supported by this adapter')
  }
}

function touchTimestampColumn(
  output: Record<string, unknown>,
  columns: Record<string, unknown>,
  column: string,
  value: unknown,
): void {
  if (Object.prototype.hasOwnProperty.call(columns, column) && output[column] === undefined) {
    output[column] = value
  }
}

function isRowArray(value: unknown): value is Record<string, unknown>[] {
  return Array.isArray(value) && value.every(isRowRecord)
}

function isRowRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function normalizeReturningSelection<row extends Record<string, unknown>>(
  returning: ReturningInput<row>,
): ReturningSelection {
  if (returning === '*') {
    return '*'
  }

  return [...returning]
}

function validateWriteValues<table extends AnyTable>(
  table: table,
  values: Partial<TableRow<table>>,
  operation: TableWriteOperation,
): Record<string, unknown> {
  let tableName = getTableName(table)
  let normalizedInput = normalizeWriteObject(table, values, operation)
  let beforeWrite = getTableBeforeWrite(table)

  if (beforeWrite) {
    let beforeWriteResult = beforeWrite({
      operation,
      tableName,
      value: normalizedInput as Partial<TableRow<table>>,
    })
    assertSynchronousCallbackResult(tableName, operation, 'beforeWrite', beforeWriteResult)

    if (hasIssues(beforeWriteResult)) {
      throwValidationIssues(tableName, beforeWriteResult.issues, operation, 'beforeWrite')
    }

    if (!hasValue(beforeWriteResult)) {
      throw new DataTableValidationError(
        'Invalid beforeWrite callback result for table "' + tableName + '"',
        [{ message: 'Expected beforeWrite to return { value } or { issues }' }],
        {
          metadata: {
            table: tableName,
            operation,
            source: 'beforeWrite',
          },
        },
      )
    }

    normalizedInput = normalizeWriteObject(table, beforeWriteResult.value, operation, 'beforeWrite')
  }

  let validator = getTableValidator(table)

  if (!validator) {
    return normalizedInput
  }

  let validationResult = validator({
    operation,
    tableName,
    value: normalizedInput as Partial<TableRow<table>>,
  })
  assertSynchronousCallbackResult(tableName, operation, 'validate', validationResult)

  if (hasIssues(validationResult)) {
    throwValidationIssues(tableName, validationResult.issues, operation, 'validate')
  }

  if (!hasValue(validationResult)) {
    throw new DataTableValidationError(
      'Invalid validator result for table "' + tableName + '"',
      [{ message: 'Expected validator to return { value } or { issues }' }],
      {
        metadata: {
          table: tableName,
          operation,
          source: 'validate',
        },
      },
    )
  }

  return normalizeWriteObject(table, validationResult.value, operation, 'validate')
}

function hasIssues(value: unknown): value is { issues: ReadonlyArray<ValidationIssue> } {
  return typeof value === 'object' && value !== null && 'issues' in value
}

function hasValue(value: unknown): value is { value: unknown } {
  return typeof value === 'object' && value !== null && 'value' in value
}

function normalizeWriteObject<table extends AnyTable>(
  table: table,
  value: unknown,
  operation: TableWriteOperation,
  source?: LifecycleCallbackSource,
): Record<string, unknown> {
  let tableName = getTableName(table)
  let columns = getTableColumns(table)

  if (!isRowRecord(value)) {
    throw new DataTableValidationError(
      'Invalid value for table "' + tableName + '"',
      [{ message: 'Expected object' }],
      {
        metadata: {
          table: tableName,
          operation,
          ...(source ? { source } : {}),
        },
      },
    )
  }

  let output: Record<string, unknown> = {}

  for (let key in value) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) {
      continue
    }

    if (!Object.prototype.hasOwnProperty.call(columns, key)) {
      throw new DataTableValidationError(
        'Unknown column "' + key + '" for table "' + tableName + '"',
        [],
        {
          metadata: {
            table: tableName,
            column: key,
            operation,
            ...(source ? { source } : {}),
          },
        },
      )
    }

    output[key] = value[key]
  }

  return output
}

function throwValidationIssues(
  tableName: string,
  issues: ReadonlyArray<ValidationIssue>,
  operation: TableLifecycleOperation,
  source?: LifecycleCallbackSource,
): never {
  let firstIssue = issues[0]
  let issuePath = firstIssue?.path
  let firstPathSegment = issuePath && issuePath.length > 0 ? issuePath[0] : undefined
  let column = typeof firstPathSegment === 'string' ? firstPathSegment : undefined

  if (column) {
    throw new DataTableValidationError(
      'Invalid value for column "' + column + '" in table "' + tableName + '"',
      issues,
      {
        metadata: {
          table: tableName,
          column,
          operation,
          ...(source ? { source } : {}),
        },
      },
    )
  }

  throw new DataTableValidationError('Invalid value for table "' + tableName + '"', issues, {
    metadata: {
      table: tableName,
      operation,
      ...(source ? { source } : {}),
    },
  })
}

function assertSynchronousCallbackResult(
  tableName: string,
  operation: TableLifecycleOperation,
  callbackName: LifecycleCallbackSource,
  value: unknown,
): void {
  if (!isPromiseLike(value)) {
    return
  }

  throw new DataTableValidationError(
    'Invalid ' + callbackName + ' callback result for table "' + tableName + '"',
    [{ message: callbackName + ' callbacks must be synchronous and cannot return a Promise' }],
    {
      metadata: {
        table: tableName,
        operation,
        source: callbackName,
      },
    },
  )
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  if ((typeof value !== 'object' && typeof value !== 'function') || value === null) {
    return false
  }

  return typeof Reflect.get(value, 'then') === 'function'
}

function normalizeReadObject(tableName: string, value: unknown): Record<string, unknown> {
  if (!isRowRecord(value)) {
    throw new DataTableValidationError(
      'Invalid afterRead callback result for table "' + tableName + '"',
      [{ message: 'Expected afterRead to return an object value' }],
      {
        metadata: {
          table: tableName,
          operation: 'read',
          source: 'afterRead',
        },
      },
    )
  }

  return { ...value }
}
