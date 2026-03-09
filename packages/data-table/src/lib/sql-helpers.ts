import type { DataManipulationOperation, DataMigrationOperation, TableRef } from './adapter.ts'

/**
 * Function used to quote SQL identifiers for a dialect.
 */
export type QuoteIdentifier = (value: string) => string

/**
 * Type guard that narrows an operation to the data-manipulation union.
 * @param operation Operation to inspect.
 * @returns `true` when the operation is a data-manipulation operation.
 */
export function isDataManipulationOperation(
  operation: DataManipulationOperation | DataMigrationOperation,
): operation is DataManipulationOperation {
  return (
    operation.kind === 'select' ||
    operation.kind === 'count' ||
    operation.kind === 'exists' ||
    operation.kind === 'insert' ||
    operation.kind === 'insertMany' ||
    operation.kind === 'update' ||
    operation.kind === 'delete' ||
    operation.kind === 'upsert' ||
    operation.kind === 'raw'
  )
}

/**
 * Normalizes an arbitrary join type string into `inner`, `left`, or `right`.
 * @param type Input join type.
 * @returns Normalized join type.
 */
export function normalizeJoinType(type: string): string {
  if (type === 'left') {
    return 'left'
  }

  if (type === 'right') {
    return 'right'
  }

  return 'inner'
}

/**
 * Returns stable column order from the union of keys in the provided rows.
 * @param rows Row objects to scan for keys.
 * @returns Deduplicated key list in encounter order.
 */
export function collectColumns(rows: Record<string, unknown>[]): string[] {
  let columns: string[] = []
  let seen = new Set<string>()

  for (let row of rows) {
    for (let key in row) {
      if (!Object.prototype.hasOwnProperty.call(row, key)) {
        continue
      }

      if (seen.has(key)) {
        continue
      }

      seen.add(key)
      columns.push(key)
    }
  }

  return columns
}

/**
 * Quotes each segment of a dotted identifier path.
 *
 * Wildcard segments (`*`) are preserved.
 * @param path Dotted path to quote.
 * @param quoteIdentifier Dialect-specific identifier quote function.
 * @returns Quoted path string.
 */
export function quotePath(path: string, quoteIdentifier: QuoteIdentifier): string {
  if (path === '*') {
    return '*'
  }

  return path
    .split('.')
    .map((segment) => {
      if (segment === '*') {
        return '*'
      }

      return quoteIdentifier(segment)
    })
    .join('.')
}

/**
 * Quotes a `{ schema?, name }` table reference using a dialect quote function.
 * @param table Table reference to quote.
 * @param quoteIdentifier Dialect-specific identifier quote function.
 * @returns Quoted table reference.
 */
export function quoteTableRef(table: TableRef, quoteIdentifier: QuoteIdentifier): string {
  if (table.schema) {
    return quoteIdentifier(table.schema) + '.' + quoteIdentifier(table.name)
  }

  return quoteIdentifier(table.name)
}

/**
 * Converts a JavaScript value into a SQL literal string.
 * @param value Value to serialize.
 * @param options Serialization options.
 * @param options.booleansAsIntegers When `true`, booleans render as `1`/`0`.
 * @returns SQL literal text.
 */
export function quoteLiteral(
  value: unknown,
  options?: {
    booleansAsIntegers?: boolean
  },
): string {
  if (value === null) {
    return 'null'
  }

  if (typeof value === 'number' || typeof value === 'bigint') {
    return String(value)
  }

  if (typeof value === 'boolean') {
    if (options?.booleansAsIntegers) {
      return value ? '1' : '0'
    }

    return value ? 'true' : 'false'
  }

  if (value instanceof Date) {
    return quoteLiteral(value.toISOString(), options)
  }

  return "'" + String(value).replace(/'/g, "''") + "'"
}
