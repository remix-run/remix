import { DataTableQueryError } from '../errors.ts'
import type {
  OrderByInput,
  OrderByTuple,
  QueryColumnName,
  QueryColumns,
  QueryColumnTypeMap,
  QueryForTable,
  QueryTableInput,
  SingleTableWhere,
  TableColumnName,
  WriteResult,
} from '../database.ts'
import type { Predicate } from '../operators.ts'
import { and, eq, inList, or } from '../operators.ts'
import { query as createQuery } from '../query.ts'
import type { AnyTable, TableName, TablePrimaryKey, TableRow } from '../table.ts'
import type { PrimaryKeyInput } from '../table-keys.ts'
import { getTableName, getTablePrimaryKey } from '../table.ts'
import { getPrimaryKeyObject } from '../table-keys.ts'

import type { QueryExecutionContext } from './execution-context.ts'
import { loadRowsWithRelationsForQuery } from './query-execution.ts'

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

export function hasScopedWriteModifiers(state: {
  orderBy: unknown[]
  limit?: number
  offset?: number
}): boolean {
  return state.orderBy.length > 0 || state.limit !== undefined || state.offset !== undefined
}

export function createScopedQuery<table extends AnyTable>(
  query: QueryForTable<table>,
  options?: {
    where?: SingleTableWhere<table>
    orderBy?: OrderByInput<table>
    limit?: number
    offset?: number
  },
): QueryForTable<table> {
  let scopedQuery = query

  if (options?.where) {
    scopedQuery = scopedQuery.where(options.where)
  }

  let orderBy = options?.orderBy

  if (orderBy) {
    let clauses = (Array.isArray(orderBy[0]) ? orderBy : [orderBy]) as OrderByTuple<table>[]

    for (let [column, direction] of clauses) {
      scopedQuery = scopedQuery.orderBy(column, direction)
    }
  }

  if (options?.limit !== undefined) {
    scopedQuery = scopedQuery.limit(options.limit)
  }

  if (options?.offset !== undefined) {
    scopedQuery = scopedQuery.offset(options.offset)
  }

  return scopedQuery
}

export function requireLoadedRow<row>(row: row | null, errorMessage: string): row {
  if (row === null) {
    throw new DataTableQueryError(errorMessage)
  }

  return row
}

export function toWriteResult(result: Pick<WriteResult, 'affectedRows' | 'insertId'>): WriteResult {
  return {
    affectedRows: result.affectedRows,
    insertId: result.insertId,
  }
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

  return rows
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
