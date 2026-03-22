import type { TableColumnName } from '../database.ts'
import type { Predicate, WhereObject } from '../operators.ts'
import { and, eq, inList, or } from '../operators.ts'
import { query as createQuery } from '../query.ts'
import type { AnyTable } from '../table.ts'
import { getTablePrimaryKey } from '../table.ts'

import type { QueryExecutionContext } from './execution-context.ts'
import { loadRowsWithRelationsForQuery } from './query-execution.ts'

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
