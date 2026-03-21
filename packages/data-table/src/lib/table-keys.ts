import type { ColumnInput as ColumnBuilderInput } from './column.ts'
import type { AnyTable, TableColumns, TablePrimaryKey, TableRow } from './table.ts'
import { getTableName, getTablePrimaryKey } from './table.ts'
import type { Pretty } from './types.ts'

/**
 * Primary-key input accepted by `find()`, `update()`, and similar helpers.
 */
export type PrimaryKeyInput<table extends AnyTable> =
  TablePrimaryKey<table> extends readonly [infer column extends string]
    ? column extends keyof TableColumns<table> & string
      ? ColumnBuilderInput<TableColumns<table>[column]>
      : never
    : Pretty<{
        [column in TablePrimaryKey<table>[number] &
          keyof TableColumns<table> &
          string]: ColumnBuilderInput<TableColumns<table>[column]>
      }>

/**
 * Normalizes a primary-key input into an object keyed by primary-key columns.
 * @param table Source table.
 * @param value Primary-key input value.
 * @returns Primary-key object.
 */
export function getPrimaryKeyObject<table extends AnyTable>(
  table: table,
  value: PrimaryKeyInput<table>,
): Partial<TableRow<table>> {
  let keys = getTablePrimaryKey(table)

  if (keys.length === 1 && (typeof value !== 'object' || value === null || Array.isArray(value))) {
    let key = keys[0] as keyof TableRow<table>
    return { [key]: value } as Partial<TableRow<table>>
  }

  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Composite primary keys require an object value')
  }

  let objectValue = value as Record<string, unknown>
  let output: Partial<TableRow<table>> = {}

  for (let key of keys) {
    if (!(key in objectValue)) {
      throw new Error(
        'Missing key "' + key + '" for primary key lookup on "' + getTableName(table) + '"',
      )
    }

    ;(output as Record<string, unknown>)[key] = objectValue[key]
  }

  return output
}

/**
 * Builds a stable key for a row tuple.
 * @param row Source row.
 * @param columns Columns included in the tuple.
 * @returns Stable tuple key.
 */
export function getCompositeKey(row: Record<string, unknown>, columns: readonly string[]): string {
  let values = columns.map((column) => stableSerialize(row[column]))

  return values.join('::')
}

/**
 * Serializes values into stable string representations for key generation.
 * @param value Value to serialize.
 * @returns Stable serialized value.
 */
export function stableSerialize(value: unknown): string {
  if (value === null) {
    return 'null'
  }

  if (value === undefined) {
    return 'undefined'
  }

  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value)
  }

  if (typeof value === 'string') {
    return JSON.stringify(value)
  }

  if (value instanceof Date) {
    return 'date:' + value.toISOString()
  }

  return JSON.stringify(value)
}
