import type { ColumnInput as ColumnBuilderInput } from './column.ts'
import type { AnyTable, TableColumns, TablePrimaryKey, TableRow } from './table/metadata.ts'
import { getTableName, getTablePrimaryKey } from './table/metadata.ts'
import type { WhereObject } from './operators.ts'
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
): WhereObject<keyof TableRow<table> & string> {
  let keys = getTablePrimaryKey(table)

  if (keys.length === 1) {
    if (!isPlainObject(value)) {
      return createPrimaryKeyObject(keys[0], value)
    }
  }

  if (!isPlainObject(value)) {
    throw new Error('Composite primary keys require an object value')
  }

  let objectValue = value
  let output: Partial<TableRow<table>> = {}

  for (let key of keys) {
    if (!(key in objectValue)) {
      throw new Error(
        'Missing key "' + key + '" for primary key lookup on "' + getTableName(table) + '"',
      )
    }

    Object.assign(output, { [key]: objectValue[key] })
  }

  return output
}

function createPrimaryKeyObject<
  table extends AnyTable,
  column extends keyof TableRow<table> & string,
>(key: column, value: unknown): WhereObject<keyof TableRow<table> & string> {
  let output: WhereObject<keyof TableRow<table> & string> = {}
  output[key] = value
  return output
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Builds a stable key for a row tuple.
 * @param row Source row.
 * @param columns Columns included in the tuple.
 * @returns Stable tuple key.
 */
export function getCompositeKey(row: Record<string, unknown>, columns: readonly string[]): string {
  let values = columns.map((column) => {
    let value = row[column]

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
  })

  return values.join('::')
}
