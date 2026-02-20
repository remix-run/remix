import { isColumnReference, normalizeColumnInput } from './references.ts'
import type { ColumnInput, ColumnReferenceLike, NormalizeColumnInput } from './references.ts'

/**
 * Comparison operators supported by `comparison` predicates.
 */
export type ComparisonOperator =
  | 'eq'
  | 'ne'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'in'
  | 'notIn'
  | 'like'
  | 'ilike'

type QualifiedColumnReference = `${string}.${string}`

type PredicateColumn<input extends string | ColumnReferenceLike> = NormalizeColumnInput<input> &
  string

/**
 * Normalized predicate representation consumed by adapters.
 */
export type Predicate<column extends string = string> =
  | {
      type: 'comparison'
      operator: ComparisonOperator
      column: column
      value: unknown
      valueType: 'value'
    }
  | {
      type: 'comparison'
      operator: Exclude<ComparisonOperator, 'in' | 'notIn'>
      column: column
      value: column
      valueType: 'column'
    }
  | {
      type: 'between'
      column: column
      lower: unknown
      upper: unknown
    }
  | {
      type: 'null'
      operator: 'isNull' | 'notNull'
      column: column
    }
  | {
      type: 'logical'
      operator: 'and' | 'or'
      predicates: Predicate<column>[]
    }

export type WhereObject<column extends string = string> = Partial<Record<column, unknown>>

/**
 * User-facing where input accepted by `query.where()` and relation modifiers.
 */
export type WhereInput<column extends string = string> = Predicate<column> | WhereObject<column>

/**
 * Builds an equality predicate.
 */
export function eq<
  left extends ColumnInput<QualifiedColumnReference>,
  right extends ColumnInput<QualifiedColumnReference>,
>(
  column: left,
  value: right & (right extends `${string}@${string}` ? never : right),
): Predicate<PredicateColumn<left> | PredicateColumn<right>>
export function eq<column extends string | ColumnReferenceLike>(
  column: column,
  value: unknown,
): Predicate<PredicateColumn<column>>
export function eq(column: string | ColumnReferenceLike, value: unknown): Predicate<string> {
  return createComparisonPredicate('eq', column, value)
}

/**
 * Builds an inequality predicate.
 */
export function ne<
  left extends ColumnInput<QualifiedColumnReference>,
  right extends ColumnInput<QualifiedColumnReference>,
>(
  column: left,
  value: right & (right extends `${string}@${string}` ? never : right),
): Predicate<PredicateColumn<left> | PredicateColumn<right>>
export function ne<column extends string | ColumnReferenceLike>(
  column: column,
  value: unknown,
): Predicate<PredicateColumn<column>>
export function ne(column: string | ColumnReferenceLike, value: unknown): Predicate<string> {
  return createComparisonPredicate('ne', column, value)
}

/**
 * Builds a greater-than predicate.
 */
export function gt<
  left extends ColumnInput<QualifiedColumnReference>,
  right extends ColumnInput<QualifiedColumnReference>,
>(
  column: left,
  value: right & (right extends `${string}@${string}` ? never : right),
): Predicate<PredicateColumn<left> | PredicateColumn<right>>
export function gt<column extends string | ColumnReferenceLike>(
  column: column,
  value: unknown,
): Predicate<PredicateColumn<column>>
export function gt(column: string | ColumnReferenceLike, value: unknown): Predicate<string> {
  return createComparisonPredicate('gt', column, value)
}

/**
 * Builds a greater-than-or-equal predicate.
 */
export function gte<
  left extends ColumnInput<QualifiedColumnReference>,
  right extends ColumnInput<QualifiedColumnReference>,
>(
  column: left,
  value: right & (right extends `${string}@${string}` ? never : right),
): Predicate<PredicateColumn<left> | PredicateColumn<right>>
export function gte<column extends string | ColumnReferenceLike>(
  column: column,
  value: unknown,
): Predicate<PredicateColumn<column>>
export function gte(column: string | ColumnReferenceLike, value: unknown): Predicate<string> {
  return createComparisonPredicate('gte', column, value)
}

/**
 * Builds a less-than predicate.
 */
export function lt<
  left extends ColumnInput<QualifiedColumnReference>,
  right extends ColumnInput<QualifiedColumnReference>,
>(
  column: left,
  value: right & (right extends `${string}@${string}` ? never : right),
): Predicate<PredicateColumn<left> | PredicateColumn<right>>
export function lt<column extends string | ColumnReferenceLike>(
  column: column,
  value: unknown,
): Predicate<PredicateColumn<column>>
export function lt(column: string | ColumnReferenceLike, value: unknown): Predicate<string> {
  return createComparisonPredicate('lt', column, value)
}

/**
 * Builds a less-than-or-equal predicate.
 */
export function lte<
  left extends ColumnInput<QualifiedColumnReference>,
  right extends ColumnInput<QualifiedColumnReference>,
>(
  column: left,
  value: right & (right extends `${string}@${string}` ? never : right),
): Predicate<PredicateColumn<left> | PredicateColumn<right>>
export function lte<column extends string | ColumnReferenceLike>(
  column: column,
  value: unknown,
): Predicate<PredicateColumn<column>>
export function lte(column: string | ColumnReferenceLike, value: unknown): Predicate<string> {
  return createComparisonPredicate('lte', column, value)
}

/**
 * Builds an `IN` predicate.
 * @param column Column to compare.
 * @param values Candidate values.
 * @returns An `in` comparison predicate.
 */
export function inList<column extends string | ColumnReferenceLike>(
  column: column,
  values: readonly unknown[],
): Predicate<PredicateColumn<column>> {
  return {
    type: 'comparison',
    operator: 'in',
    column: resolvePredicateColumn(column),
    value: [...values],
    valueType: 'value',
  }
}

/**
 * Builds a `NOT IN` predicate.
 * @param column Column to compare.
 * @param values Candidate values.
 * @returns A `notIn` comparison predicate.
 */
export function notInList<column extends string | ColumnReferenceLike>(
  column: column,
  values: readonly unknown[],
): Predicate<PredicateColumn<column>> {
  return {
    type: 'comparison',
    operator: 'notIn',
    column: resolvePredicateColumn(column),
    value: [...values],
    valueType: 'value',
  }
}

/**
 * Builds a case-sensitive SQL `LIKE` predicate.
 * @param column Column to compare.
 * @param value Match pattern.
 * @returns A `like` comparison predicate.
 */
export function like<column extends string | ColumnReferenceLike>(
  column: column,
  value: string,
): Predicate<PredicateColumn<column>> {
  return {
    type: 'comparison',
    operator: 'like',
    column: resolvePredicateColumn(column),
    value,
    valueType: 'value',
  }
}

/**
 * Builds a case-insensitive SQL `LIKE` predicate.
 * @param column Column to compare.
 * @param value Match pattern.
 * @returns An `ilike` comparison predicate.
 */
export function ilike<column extends string | ColumnReferenceLike>(
  column: column,
  value: string,
): Predicate<PredicateColumn<column>> {
  return {
    type: 'comparison',
    operator: 'ilike',
    column: resolvePredicateColumn(column),
    value,
    valueType: 'value',
  }
}

/**
 * Builds a `BETWEEN` predicate.
 * @param column Column to compare.
 * @param lower Lower bound value.
 * @param upper Upper bound value.
 * @returns A `between` predicate.
 */
export function between<column extends string | ColumnReferenceLike>(
  column: column,
  lower: unknown,
  upper: unknown,
): Predicate<PredicateColumn<column>> {
  return {
    type: 'between',
    column: resolvePredicateColumn(column),
    lower,
    upper,
  }
}

/**
 * Builds an `IS NULL` predicate.
 * @param column Column to compare.
 * @returns An `isNull` predicate.
 */
export function isNull<column extends string | ColumnReferenceLike>(
  column: column,
): Predicate<PredicateColumn<column>> {
  return { type: 'null', operator: 'isNull', column: resolvePredicateColumn(column) }
}

/**
 * Builds an `IS NOT NULL` predicate.
 * @param column Column to compare.
 * @returns A `notNull` predicate.
 */
export function notNull<column extends string | ColumnReferenceLike>(
  column: column,
): Predicate<PredicateColumn<column>> {
  return { type: 'null', operator: 'notNull', column: resolvePredicateColumn(column) }
}

/**
 * Combines predicates with logical `AND`.
 * @param predicates Child predicates.
 * @returns A logical `and` predicate.
 */
export function and<column extends string>(...predicates: Predicate<column>[]): Predicate<column> {
  let filtered = predicates.filter(Boolean)
  return { type: 'logical', operator: 'and', predicates: filtered }
}

/**
 * Combines predicates with logical `OR`.
 * @param predicates Child predicates.
 * @returns A logical `or` predicate.
 */
export function or<column extends string>(...predicates: Predicate<column>[]): Predicate<column> {
  let filtered = predicates.filter(Boolean)
  return { type: 'logical', operator: 'or', predicates: filtered }
}

/**
 * Returns `true` when a value is a normalized predicate object.
 * @param value Value to inspect.
 * @returns Whether the value is a predicate.
 */
export function isPredicate<column extends string = string>(
  value: unknown,
): value is Predicate<column> {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  if (!('type' in value)) {
    return false
  }

  let input = value as { type?: unknown }
  return (
    input.type === 'comparison' ||
    input.type === 'between' ||
    input.type === 'null' ||
    input.type === 'logical'
  )
}

/**
 * Normalizes object shorthand into a predicate tree.
 * @param input Predicate object or shorthand where map.
 * @returns A normalized predicate.
 */
export function normalizeWhereInput<column extends string>(
  input: WhereInput<column>,
): Predicate<column> {
  if (isPredicate(input)) {
    return input
  }

  let keys = Object.keys(input) as column[]
  let predicates = keys.map((column) => eq(column, input[column]) as Predicate<column>)

  return and(...predicates)
}

/**
 * Collects referenced columns from a predicate tree.
 * @param predicate Predicate to inspect.
 * @returns Referenced column names.
 */
export function getPredicateColumns(predicate: Predicate): string[] {
  if (predicate.type === 'comparison') {
    if (predicate.valueType === 'column') {
      return [predicate.column, predicate.value]
    }

    return [predicate.column]
  }

  if (predicate.type === 'between') {
    return [predicate.column]
  }

  if (predicate.type === 'null') {
    return [predicate.column]
  }

  let columns: string[] = []

  for (let child of predicate.predicates) {
    columns.push(...getPredicateColumns(child))
  }

  return columns
}

function isQualifiedColumnReference(value: unknown): value is QualifiedColumnReference {
  if (typeof value !== 'string') {
    return false
  }

  return /^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)+$/.test(value)
}

function resolvePredicateColumn<input extends string | ColumnReferenceLike>(
  column: input,
): PredicateColumn<input> {
  return normalizeColumnInput(column) as PredicateColumn<input>
}

function resolveComparisonValue(value: unknown): unknown {
  if (isColumnReference(value)) {
    return normalizeColumnInput(value)
  }

  return value
}

function createComparisonPredicate(
  operator: Exclude<ComparisonOperator, 'in' | 'notIn'>,
  column: string | ColumnReferenceLike,
  value: unknown,
): Predicate<string> {
  let normalizedColumn = resolvePredicateColumn(column)
  let normalizedValue = resolveComparisonValue(value)

  if (isQualifiedColumnReference(normalizedColumn) && isQualifiedColumnReference(normalizedValue)) {
    return {
      type: 'comparison',
      operator,
      column: normalizedColumn,
      value: normalizedValue,
      valueType: 'column',
    }
  }

  return {
    type: 'comparison',
    operator,
    column: normalizedColumn,
    value: normalizedValue,
    valueType: 'value',
  }
}
