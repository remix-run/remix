import type { OrderByClause, AnyTable } from './table.ts'
import type { Predicate } from './operators.ts'
import type { SqlStatement } from './sql.ts'

export type JoinType = 'inner' | 'left' | 'right'

export type JoinClause = {
  type: JoinType
  table: AnyTable
  on: Predicate
}

export type SelectColumn = {
  column: string
  alias: string
}

export type ReturningSelection = '*' | string[]

export type SelectStatement<table extends AnyTable = AnyTable> = {
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

export type CountStatement<table extends AnyTable = AnyTable> = {
  kind: 'count'
  table: table
  joins: JoinClause[]
  where: Predicate[]
  groupBy: string[]
  having: Predicate[]
}

export type ExistsStatement<table extends AnyTable = AnyTable> = {
  kind: 'exists'
  table: table
  joins: JoinClause[]
  where: Predicate[]
  groupBy: string[]
  having: Predicate[]
}

export type InsertStatement<table extends AnyTable = AnyTable> = {
  kind: 'insert'
  table: table
  values: Record<string, unknown>
  returning?: ReturningSelection
}

export type InsertManyStatement<table extends AnyTable = AnyTable> = {
  kind: 'insertMany'
  table: table
  values: Record<string, unknown>[]
  returning?: ReturningSelection
}

export type UpdateStatement<table extends AnyTable = AnyTable> = {
  kind: 'update'
  table: table
  changes: Record<string, unknown>
  where: Predicate[]
  returning?: ReturningSelection
}

export type DeleteStatement<table extends AnyTable = AnyTable> = {
  kind: 'delete'
  table: table
  where: Predicate[]
  returning?: ReturningSelection
}

export type UpsertStatement<table extends AnyTable = AnyTable> = {
  kind: 'upsert'
  table: table
  values: Record<string, unknown>
  conflictTarget?: string[]
  update?: Record<string, unknown>
  returning?: ReturningSelection
}

export type RawStatement = {
  kind: 'raw'
  sql: SqlStatement
}

export type AdapterStatement =
  | SelectStatement
  | CountStatement
  | ExistsStatement
  | InsertStatement
  | InsertManyStatement
  | UpdateStatement
  | DeleteStatement
  | UpsertStatement
  | RawStatement

export type TransactionToken = {
  id: string
  metadata?: Record<string, unknown>
}

export type TransactionOptions = {
  isolationLevel?: 'read uncommitted' | 'read committed' | 'repeatable read' | 'serializable'
  readOnly?: boolean
}

export type AdapterExecuteRequest = {
  statement: AdapterStatement
  transaction?: TransactionToken
}

export type AdapterResult = {
  rows?: Record<string, unknown>[]
  affectedRows?: number
  insertId?: unknown
}

export type AdapterCapabilities = {
  returning: boolean
  savepoints: boolean
  upsert: boolean
}

export interface DatabaseAdapter {
  dialect: string
  capabilities: AdapterCapabilities
  execute(request: AdapterExecuteRequest): Promise<AdapterResult>
  beginTransaction(options?: TransactionOptions): Promise<TransactionToken>
  commitTransaction(token: TransactionToken): Promise<void>
  rollbackTransaction(token: TransactionToken): Promise<void>
  createSavepoint(token: TransactionToken, name: string): Promise<void>
  rollbackToSavepoint(token: TransactionToken, name: string): Promise<void>
  releaseSavepoint(token: TransactionToken, name: string): Promise<void>
}
