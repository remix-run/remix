import type { JoinClause, ReturningSelection, TableRef } from './driver.ts'
import type { Predicate } from './operators.ts'
import { getTableName } from './table.ts'
import type { AnyTable, OrderByClause } from './table.ts'

/**
 * Function used to quote SQL identifiers for a dialect.
 */
export type QuoteIdentifier = (value: string) => string

/**
 * Dialect hooks and bound-value state used by the shared SQL clause compilers.
 *
 * Create one context per compiled statement so `bindValue()` collects that statement's values.
 */
export interface SqlCompileContext {
  /**
   * Quotes a single identifier segment.
   */
  quoteIdentifier: QuoteIdentifier
  /**
   * Records a bound value and returns its placeholder text, such as `?` or `$1`.
   */
  bindValue(value: unknown): string
  /**
   * How `ilike` predicates compile. `'ilike'` uses the native operator; `'lower-like'` compiles
   * `lower(column) like lower(value)`. Defaults to `'lower-like'`.
   */
  ilike?: 'ilike' | 'lower-like'
}

/**
 * Compiles a case-insensitive `orderBy` direction for use in a SQL statement.
 * @param direction Runtime value to validate.
 * @returns The uppercase SQL direction keyword.
 */
export function compileOrderByDirection(direction: unknown): 'ASC' | 'DESC' {
  let normalizedDirection = typeof direction === 'string' ? direction.toLowerCase() : direction

  if (normalizedDirection === 'asc') {
    return 'ASC'
  }

  if (normalizedDirection === 'desc') {
    return 'DESC'
  }

  throw new TypeError('Invalid order by direction: expected "asc" or "desc"')
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

/**
 * Compiles a predicate tree into SQL, binding comparison values through the context.
 * @param predicate Predicate to compile.
 * @param context Dialect hooks and bound-value state.
 * @returns SQL predicate text.
 */
export function compilePredicate(predicate: Predicate, context: SqlCompileContext): string {
  if (predicate.type === 'comparison') {
    let column = quotePath(predicate.column, context.quoteIdentifier)
    let isNullValue =
      predicate.valueType === 'value' && (predicate.value === null || predicate.value === undefined)

    if (predicate.operator === 'eq') {
      return isNullValue
        ? column + ' is null'
        : column + ' = ' + compileComparisonValue(predicate, context)
    }

    if (predicate.operator === 'ne') {
      return isNullValue
        ? column + ' is not null'
        : column + ' <> ' + compileComparisonValue(predicate, context)
    }

    if (predicate.operator === 'gt') {
      return column + ' > ' + compileComparisonValue(predicate, context)
    }

    if (predicate.operator === 'gte') {
      return column + ' >= ' + compileComparisonValue(predicate, context)
    }

    if (predicate.operator === 'lt') {
      return column + ' < ' + compileComparisonValue(predicate, context)
    }

    if (predicate.operator === 'lte') {
      return column + ' <= ' + compileComparisonValue(predicate, context)
    }

    if (predicate.operator === 'in' || predicate.operator === 'notIn') {
      let values = Array.isArray(predicate.value) ? predicate.value : []

      if (values.length === 0) {
        return predicate.operator === 'in' ? '1 = 0' : '1 = 1'
      }

      let keyword = predicate.operator === 'in' ? 'in' : 'not in'
      let placeholders = values.map((value) => context.bindValue(value))

      return column + ' ' + keyword + ' (' + placeholders.join(', ') + ')'
    }

    if (predicate.operator === 'like') {
      return column + ' like ' + compileComparisonValue(predicate, context)
    }

    if (predicate.operator === 'ilike') {
      let comparisonValue = compileComparisonValue(predicate, context)

      if (context.ilike === 'ilike') {
        return column + ' ilike ' + comparisonValue
      }

      return 'lower(' + column + ') like lower(' + comparisonValue + ')'
    }
  }

  if (predicate.type === 'between') {
    return (
      quotePath(predicate.column, context.quoteIdentifier) +
      ' between ' +
      context.bindValue(predicate.lower) +
      ' and ' +
      context.bindValue(predicate.upper)
    )
  }

  if (predicate.type === 'null') {
    return (
      quotePath(predicate.column, context.quoteIdentifier) +
      (predicate.operator === 'isNull' ? ' is null' : ' is not null')
    )
  }

  if (predicate.type === 'logical') {
    if (predicate.predicates.length === 0) {
      return predicate.operator === 'and' ? '1 = 1' : '1 = 0'
    }

    return predicate.predicates
      .map((child) => '(' + compilePredicate(child, context) + ')')
      .join(predicate.operator === 'and' ? ' and ' : ' or ')
  }

  throw new Error('Unsupported predicate')
}

function compileComparisonValue(
  predicate: Extract<Predicate, { type: 'comparison' }>,
  context: SqlCompileContext,
): string {
  if (predicate.valueType === 'column') {
    return quotePath(predicate.value, context.quoteIdentifier)
  }

  return context.bindValue(predicate.value)
}

/**
 * Compiles a ` from ...` clause, including any joins.
 * @param table Table to select from.
 * @param joins Join clauses to append.
 * @param context Dialect hooks and bound-value state.
 * @returns SQL text with a leading space.
 */
export function compileFromClause(
  table: AnyTable,
  joins: JoinClause[],
  context: SqlCompileContext,
): string {
  let output = ' from ' + quotePath(getTableName(table), context.quoteIdentifier)

  for (let join of joins) {
    output +=
      ' ' +
      normalizeJoinType(join.type) +
      ' join ' +
      quotePath(getTableName(join.table), context.quoteIdentifier) +
      ' on ' +
      compilePredicate(join.on, context)
  }

  return output
}

/**
 * Compiles a ` where ...` clause that requires every predicate to match.
 * @param predicates Predicates to combine with `and`.
 * @param context Dialect hooks and bound-value state.
 * @returns SQL text with a leading space, or `''` when there are no predicates.
 */
export function compileWhereClause(predicates: Predicate[], context: SqlCompileContext): string {
  if (predicates.length === 0) {
    return ''
  }

  return ' where ' + compilePredicateList(predicates, context)
}

/**
 * Compiles a ` having ...` clause that requires every predicate to match.
 * @param predicates Predicates to combine with `and`.
 * @param context Dialect hooks and bound-value state.
 * @returns SQL text with a leading space, or `''` when there are no predicates.
 */
export function compileHavingClause(predicates: Predicate[], context: SqlCompileContext): string {
  if (predicates.length === 0) {
    return ''
  }

  return ' having ' + compilePredicateList(predicates, context)
}

function compilePredicateList(predicates: Predicate[], context: SqlCompileContext): string {
  return predicates
    .map((predicate) => '(' + compilePredicate(predicate, context) + ')')
    .join(' and ')
}

/**
 * Compiles a ` group by ...` clause.
 * @param columns Column paths to group by.
 * @param context Dialect hooks and bound-value state.
 * @returns SQL text with a leading space, or `''` when there are no columns.
 */
export function compileGroupByClause(columns: string[], context: SqlCompileContext): string {
  if (columns.length === 0) {
    return ''
  }

  return (
    ' group by ' + columns.map((column) => quotePath(column, context.quoteIdentifier)).join(', ')
  )
}

/**
 * Compiles an ` order by ...` clause, validating each direction at runtime.
 * @param orderBy Order by clauses.
 * @param context Dialect hooks and bound-value state.
 * @returns SQL text with a leading space, or `''` when there are no clauses.
 */
export function compileOrderByClause(orderBy: OrderByClause[], context: SqlCompileContext): string {
  if (orderBy.length === 0) {
    return ''
  }

  return (
    ' order by ' +
    orderBy
      .map(
        (clause) =>
          quotePath(clause.column, context.quoteIdentifier) +
          ' ' +
          compileOrderByDirection(clause.direction),
      )
      .join(', ')
  )
}

/**
 * Compiles bound ` limit` and ` offset` clauses.
 * @param limit Maximum row count.
 * @param offset Number of rows to skip.
 * @param context Dialect hooks and bound-value state.
 * @returns SQL text with a leading space, or `''` when neither value is set.
 */
export function compileLimitOffsetClause(
  limit: number | undefined,
  offset: number | undefined,
  context: SqlCompileContext,
): string {
  let output = ''

  if (limit !== undefined) {
    output += ' limit ' + context.bindValue(limit)
  }

  if (offset !== undefined) {
    output += ' offset ' + context.bindValue(offset)
  }

  return output
}

/**
 * Compiles a ` returning ...` clause for dialects that support it.
 * @param returning Columns to return, or `'*'` for all columns.
 * @param context Dialect hooks and bound-value state.
 * @returns SQL text with a leading space, or `''` when `returning` is not set.
 */
export function compileReturningClause(
  returning: ReturningSelection | undefined,
  context: SqlCompileContext,
): string {
  if (!returning) {
    return ''
  }

  if (returning === '*') {
    return ' returning *'
  }

  return (
    ' returning ' + returning.map((column) => quotePath(column, context.quoteIdentifier)).join(', ')
  )
}
