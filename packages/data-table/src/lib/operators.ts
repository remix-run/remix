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

export type WhereInput<column extends string = string> = Predicate<column> | WhereObject<column>

export function eq<left extends QualifiedColumnReference, right extends QualifiedColumnReference>(
  column: left,
  value: right & (right extends `${string}@${string}` ? never : right),
): Predicate<left | right>
export function eq<column extends string>(column: column, value: unknown): Predicate<column>
export function eq(column: string, value: unknown): Predicate<string> {
  if (isQualifiedColumnReference(column) && isQualifiedColumnReference(value)) {
    return {
      type: 'comparison',
      operator: 'eq',
      column,
      value,
      valueType: 'column',
    }
  }

  return { type: 'comparison', operator: 'eq', column, value, valueType: 'value' }
}

export function ne<left extends QualifiedColumnReference, right extends QualifiedColumnReference>(
  column: left,
  value: right & (right extends `${string}@${string}` ? never : right),
): Predicate<left | right>
export function ne<column extends string>(column: column, value: unknown): Predicate<column>
export function ne(column: string, value: unknown): Predicate<string> {
  if (isQualifiedColumnReference(column) && isQualifiedColumnReference(value)) {
    return {
      type: 'comparison',
      operator: 'ne',
      column,
      value,
      valueType: 'column',
    }
  }

  return { type: 'comparison', operator: 'ne', column, value, valueType: 'value' }
}

export function gt<left extends QualifiedColumnReference, right extends QualifiedColumnReference>(
  column: left,
  value: right & (right extends `${string}@${string}` ? never : right),
): Predicate<left | right>
export function gt<column extends string>(column: column, value: unknown): Predicate<column>
export function gt(column: string, value: unknown): Predicate<string> {
  if (isQualifiedColumnReference(column) && isQualifiedColumnReference(value)) {
    return {
      type: 'comparison',
      operator: 'gt',
      column,
      value,
      valueType: 'column',
    }
  }

  return { type: 'comparison', operator: 'gt', column, value, valueType: 'value' }
}

export function gte<left extends QualifiedColumnReference, right extends QualifiedColumnReference>(
  column: left,
  value: right & (right extends `${string}@${string}` ? never : right),
): Predicate<left | right>
export function gte<column extends string>(column: column, value: unknown): Predicate<column>
export function gte(column: string, value: unknown): Predicate<string> {
  if (isQualifiedColumnReference(column) && isQualifiedColumnReference(value)) {
    return {
      type: 'comparison',
      operator: 'gte',
      column,
      value,
      valueType: 'column',
    }
  }

  return { type: 'comparison', operator: 'gte', column, value, valueType: 'value' }
}

export function lt<left extends QualifiedColumnReference, right extends QualifiedColumnReference>(
  column: left,
  value: right & (right extends `${string}@${string}` ? never : right),
): Predicate<left | right>
export function lt<column extends string>(column: column, value: unknown): Predicate<column>
export function lt(column: string, value: unknown): Predicate<string> {
  if (isQualifiedColumnReference(column) && isQualifiedColumnReference(value)) {
    return {
      type: 'comparison',
      operator: 'lt',
      column,
      value,
      valueType: 'column',
    }
  }

  return { type: 'comparison', operator: 'lt', column, value, valueType: 'value' }
}

export function lte<left extends QualifiedColumnReference, right extends QualifiedColumnReference>(
  column: left,
  value: right & (right extends `${string}@${string}` ? never : right),
): Predicate<left | right>
export function lte<column extends string>(column: column, value: unknown): Predicate<column>
export function lte(column: string, value: unknown): Predicate<string> {
  if (isQualifiedColumnReference(column) && isQualifiedColumnReference(value)) {
    return {
      type: 'comparison',
      operator: 'lte',
      column,
      value,
      valueType: 'column',
    }
  }

  return { type: 'comparison', operator: 'lte', column, value, valueType: 'value' }
}

export function inList<column extends string>(
  column: column,
  values: readonly unknown[],
): Predicate<column> {
  return { type: 'comparison', operator: 'in', column, value: [...values], valueType: 'value' }
}

export function notInList<column extends string>(
  column: column,
  values: readonly unknown[],
): Predicate<column> {
  return {
    type: 'comparison',
    operator: 'notIn',
    column,
    value: [...values],
    valueType: 'value',
  }
}

export function like<column extends string>(column: column, value: string): Predicate<column> {
  return { type: 'comparison', operator: 'like', column, value, valueType: 'value' }
}

export function ilike<column extends string>(column: column, value: string): Predicate<column> {
  return { type: 'comparison', operator: 'ilike', column, value, valueType: 'value' }
}

export function between<column extends string>(
  column: column,
  lower: unknown,
  upper: unknown,
): Predicate<column> {
  return { type: 'between', column, lower, upper }
}

export function isNull<column extends string>(column: column): Predicate<column> {
  return { type: 'null', operator: 'isNull', column }
}

export function notNull<column extends string>(column: column): Predicate<column> {
  return { type: 'null', operator: 'notNull', column }
}

export function and<column extends string>(...predicates: Predicate<column>[]): Predicate<column> {
  let filtered = predicates.filter(Boolean)
  return { type: 'logical', operator: 'and', predicates: filtered }
}

export function or<column extends string>(...predicates: Predicate<column>[]): Predicate<column> {
  let filtered = predicates.filter(Boolean)
  return { type: 'logical', operator: 'or', predicates: filtered }
}

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

export function normalizeWhereInput<column extends string>(
  input: WhereInput<column>,
): Predicate<column> {
  if (isPredicate(input)) {
    return input
  }

  let keys = Object.keys(input) as column[]
  let predicates = keys.map((column) => eq(column, input[column]))

  return and(...predicates)
}

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

  return /^[a-zA-Z_][a-zA-Z0-9_]*\.[a-zA-Z_][a-zA-Z0-9_]*$/.test(value)
}
