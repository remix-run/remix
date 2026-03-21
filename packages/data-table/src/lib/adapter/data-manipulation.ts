import type { AnyTable, OrderByClause } from '../table.ts'
import type { Predicate } from '../operators.ts'
import type { SqlStatement } from '../sql.ts'

/**
 * Supported SQL join kinds.
 */
export type JoinType = 'inner' | 'left' | 'right'

/**
 * Join configuration used in compiled select statements.
 */
export type JoinClause = {
  type: JoinType
  table: AnyTable
  on: Predicate
}

/**
 * Selected output column with optional alias.
 */
export type SelectColumn = {
  column: string
  alias: string
}

/**
 * Returning selection for write statements.
 */
export type ReturningSelection = '*' | string[]

/**
 * Canonical select statement shape consumed by adapters.
 */
export type SelectOperation<table extends AnyTable = AnyTable> = {
  kind: 'select'
  table: table
  select: '*' | SelectColumn[]
  distinct: boolean
  joins: JoinClause[]
  where: Predicate[]
  groupBy: string[]
  having: Predicate[]
  orderBy: OrderByClause[]
  limit?: number
  offset?: number
}

/**
 * Canonical count statement shape consumed by adapters.
 */
export type CountOperation<table extends AnyTable = AnyTable> = {
  kind: 'count'
  table: table
  joins: JoinClause[]
  where: Predicate[]
  groupBy: string[]
  having: Predicate[]
}

/**
 * Canonical exists statement shape consumed by adapters.
 */
export type ExistsOperation<table extends AnyTable = AnyTable> = {
  kind: 'exists'
  table: table
  joins: JoinClause[]
  where: Predicate[]
  groupBy: string[]
  having: Predicate[]
}

/**
 * Canonical insert statement shape consumed by adapters.
 */
export type InsertOperation<table extends AnyTable = AnyTable> = {
  kind: 'insert'
  table: table
  values: Record<string, unknown>
  returning?: ReturningSelection
}

/**
 * Canonical bulk-insert statement shape consumed by adapters.
 */
export type InsertManyOperation<table extends AnyTable = AnyTable> = {
  kind: 'insertMany'
  table: table
  values: Record<string, unknown>[]
  returning?: ReturningSelection
}

/**
 * Canonical update statement shape consumed by adapters.
 */
export type UpdateOperation<table extends AnyTable = AnyTable> = {
  kind: 'update'
  table: table
  changes: Record<string, unknown>
  where: Predicate[]
  returning?: ReturningSelection
}

/**
 * Canonical delete statement shape consumed by adapters.
 */
export type DeleteOperation<table extends AnyTable = AnyTable> = {
  kind: 'delete'
  table: table
  where: Predicate[]
  returning?: ReturningSelection
}

/**
 * Canonical upsert statement shape consumed by adapters.
 */
export type UpsertOperation<table extends AnyTable = AnyTable> = {
  kind: 'upsert'
  table: table
  values: Record<string, unknown>
  conflictTarget?: string[]
  update?: Record<string, unknown>
  returning?: ReturningSelection
}

/**
 * Raw SQL statement execution descriptor.
 */
export type RawOperation = {
  kind: 'raw'
  sql: SqlStatement
}

/**
 * Union of all data-manipulation statement shapes.
 */
export type DataManipulationOperation =
  | SelectOperation
  | CountOperation
  | ExistsOperation
  | InsertOperation
  | InsertManyOperation
  | UpdateOperation
  | DeleteOperation
  | UpsertOperation
  | RawOperation
