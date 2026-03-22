/**
 * Symbol key used to store non-enumerable table metadata.
 */
export const tableMetadataKey = Symbol('data-table.tableMetadata')

/**
 * Symbol key used to store non-enumerable column metadata.
 */
export const columnMetadataKey = Symbol('data-table.columnMetadata')

export type TableMetadataLike<
  name extends string = string,
  columns extends Record<string, unknown> = Record<string, unknown>,
  primaryKey extends readonly string[] = readonly string[],
  timestamps = unknown,
> = {
  [tableMetadataKey]: {
    name: name
    columns: columns
    primaryKey: primaryKey
    timestamps: timestamps
  }
}

export type ColumnReferenceLike<qualifiedName extends string = string> = {
  kind: 'column'
  [columnMetadataKey]: {
    tableName: string
    columnName: string
    qualifiedName: qualifiedName
  }
}

export type ColumnInput<qualifiedName extends string = string> =
  | qualifiedName
  | ColumnReferenceLike<qualifiedName>

export type NormalizeColumnInput<input> =
  input extends ColumnReferenceLike<infer qualifiedName> ? qualifiedName : input

/**
 * Returns `true` when a value is a `data-table` column reference.
 * @param value Value to inspect.
 * @returns Whether the value is a column reference object.
 */
export function isColumnReference(value: unknown): value is ColumnReferenceLike {
  return (
    typeof value === 'object' &&
    value !== null &&
    'kind' in value &&
    value.kind === 'column' &&
    columnMetadataKey in value
  )
}

/**
 * Normalizes string/column-reference inputs to a qualified column name.
 * @param input Column name or column reference.
 * @returns The normalized qualified column name.
 */
export function normalizeColumnInput<input extends string>(
  input: input,
): NormalizeColumnInput<input>
export function normalizeColumnInput<input extends ColumnReferenceLike>(
  input: input,
): NormalizeColumnInput<input>
export function normalizeColumnInput<input extends string | ColumnReferenceLike>(
  input: input,
): NormalizeColumnInput<input>
export function normalizeColumnInput(input: string | ColumnReferenceLike) {
  if (typeof input === 'string') {
    return input
  }

  return input[columnMetadataKey].qualifiedName
}
