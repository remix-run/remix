import type { DataManipulationOperation } from './data-manipulation.ts'
import type { DataMigrationOperation, TableRef } from './migration.ts'
import type { SqlStatement } from '../sql.ts'
import type { Pretty } from '../types.ts'

/**
 * Opaque transaction handle supplied by adapters.
 */
export type TransactionToken = {
  id: string
  metadata?: Record<string, unknown>
}

/**
 * Transaction hints that adapters may apply when supported by the dialect.
 */
export type TransactionOptions = {
  isolationLevel?: 'read uncommitted' | 'read committed' | 'repeatable read' | 'serializable'
  readOnly?: boolean
}

/**
 * Adapter execution request payload.
 */
export type DataManipulationRequest = {
  operation: DataManipulationOperation
  transaction?: TransactionToken
}

/**
 * Adapter migration request payload.
 */
export type DataMigrationRequest = {
  operation: DataMigrationOperation
  transaction?: TransactionToken
}

/**
 * Adapter data-manipulation result payload.
 */
export type DataManipulationResult = {
  rows?: Record<string, unknown>[]
  affectedRows?: number
  insertId?: unknown
}

/**
 * Adapter data-migration result payload.
 */
export type DataMigrationResult = {
  /**
   * Number of migration operations processed by the adapter call.
   */
  affectedOperations?: number
}

/**
 * Declares adapter feature support.
 */
export type AdapterCapabilities = {
  returning: boolean
  savepoints: boolean
  upsert: boolean
  transactionalDdl: boolean
  migrationLock: boolean
}

/**
 * Partial capabilities used to override adapter defaults.
 */
export type AdapterCapabilityOverrides = Pretty<Partial<AdapterCapabilities>>

/**
 * Runtime contract implemented by concrete database adapters.
 */
export interface DatabaseAdapter {
  /** Database dialect name exposed by the adapter. */
  dialect: string
  /** Feature flags describing the adapter's supported behaviors. */
  capabilities: AdapterCapabilities
  /** Compiles a data or migration operation into executable SQL statements. */
  compileSql(operation: DataManipulationOperation | DataMigrationOperation): SqlStatement[]
  /** Executes a data-manipulation request. */
  execute(request: DataManipulationRequest): Promise<DataManipulationResult>
  /** Executes a migration request. */
  migrate(request: DataMigrationRequest): Promise<DataMigrationResult>
  /** Checks whether a table exists. */
  hasTable(table: TableRef, transaction?: TransactionToken): Promise<boolean>
  /** Checks whether a column exists on a table. */
  hasColumn(table: TableRef, column: string, transaction?: TransactionToken): Promise<boolean>
  /** Starts a new database transaction. */
  beginTransaction(options?: TransactionOptions): Promise<TransactionToken>
  /** Commits an open transaction. */
  commitTransaction(token: TransactionToken): Promise<void>
  /** Rolls back an open transaction. */
  rollbackTransaction(token: TransactionToken): Promise<void>
  /** Creates a savepoint inside an open transaction. */
  createSavepoint(token: TransactionToken, name: string): Promise<void>
  /** Rolls back to a previously created savepoint. */
  rollbackToSavepoint(token: TransactionToken, name: string): Promise<void>
  /** Releases a previously created savepoint. */
  releaseSavepoint(token: TransactionToken, name: string): Promise<void>
  /** Acquires the adapter's migration lock when supported. */
  acquireMigrationLock?(): Promise<void>
  /** Releases the adapter's migration lock when supported. */
  releaseMigrationLock?(): Promise<void>
}
