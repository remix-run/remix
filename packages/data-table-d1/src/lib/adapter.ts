import type {
  DataManipulationOperation,
  DataManipulationRequest,
  DataManipulationResult,
  DatabaseAdapter,
  SqlStatement,
  TableRef,
  TransactionOptions,
  TransactionToken,
} from '@remix-run/data-table'

export type D1Value = ArrayBuffer | number | string | null

/**
 * `DatabaseAdapter` implementation for Cloudflare D1 database bindings.
 */
export class D1DatabaseAdapter implements DatabaseAdapter {
  /**
   * The SQL dialect identifier reported by this adapter.
   */
  dialect = 'd1'

  /**
   * Feature flags describing the D1 behaviors supported by this adapter.
   */
  capabilities

  #database: D1Database

  constructor(database: D1Database) {
    this.#database = database
    this.capabilities = {
      returning: true,
      savepoints: false,
      upsert: true,
      transactionalDdl: false,
      migrationLock: false,
    }
  }

  compileSql(_operation: DataManipulationOperation): SqlStatement[] {
    throw new Error('D1DatabaseAdapter compileSql() is not implemented yet')
  }

  async execute(_request: DataManipulationRequest): Promise<DataManipulationResult> {
    throw new Error('D1DatabaseAdapter execute() is not implemented yet')
  }

  async executeScript(_sql: string, _transaction?: TransactionToken): Promise<void> {
    throw new Error('D1DatabaseAdapter executeScript() is not implemented yet')
  }

  async hasTable(_table: TableRef, _transaction?: TransactionToken): Promise<boolean> {
    throw new Error('D1DatabaseAdapter hasTable() is not implemented yet')
  }

  async hasColumn(
    _table: TableRef,
    _column: string,
    _transaction?: TransactionToken,
  ): Promise<boolean> {
    throw new Error('D1DatabaseAdapter hasColumn() is not implemented yet')
  }

  async beginTransaction(_options?: TransactionOptions): Promise<TransactionToken> {
    throw new Error('D1DatabaseAdapter does not support data-table interactive transactions')
  }

  async commitTransaction(token: TransactionToken): Promise<void> {
    throw new Error('Unknown transaction token: ' + token.id)
  }

  async rollbackTransaction(token: TransactionToken): Promise<void> {
    throw new Error('Unknown transaction token: ' + token.id)
  }

  async createSavepoint(token: TransactionToken, _name: string): Promise<void> {
    throw new Error('Unknown transaction token: ' + token.id)
  }

  async rollbackToSavepoint(token: TransactionToken, _name: string): Promise<void> {
    throw new Error('Unknown transaction token: ' + token.id)
  }

  async releaseSavepoint(token: TransactionToken, _name: string): Promise<void> {
    throw new Error('Unknown transaction token: ' + token.id)
  }
}

/**
 * Creates a Cloudflare D1 `DatabaseAdapter`.
 * @param database Cloudflare D1 database binding.
 * @returns A configured D1 adapter.
 * @example
 * ```ts
 * import { createDatabase } from 'remix/data-table'
 * import { createD1DatabaseAdapter } from 'remix/data-table/d1'
 *
 * let db = createDatabase(createD1DatabaseAdapter(env.DB))
 * ```
 */
export function createD1DatabaseAdapter(database: D1Database): D1DatabaseAdapter {
  return new D1DatabaseAdapter(database)
}
