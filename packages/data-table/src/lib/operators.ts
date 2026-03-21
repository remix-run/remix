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

/**
 * Object shorthand accepted in `where` clauses.
 */
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
  return createListPredicate('in', column, values)
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
  return createListPredicate('notIn', column, values)
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
  return createComparisonPredicate('like', column, value)
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
  return createComparisonPredicate('ilike', column, value)
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
  return createBetweenPredicate(column, lower, upper)
}

/**
 * Builds an `IS NULL` predicate.
 * @param column Column to compare.
 * @returns An `isNull` predicate.
 */
export function isNull<column extends string | ColumnReferenceLike>(
  column: column,
): Predicate<PredicateColumn<column>> {
  return createNullPredicate('isNull', column)
}

/**
 * Builds an `IS NOT NULL` predicate.
 * @param column Column to compare.
 * @returns A `notNull` predicate.
 */
export function notNull<column extends string | ColumnReferenceLike>(
  column: column,
): Predicate<PredicateColumn<column>> {
  return createNullPredicate('notNull', column)
}

/**
 * Combines predicates with logical `AND`.
 * @param predicates Child predicates.
 * @returns A logical `and` predicate.
 */
export function and<column extends string>(...predicates: Predicate<column>[]): Predicate<column> {
  return createLogicalPredicate('and', predicates)
}

/**
 * Combines predicates with logical `OR`.
 * @param predicates Child predicates.
 * @returns A logical `or` predicate.
 */
export function or<column extends string>(...predicates: Predicate<column>[]): Predicate<column> {
  return createLogicalPredicate('or', predicates)
}

/**
 * Normalizes object shorthand into a predicate tree.
 * @param input Predicate object or shorthand where map.
 * @returns A normalized predicate.
 */
export function normalizeWhereInput<column extends string>(
  input: WhereInput<column>,
): Predicate<column> {
  if (isPredicateInput(input)) {
    return input
  }

  let predicates = Object.keys(input).map((key) => eq(key as column, input[key as column])) as
    Predicate<column>[]

  return and(...predicates)
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

function createListPredicate<column extends string | ColumnReferenceLike>(
  operator: 'in' | 'notIn',
  column: column,
  values: readonly unknown[],
): Predicate<PredicateColumn<column>> {
  return {
    type: 'comparison',
    operator,
    column: resolvePredicateColumn(column),
    value: [...values],
    valueType: 'value',
  }
}

function createBetweenPredicate<column extends string | ColumnReferenceLike>(
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

function createNullPredicate<column extends string | ColumnReferenceLike>(
  operator: 'isNull' | 'notNull',
  column: column,
): Predicate<PredicateColumn<column>> {
  return {
    type: 'null',
    operator,
    column: resolvePredicateColumn(column),
  }
}

function createLogicalPredicate<column extends string>(
  operator: 'and' | 'or',
  predicates: Predicate<column>[],
): Predicate<column> {
  return {
    type: 'logical',
    operator,
    predicates: predicates.filter(Boolean),
  }
}

function isPredicateInput<column extends string>(
  input: WhereInput<column>,
): input is Predicate<column> {
  return (
    typeof input === 'object' &&
    input !== null &&
    'type' in input &&
    (input.type === 'comparison' ||
      input.type === 'between' ||
      input.type === 'null' ||
      input.type === 'logical')
  )
}

function createComparisonPredicate<
  left extends ColumnInput<QualifiedColumnReference>,
  right extends ColumnInput<QualifiedColumnReference>,
>(
  operator: Exclude<ComparisonOperator, 'in' | 'notIn'>,
  column: left,
  value: right & (right extends `${string}@${string}` ? never : right),
): Predicate<PredicateColumn<left> | PredicateColumn<right>>
function createComparisonPredicate<column extends string | ColumnReferenceLike>(
  operator: Exclude<ComparisonOperator, 'in' | 'notIn'>,
  column: column,
  value: unknown,
): Predicate<PredicateColumn<column>>
function createComparisonPredicate<column extends string | ColumnReferenceLike>(
  operator: Exclude<ComparisonOperator, 'in' | 'notIn'>,
  column: column,
  value: unknown,
): Predicate<PredicateColumn<column>> {
  let normalizedColumn = resolvePredicateColumn(column)
  let normalizedValue = resolveComparisonValue(value)

  if (isQualifiedColumnReference(normalizedColumn) && isQualifiedColumnReference(normalizedValue)) {
    let comparisonValue = normalizedValue as PredicateColumn<column>

    return {
      type: 'comparison',
      operator,
      column: normalizedColumn as PredicateColumn<column>,
      value: comparisonValue,
      valueType: 'column',
    }
  }

  return {
    type: 'comparison',
    operator,
    column: normalizedColumn as PredicateColumn<column>,
    value: normalizedValue,
    valueType: 'value',
  }
}
