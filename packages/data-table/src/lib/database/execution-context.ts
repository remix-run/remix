import type {
  DataManipulationOperation,
  DataManipulationResult,
  DatabaseAdapter,
} from '../adapter.ts'
import type { Database, QueryTableInput } from '../database.ts'
import type { QueryBuilder } from './query-builder.ts'

export const createQueryBuilder = Symbol('createQueryBuilder')
export const executeOperation = Symbol('executeOperation')
export const loadRowsWithRelations = Symbol('loadRowsWithRelations')

export type QueryExecutionContext = {
  adapter: DatabaseAdapter
  now(): unknown
  [createQueryBuilder]<
    tableName extends string,
    row extends Record<string, unknown>,
    primaryKey extends readonly (keyof row & string)[],
  >(
    table: QueryTableInput<tableName, row, primaryKey>,
  ): QueryBuilder<any, row, {}, tableName, primaryKey>
  transaction<result>(callback: (database: Database) => Promise<result>): Promise<result>
  [executeOperation](operation: DataManipulationOperation): Promise<DataManipulationResult>
}
