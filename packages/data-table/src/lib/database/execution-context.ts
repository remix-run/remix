import type {
  DataManipulationOperation,
  DataManipulationResult,
  DatabaseAdapter,
} from '../adapter.ts'
import type { Database, QueryMethod } from '../database.ts'

export const executeOperation = Symbol('executeOperation')
export const loadRowsWithRelations = Symbol('loadRowsWithRelations')

export type QueryExecutionContext = {
  adapter: DatabaseAdapter
  now(): unknown
  query: QueryMethod
  transaction<result>(callback: (database: Database) => Promise<result>): Promise<result>
  [executeOperation](operation: DataManipulationOperation): Promise<DataManipulationResult>
}
