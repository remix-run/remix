import { DataTableQueryError } from '../errors.ts'
import type { QueryColumnName, QueryColumns, QueryColumnTypeMap } from '../database.ts'
import type { Predicate } from '../operators.ts'
import { and, eq, inList, or } from '../operators.ts'
import type { AnyRelation, AnyTable, Relation } from '../table.ts'
import { getCompositeKey, getTableName, getTablePrimaryKey } from '../table.ts'

import {
  createQueryBuilder,
  loadRowsWithRelations,
  type QueryExecutionContext,
} from './execution-context.ts'
import type { QueryBuilder } from './query-builder.ts'

export async function loadRelationsForRows(
  database: QueryExecutionContext,
  sourceTable: AnyTable,
  rows: Record<string, unknown>[],
  relationMap: Record<string, AnyRelation>,
): Promise<Record<string, unknown>[]> {
  let output = rows.map((row) => ({ ...row }))

  let relationNames = Object.keys(relationMap)

  for (let relationName of relationNames) {
    let relation = relationMap[relationName]

    if (relation.sourceTable !== sourceTable) {
      throw new DataTableQueryError(
        'Relation "' +
          relationName +
          '" is not defined for source table "' +
          getTableName(sourceTable) +
          '"',
      )
    }

    let values = await resolveRelationValues(database, output, relation)
    let index = 0

    while (index < output.length) {
      output[index][relationName] = values[index]
      index += 1
    }
  }

  return output
}

async function resolveRelationValues(
  database: QueryExecutionContext,
  sourceRows: Record<string, unknown>[],
  relation: AnyRelation,
): Promise<unknown[]> {
  if (relation.relationKind === 'hasManyThrough') {
    return loadHasManyThroughValues(database, sourceRows, relation)
  }

  return loadDirectRelationValues(database, sourceRows, relation)
}

async function loadDirectRelationValues(
  database: QueryExecutionContext,
  sourceRows: Record<string, unknown>[],
  relation: AnyRelation,
): Promise<unknown[]> {
  if (sourceRows.length === 0) {
    return []
  }

  let sourceTuples = uniqueTuples(sourceRows, relation.sourceKey)

  if (sourceTuples.length === 0) {
    return sourceRows.map(() => (relation.cardinality === 'many' ? [] : null))
  }

  let query = database[createQueryBuilder](relation.targetTable)
  let linkPredicate = buildLinkPredicate(relation.targetKey, sourceTuples)

  if (linkPredicate) {
    query = query.where(linkPredicate as Predicate<QueryColumnName<typeof relation.targetTable>>)
  }

  query = applyRelationModifiers(query, relation, {
    includePagination: false,
  })

  let relatedRows = await query[loadRowsWithRelations]()
  let grouped = groupRowsByTuple(relatedRows, relation.targetKey)

  return sourceRows.map((sourceRow) => {
    let key = getCompositeKey(sourceRow, relation.sourceKey)
    let matches = grouped.get(key) ?? []
    let pagedMatches = applyPagination(matches, relation.modifiers.limit, relation.modifiers.offset)

    if (relation.cardinality === 'many') {
      return pagedMatches
    }

    return pagedMatches[0] ?? null
  })
}

async function loadHasManyThroughValues(
  database: QueryExecutionContext,
  sourceRows: Record<string, unknown>[],
  relation: AnyRelation,
): Promise<unknown[]> {
  if (!relation.through) {
    throw new DataTableQueryError('hasManyThrough relation is missing through metadata')
  }

  if (sourceRows.length === 0) {
    return []
  }

  let throughRelation = relation.through.relation
  let sourceTuples = uniqueTuples(sourceRows, throughRelation.sourceKey)

  if (sourceTuples.length === 0) {
    return sourceRows.map(() => [])
  }

  let throughQuery = database[createQueryBuilder](throughRelation.targetTable)
  let throughPredicate = buildLinkPredicate(throughRelation.targetKey, sourceTuples)

  if (throughPredicate) {
    throughQuery = throughQuery.where(
      throughPredicate as Predicate<QueryColumnName<typeof throughRelation.targetTable>>,
    )
  }

  throughQuery = applyRelationModifiers(throughQuery, throughRelation, {
    includePagination: false,
  })

  let throughRows = await throughQuery[loadRowsWithRelations]()

  if (throughRows.length === 0) {
    return sourceRows.map(() => [])
  }

  let throughRowsBySource = groupRowsByTuple(throughRows, throughRelation.targetKey)
  let pagedThroughRowsBySource = new Map<string, Record<string, unknown>[]>()
  let pagedThroughRows: Record<string, unknown>[] = []

  for (let sourceRow of sourceRows) {
    let sourceKey = getCompositeKey(sourceRow, throughRelation.sourceKey)
    let matchedThroughRows = throughRowsBySource.get(sourceKey) ?? []
    let pagedMatchedRows = applyPagination(
      matchedThroughRows,
      throughRelation.modifiers.limit,
      throughRelation.modifiers.offset,
    )

    pagedThroughRowsBySource.set(sourceKey, pagedMatchedRows)
    pagedThroughRows.push(...pagedMatchedRows)
  }

  let throughTuples = uniqueTuples(pagedThroughRows, relation.through.throughSourceKey)

  if (throughTuples.length === 0) {
    return sourceRows.map(() => [])
  }

  let targetQuery = database[createQueryBuilder](relation.targetTable)
  let targetPredicate = buildLinkPredicate(relation.through.throughTargetKey, throughTuples)

  if (targetPredicate) {
    targetQuery = targetQuery.where(
      targetPredicate as Predicate<QueryColumnName<typeof relation.targetTable>>,
    )
  }

  targetQuery = applyRelationModifiers(targetQuery, relation, {
    includePagination: false,
  })

  let relatedRows = await targetQuery[loadRowsWithRelations]()
  let targetRowsByThrough = groupRowsByTuple(relatedRows, relation.through.throughTargetKey)

  return sourceRows.map((sourceRow) => {
    let sourceKey = getCompositeKey(sourceRow, throughRelation.sourceKey)
    let matchedThroughRows = pagedThroughRowsBySource.get(sourceKey) ?? []
    let outputRows: Record<string, unknown>[] = []
    let seen = new Set<string>()

    for (let throughRow of matchedThroughRows) {
      let throughKey = getCompositeKey(throughRow, relation.through!.throughSourceKey)
      let rowsForThrough = targetRowsByThrough.get(throughKey) ?? []

      for (let row of rowsForThrough) {
        let rowIdentity = getCompositeKey(row, getTablePrimaryKey(relation.targetTable))

        if (!seen.has(rowIdentity)) {
          seen.add(rowIdentity)
          outputRows.push(row)
        }
      }
    }

    return applyPagination(outputRows, relation.modifiers.limit, relation.modifiers.offset)
  })
}

function applyRelationModifiers<table extends AnyTable>(
  query: QueryBuilder<any, Record<string, unknown>, {}, any, readonly string[]>,
  relation: Relation<any, table, any, any>,
  options: { includePagination: boolean },
): QueryBuilder<any, Record<string, unknown>, any, any, readonly string[]> {
  let next = query

  for (let predicate of relation.modifiers.where) {
    next = next.where(predicate)
  }

  for (let clause of relation.modifiers.orderBy) {
    next = next.orderBy(clause.column as QueryColumns<QueryColumnTypeMap<table>>, clause.direction)
  }

  if (options.includePagination && relation.modifiers.limit !== undefined) {
    next = next.limit(relation.modifiers.limit)
  }

  if (options.includePagination && relation.modifiers.offset !== undefined) {
    next = next.offset(relation.modifiers.offset)
  }

  if (Object.keys(relation.modifiers.with).length > 0) {
    next = next.with(relation.modifiers.with)
  }

  return next
}

function applyPagination<row>(
  rows: row[],
  limit: number | undefined,
  offset: number | undefined,
): row[] {
  let offsetRows = offset === undefined ? rows : rows.slice(offset)
  return limit === undefined ? offsetRows : offsetRows.slice(0, limit)
}

function uniqueTuples(rows: Record<string, unknown>[], columns: string[]): unknown[][] {
  let output: unknown[][] = []
  let seen = new Set<string>()

  for (let row of rows) {
    let tuple = columns.map((column) => row[column])
    let key = tuple.map(stringifyForKey).join('::')

    if (!seen.has(key)) {
      seen.add(key)
      output.push(tuple)
    }
  }

  return output
}

function buildLinkPredicate(targetColumns: string[], tuples: unknown[][]): Predicate | undefined {
  if (tuples.length === 0) {
    return undefined
  }

  if (targetColumns.length === 1) {
    return inList(
      targetColumns[0],
      tuples.map((tuple) => tuple[0]),
    )
  }

  let tuplePredicates = tuples.map((tuple) => {
    let comparisons = targetColumns.map((column, index) => eq(column, tuple[index]))

    return and(...comparisons)
  })

  return or(...tuplePredicates)
}

function groupRowsByTuple(
  rows: Record<string, unknown>[],
  columns: string[],
): Map<string, Record<string, unknown>[]> {
  let output = new Map<string, Record<string, unknown>[]>()

  for (let row of rows) {
    let key = getCompositeKey(row, columns)
    let group = output.get(key)

    if (group) {
      group.push(row)
      continue
    }

    output.set(key, [row])
  }

  return output
}

function stringifyForKey(value: unknown): string {
  if (value === null) {
    return 'null'
  }

  if (value === undefined) {
    return 'undefined'
  }

  if (value instanceof Date) {
    return 'date:' + value.toISOString()
  }

  if (typeof value === 'string') {
    return JSON.stringify(value)
  }

  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value)
  }

  return JSON.stringify(value)
}
