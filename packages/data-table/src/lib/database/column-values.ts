import type {
  ColumnDefinition,
  DataManipulationOperation,
  DataManipulationResult,
  DatabaseDriver,
} from '../driver.ts'
import type { Predicate } from '../operators.ts'
import type { AnyTable } from '../table.ts'
import { getTableColumnDefinitions, getTableName } from '../table.ts'

type ColumnResolver = (column: string) => ColumnDefinition | undefined

/**
 * Converts values bound to typed columns into the form every driver stores: JSON columns
 * receive JSON text. Covers written values and values compared in `where`, `having`, and
 * join predicates.
 * @param operation Operation about to be sent to the driver.
 * @returns The operation with encoded values.
 */
export function encodeOperationValues(
  operation: DataManipulationOperation,
): DataManipulationOperation {
  if (operation.kind === 'raw') {
    return operation
  }

  let resolve = createColumnResolver(operation)

  function encodePredicates(predicates: Predicate[], resolveColumn = resolve): Predicate[] {
    return predicates.map((predicate) => encodePredicate(predicate, resolveColumn))
  }

  switch (operation.kind) {
    case 'insert':
      return { ...operation, values: encodeRow(operation.values, resolve) }
    case 'insertMany':
      return { ...operation, values: operation.values.map((values) => encodeRow(values, resolve)) }
    case 'update':
      return {
        ...operation,
        changes: encodeRow(operation.changes, resolve),
        where: encodePredicates(operation.where),
      }
    case 'upsert':
      return {
        ...operation,
        values: encodeRow(operation.values, resolve),
        update: operation.update && encodeRow(operation.update, resolve),
      }
    case 'delete':
      return { ...operation, where: encodePredicates(operation.where) }
    default:
      return {
        ...operation,
        joins: operation.joins.map((join) => ({ ...join, on: encodePredicate(join.on, resolve) })),
        where: encodePredicates(operation.where),
        // `having` can name select aliases, which may shadow a column of another type.
        having: encodePredicates(operation.having, resolveSelectAliases(operation, resolve)),
      }
  }
}

/**
 * Converts values in rows read from typed table columns with the driver's `decodeValue()` hook.
 * Raw statements, counts, and existence checks are returned unchanged.
 * @param driver Driver that produced the rows.
 * @param operation Operation that produced the rows.
 * @param result Driver result.
 * @returns The result with decoded rows.
 */
export function decodeResultRows(
  driver: DatabaseDriver,
  operation: DataManipulationOperation,
  result: DataManipulationResult,
): DataManipulationResult {
  let decodeValue = driver.decodeValue

  if (
    !decodeValue ||
    !result.rows ||
    operation.kind === 'raw' ||
    operation.kind === 'count' ||
    operation.kind === 'exists'
  ) {
    return result
  }

  let resolve = resolveSelectAliases(operation, createColumnResolver(operation))
  // Rows share their keys, so resolve each key's column once per result.
  let columns = new Map<string, ColumnDefinition | undefined>()

  let rows = result.rows.map((row) => {
    let output = row

    for (let key in row) {
      let value = row[key]

      if (value === null || value === undefined) continue
      if (!columns.has(key)) columns.set(key, resolve(key))

      let column = columns.get(key)

      if (!column) continue

      let decoded = decodeValue.call(driver, value, column)

      if (decoded !== value) {
        if (output === row) output = { ...row }
        output[key] = decoded
      }
    }

    return output
  })

  return { ...result, rows }
}

function createColumnResolver(
  operation: Exclude<DataManipulationOperation, { kind: 'raw' }>,
): ColumnResolver {
  let tables: AnyTable[] = [operation.table]

  if ('joins' in operation) {
    for (let join of operation.joins) tables.push(join.table)
  }

  return (column) => {
    let dot = column.lastIndexOf('.')

    if (dot !== -1) {
      let tableName = column.slice(0, dot)
      let table = tables.find((candidate) => getTableName(candidate) === tableName)
      return table ? getColumnDefinition(table, column.slice(dot + 1)) : undefined
    }

    let match: ColumnDefinition | undefined

    for (let table of tables) {
      let definition = getColumnDefinition(table, column)
      if (!definition) continue
      // `select *` over a join returns one value per name from whichever table the database
      // picks, so leave names whose joined tables disagree on the column type unconverted.
      if (match && match.type !== definition.type) return undefined
      match ??= definition
    }

    return match
  }
}

function resolveSelectAliases(
  operation: Exclude<DataManipulationOperation, { kind: 'raw' }>,
  resolve: ColumnResolver,
): ColumnResolver {
  if (operation.kind !== 'select' || operation.select === '*') {
    return resolve
  }

  let aliases = new Map(operation.select.map((field) => [field.alias, field.column]))
  return (name) => resolve(aliases.get(name) ?? name)
}

function getColumnDefinition(table: AnyTable, column: string): ColumnDefinition | undefined {
  let definitions: Record<string, ColumnDefinition> = getTableColumnDefinitions(table)
  return Object.prototype.hasOwnProperty.call(definitions, column) ? definitions[column] : undefined
}

function encodeRow(
  values: Record<string, unknown>,
  resolve: ColumnResolver,
): Record<string, unknown> {
  let output = values

  for (let column in values) {
    let value = values[column]
    let encoded = encodeValue(resolve(column), value)

    if (encoded !== value) {
      if (output === values) output = { ...values }
      output[column] = encoded
    }
  }

  return output
}

function encodePredicate(predicate: Predicate, resolve: ColumnResolver): Predicate {
  switch (predicate.type) {
    case 'logical':
      return {
        ...predicate,
        predicates: predicate.predicates.map((child) => encodePredicate(child, resolve)),
      }
    case 'between': {
      let column = resolve(predicate.column)
      if (column?.type !== 'json') return predicate
      return {
        ...predicate,
        lower: encodeValue(column, predicate.lower),
        upper: encodeValue(column, predicate.upper),
      }
    }
    case 'comparison': {
      // Pattern operands are matched against stored text rather than bound as column values.
      if (
        predicate.valueType !== 'value' ||
        predicate.operator === 'like' ||
        predicate.operator === 'ilike'
      ) {
        return predicate
      }

      let column = resolve(predicate.column)

      if (column?.type !== 'json') return predicate

      if (
        (predicate.operator === 'in' || predicate.operator === 'notIn') &&
        Array.isArray(predicate.value)
      ) {
        return { ...predicate, value: predicate.value.map((value) => encodeValue(column, value)) }
      }

      return { ...predicate, value: encodeValue(column, predicate.value) }
    }
    default:
      return predicate
  }
}

// Like Drizzle, JSON columns store every non-null value as JSON text, including strings, so
// values round-trip through `JSON.parse()` on every adapter.
function encodeValue(column: ColumnDefinition | undefined, value: unknown): unknown {
  if (column?.type !== 'json' || value === null || value === undefined) {
    return value
  }

  return JSON.stringify(value)
}
