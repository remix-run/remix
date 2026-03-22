import { DataTableQueryError } from '../errors.ts'
import type {
  OrderByInput,
  OrderByTuple,
  QueryForTable,
  SingleTableWhere,
  TableColumnName,
  WriteResult,
  WriteRowResult,
  WriteRowsResult,
} from '../database.ts'
import type { Predicate, WhereObject } from '../operators.ts'
import { and, eq, inList, or } from '../operators.ts'
import { query as createQuery } from '../query.ts'
import type { AnyTable, TableRow } from '../table.ts'
import type { PrimaryKeyInput } from '../table-keys.ts'
import { getTableName, getTablePrimaryKey } from '../table.ts'
import { getPrimaryKeyObject } from '../table-keys.ts'

import type { QueryExecutionContext } from './execution-context.ts'
import { loadRowsWithRelationsForQuery } from './query-execution.ts'

export function getPrimaryKeyWhere<table extends AnyTable>(
  table: table,
  value: PrimaryKeyInput<table>,
): WhereObject<TableColumnName<table>> {
  return getPrimaryKeyObject(table, value)
}

export function getPrimaryKeyWhereFromRow<table extends AnyTable>(
  table: table,
  row: Record<string, unknown>,
): WhereObject<TableColumnName<table>> {
  let where: WhereObject<TableColumnName<table>> = Object.create(null)

  for (let key of getTablePrimaryKey(table)) {
    Object.assign(where, { [key]: row[key] })
  }

  return where
}

export function resolveCreateRowWhere<table extends AnyTable>(
  table: table,
  values: Partial<TableRow<table>>,
  insertId: unknown,
): WhereObject<TableColumnName<table>> {
  let primaryKey = getTablePrimaryKey(table)

  if (primaryKey.length === 1) {
    let key = primaryKey[0]

    if (Object.prototype.hasOwnProperty.call(values, key)) {
      let where: WhereObject<TableColumnName<table>> = Object.create(null)
      Object.assign(where, { [key]: values[key] })
      return where
    }

    if (insertId !== undefined) {
      let where: WhereObject<TableColumnName<table>> = Object.create(null)
      Object.assign(where, { [key]: insertId })
      return where
    }
  }

  for (let key of primaryKey) {
    if (!Object.prototype.hasOwnProperty.call(values, key)) {
      throw new DataTableQueryError(
        'create({ returnRow: true }) requires primary key values for table "' +
          getTableName(table) +
          '" when adapter does not support RETURNING',
      )
    }
  }

  let where: WhereObject<TableColumnName<table>> = Object.create(null)

  for (let key of primaryKey) {
    Object.assign(where, { [key]: values[key] })
  }

  return where
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

  if (options?.orderBy) {
    if (isOrderByTupleList(options.orderBy)) {
      for (let [column, direction] of options.orderBy) {
        scopedQuery = scopedQuery.orderBy(column, direction)
      }
    } else {
      let [column, direction] = options.orderBy
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

export function toWriteRow<row>(result: WriteResult | WriteRowResult<row>): row | null {
  return 'row' in result ? result.row : null
}

export function toWriteRows<row>(result: WriteResult | WriteRowsResult<row>): row[] {
  return 'rows' in result ? result.rows : []
}

export function toLoadedRow<table extends AnyTable, loaded extends Record<string, unknown> = {}>(
  row: TableRow<table>,
): TableRow<table> & loaded
export function toLoadedRow(row: TableRow<AnyTable>): TableRow<AnyTable>
export function toLoadedRow(row: TableRow<AnyTable>) {
  return row
}

export function toLoadedRowOrNull<
  table extends AnyTable,
  loaded extends Record<string, unknown> = {},
>(row: TableRow<table> | null): (TableRow<table> & loaded) | null
export function toLoadedRowOrNull(row: TableRow<AnyTable> | null): TableRow<AnyTable> | null
export function toLoadedRowOrNull(row: TableRow<AnyTable> | null) {
  return row
}

export function toLoadedRows<table extends AnyTable, loaded extends Record<string, unknown> = {}>(
  rows: TableRow<table>[],
): Array<TableRow<table> & loaded>
export function toLoadedRows(rows: TableRow<AnyTable>[]): TableRow<AnyTable>[]
export function toLoadedRows(rows: TableRow<AnyTable>[]) {
  return rows
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
  let query = createQuery(table)

  for (let predicate of state.where) {
    query = query.where(predicate)
  }

  for (let clause of state.orderBy) {
    query = query.orderBy(clause.column, clause.direction)
  }

  if (state.limit !== undefined) {
    query = query.limit(state.limit)
  }

  if (state.offset !== undefined) {
    query = query.offset(state.offset)
  }

  let rows = await loadRowsWithRelationsForQuery(database, query.select(...getTablePrimaryKey(table)))

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
    let key = primaryKey[0]
    return inList(
      key,
      keyObjects.map((objectValue) => objectValue[key]),
    )
  }

  let predicates = keyObjects.map((objectValue) => {
    let comparisons = primaryKey.map((key) => eq(key, objectValue[key]))

    return and(...comparisons)
  })

  return or(...predicates)
}

function isOrderByTupleList<table extends AnyTable>(
  orderBy: OrderByInput<table>,
): orderBy is OrderByTuple<table>[] {
  return Array.isArray(orderBy[0])
}
