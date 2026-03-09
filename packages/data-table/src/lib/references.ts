/**
 * Symbol key used to store non-enumerable table metadata.
 */
export const tableMetadataKey = Symbol('data-table.tableMetadata')

/**
 * Symbol key used to store non-enumerable column metadata.
 */
export const columnMetadataKey = Symbol('data-table.columnMetadata')

type UnknownTableMetadata<
  name extends string = string,
  columns extends Record<string, unknown> = Record<string, unknown>,
  primaryKey extends readonly string[] = readonly string[],
  timestamps = unknown,
> = {
  name: name
  columns: columns
  primaryKey: primaryKey
  timestamps: timestamps
}

export type TableMetadataLike<
  name extends string = string,
  columns extends Record<string, unknown> = Record<string, unknown>,
  primaryKey extends readonly string[] = readonly string[],
  timestamps = unknown,
> = {
  [tableMetadataKey]: UnknownTableMetadata<name, columns, primaryKey, timestamps>
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
  if (typeof value !== 'object' || value === null) {
    return false
  }

  if (!('kind' in value) || (value as { kind?: unknown }).kind !== 'column') {
    return false
  }

  return columnMetadataKey in (value as object)
}

/**
 * Normalizes string/column-reference inputs to a qualified column name.
 * @param input Column name or column reference.
 * @returns The normalized qualified column name.
 */
export function normalizeColumnInput<input extends string | ColumnReferenceLike>(
  input: input,
): NormalizeColumnInput<input> {
  if (typeof input === 'string') {
    return input as NormalizeColumnInput<input>
  }

  return input[columnMetadataKey].qualifiedName as NormalizeColumnInput<input>
}
