import { DataTableQueryError } from '../errors.ts'
import type {
  OrderByInput,
  OrderByTuple,
  QueryColumnName,
  QueryColumns,
  QueryColumnTypeMap,
  QueryTableInput,
  SingleTableWhere,
  TableColumnName,
  WriteResult,
  WriteRowsResult,
} from '../database.ts'
import type { Predicate } from '../operators.ts'
import { and, eq, inList, or } from '../operators.ts'
import { query as createQuery } from '../query.ts'
import type { AnyTable, PrimaryKeyInput, TableName, TablePrimaryKey, TableRow } from '../table.ts'
import { getPrimaryKeyObject, getTableName, getTablePrimaryKey } from '../table.ts'

import type { QueryExecutionContext } from './execution-context.ts'
import { loadRowsWithRelationsForQuery } from './query-execution.ts'

export function asQueryTableInput<table extends AnyTable>(
  table: table,
): QueryTableInput<TableName<table>, TableRow<table>, TablePrimaryKey<table>> {
  return table as unknown as QueryTableInput<
    TableName<table>,
    TableRow<table>,
    TablePrimaryKey<table>
  >
}

export function getPrimaryKeyWhere<table extends AnyTable>(
  table: table,
  value: PrimaryKeyInput<table>,
): SingleTableWhere<table> {
  return getPrimaryKeyObject(table, value as any) as SingleTableWhere<table>
}

export function getPrimaryKeyWhereFromRow<table extends AnyTable>(
  table: table,
  row: Record<string, unknown>,
): SingleTableWhere<table> {
  let where: Record<string, unknown> = {}

  for (let key of getTablePrimaryKey(table) as string[]) {
    where[key] = row[key]
  }

  return where as SingleTableWhere<table>
}

export function resolveCreateRowWhere<table extends AnyTable>(
  table: table,
  values: Partial<TableRow<table>>,
  insertId: unknown,
): SingleTableWhere<table> {
  let primaryKey = getTablePrimaryKey(table) as string[]

  if (primaryKey.length === 1) {
    let key = primaryKey[0]

    if (Object.prototype.hasOwnProperty.call(values, key)) {
      return {
        [key]: (values as Record<string, unknown>)[key],
      } as SingleTableWhere<table>
    }

    if (insertId !== undefined) {
      return {
        [key]: insertId,
      } as SingleTableWhere<table>
    }
  }

  let where: Record<string, unknown> = {}

  for (let key of primaryKey) {
    if (!Object.prototype.hasOwnProperty.call(values, key)) {
      throw new DataTableQueryError(
        'create({ returnRow: true }) requires primary key values for table "' +
          getTableName(table) +
          '" when adapter does not support RETURNING',
      )
    }

    where[key] = (values as Record<string, unknown>)[key]
  }

  return where as SingleTableWhere<table>
}

export function normalizeOrderByInput<table extends AnyTable>(
  input: OrderByInput<table> | undefined,
): OrderByTuple<table>[] {
  if (!input) {
    return []
  }

  if (input.length === 0) {
    return []
  }

  if (Array.isArray(input[0])) {
    return input as OrderByTuple<table>[]
  }

  return [input as OrderByTuple<table>]
}

export function toWriteResult(result: WriteResult | WriteRowsResult<unknown>): WriteResult {
  return {
    affectedRows: result.affectedRows,
    insertId: result.insertId,
  }
}

export function hasScopedWriteModifiers(state: {
  orderBy: unknown[]
  limit?: number
  offset?: number
}): boolean {
  return state.orderBy.length > 0 || state.limit !== undefined || state.offset !== undefined
}

export async function loadPrimaryKeyRowsForScope<table extends AnyTable>(
  database: QueryExecutionContext,
  table: table,
  state: {
    where: Predicate<string>[]
    orderBy: Array<{ column: string; direction: 'asc' | 'desc' }>
    limit?: number
    offset?: number
  },
): Promise<Record<string, unknown>[]> {
  let query = createQuery(
    table as unknown as QueryTableInput<TableName<table>, TableRow<table>, TablePrimaryKey<table>>,
  )

  for (let predicate of state.where) {
    query = query.where(predicate as Predicate<QueryColumnName<table>>)
  }

  for (let clause of state.orderBy) {
    query = query.orderBy(
      clause.column as QueryColumns<QueryColumnTypeMap<table>>,
      clause.direction,
    )
  }

  if (state.limit !== undefined) {
    query = query.limit(state.limit)
  }

  if (state.offset !== undefined) {
    query = query.offset(state.offset)
  }

  let rows = await loadRowsWithRelationsForQuery(
    database,
    query.select(...(getTablePrimaryKey(table) as (keyof TableRow<table> & string)[])),
  )
  let primaryKeys = getTablePrimaryKey(table) as string[]

  return rows.map((row) => {
    let keyObject: Record<string, unknown> = {}

    for (let key of rowKeys(row as Record<string, unknown>, primaryKeys)) {
      keyObject[key] = (row as Record<string, unknown>)[key]
    }

    return keyObject
  })
}

export function buildPrimaryKeyPredicate<table extends AnyTable>(
  table: table,
  keyObjects: Record<string, unknown>[],
): Predicate<TableColumnName<table>> | undefined {
  let primaryKey = getTablePrimaryKey(table)

  if (keyObjects.length === 0) {
    return undefined
  }

  if (primaryKey.length === 1) {
    let key = primaryKey[0] as TableColumnName<table>
    return inList(
      key,
      keyObjects.map((objectValue) => objectValue[key]),
    )
  }

  let predicates = keyObjects.map((objectValue) => {
    let comparisons = primaryKey.map((key) => {
      let typedKey = key as TableColumnName<table>
      return eq(typedKey, objectValue[typedKey])
    })

    return and(...comparisons)
  })

  return or(...predicates)
}

function rowKeys(row: Record<string, unknown>, keys: string[]): string[] {
  let output: string[] = []

  for (let key of keys) {
    if (Object.prototype.hasOwnProperty.call(row, key)) {
      output.push(key)
    }
  }

  return output
}
