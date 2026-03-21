import type {
  AdapterCapabilityOverrides,
  DataMigrationResult,
  DataMigrationOperation,
  DataManipulationResult,
  DataManipulationOperation,
  DatabaseAdapter,
  ColumnDefinition,
  DataManipulationRequest,
  DataMigrationRequest,
  SqlStatement,
  TableRef,
  TransactionOptions,
  TransactionToken,
} from '@remix-run/data-table/adapter'
import { getTablePrimaryKey } from '@remix-run/data-table/adapter'
import type {
  Connection as MysqlConnection,
  Pool as MysqlPool,
  PoolConnection as MysqlPoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from 'mysql2/promise'

import { compileMysqlMigrationOperations as compileMysqlMigrationOperationsFromCompiler } from './migration-compiler.ts'
import { compileMysqlOperation } from './sql-compiler.ts'
import { quoteIdentifier } from './sql-compiler-helpers.ts'

/**
 * Mysql adapter configuration.
 */
export type MysqlDatabaseAdapterOptions = {
  capabilities?: AdapterCapabilityOverrides
}

type TransactionState = {
  connection: MysqlTransactionConnection
  releaseOnClose: boolean
}

type MysqlQueryRows = RowDataPacket[]
type MysqlQueryResultHeader = {
  affectedRows: number
  insertId: unknown
}
type MysqlTransactionConnection = MysqlConnection | MysqlPoolConnection
type MysqlQueryable = MysqlPool | MysqlTransactionConnection

/**
 * `DatabaseAdapter` implementation for mysql-compatible clients.
 */
export class MysqlDatabaseAdapter implements DatabaseAdapter {
  /**
   * The SQL dialect identifier reported by this adapter.
   */
  dialect = 'mysql'

  /**
   * Feature flags describing the mysql behaviors supported by this adapter.
   */
  capabilities

  #client: MysqlQueryable
  #transactions = new Map<string, TransactionState>()
  #transactionCounter = 0

  constructor(client: MysqlQueryable, options?: MysqlDatabaseAdapterOptions) {
    this.#client = client
    this.capabilities = {
      returning: options?.capabilities?.returning ?? false,
      savepoints: options?.capabilities?.savepoints ?? true,
      upsert: options?.capabilities?.upsert ?? true,
      transactionalDdl: options?.capabilities?.transactionalDdl ?? false,
      migrationLock: options?.capabilities?.migrationLock ?? true,
    }
  }

  /**
   * Compiles a data or migration operation to mysql SQL statements.
   * @param operation Operation to compile.
   * @returns Compiled SQL statements.
   */
  compileSql(operation: DataManipulationOperation | DataMigrationOperation): SqlStatement[] {
    if (isDataManipulationOperation(operation)) {
      let compiled = compileMysqlOperation(operation)
      return [{ text: compiled.text, values: compiled.values }]
    }

    return compileMysqlMigrationOperationsFromCompiler(operation)
  }

  /**
   * Executes a mysql data-manipulation request.
   * @param request Request to execute.
   * @returns Execution result.
   */
  async execute(request: DataManipulationRequest): Promise<DataManipulationResult> {
    if (request.operation.kind === 'insertMany' && request.operation.values.length === 0) {
      return {
        affectedRows: 0,
        insertId: undefined,
        rows: request.operation.returning ? [] : undefined,
      }
    }

    let statements = this.compileSql(request.operation)
    let statement = statements[0]
    let client = this.#resolveClient(request.transaction)
    let [result] = await client.query(statement.text, statement.values)

    if (isRowsResult(result)) {
      let rows = normalizeRows(result)

      if (request.operation.kind === 'count' || request.operation.kind === 'exists') {
        rows = normalizeCountRows(rows)
      }

      return { rows }
    }

    let header = normalizeHeader(result)

    return {
      affectedRows: header.affectedRows,
      insertId: normalizeInsertId(request.operation.kind, request.operation, header),
    }
  }

  /**
   * Executes mysql migration operations.
   * @param request Migration request to execute.
   * @returns Migration result.
   */
  async migrate(request: DataMigrationRequest): Promise<DataMigrationResult> {
    let statements = this.compileSql(request.operation)
    let client = this.#resolveClient(request.transaction)

    for (let statement of statements) {
      await client.query(statement.text, statement.values)
    }

    return {
      affectedOperations: statements.length,
    }
  }

  /**
   * Checks whether a table exists in mysql.
   * @param table Table reference to inspect.
   * @param transaction Optional transaction token.
   * @returns `true` when the table exists.
   */
  async hasTable(table: TableRef, transaction?: TransactionToken): Promise<boolean> {
    let schema = table.schema
    let sql = schema
      ? 'select exists(select 1 from information_schema.tables where table_schema = ? and table_name = ?) as `exists`'
      : 'select exists(select 1 from information_schema.tables where table_schema = database() and table_name = ?) as `exists`'
    let values = schema ? [schema, table.name] : [table.name]
    let client = this.#resolveClient(transaction)
    let [result] = await client.query(sql, values)

    if (!isRowsResult(result)) {
      return false
    }

    return toBooleanExists(result[0]?.exists)
  }

  /**
   * Checks whether a column exists in mysql.
   * @param table Table reference to inspect.
   * @param column Column name to look up.
   * @param transaction Optional transaction token.
   * @returns `true` when the column exists.
   */
  async hasColumn(
    table: TableRef,
    column: string,
    transaction?: TransactionToken,
  ): Promise<boolean> {
    let schema = table.schema
    let sql = schema
      ? 'select exists(select 1 from information_schema.columns where table_schema = ? and table_name = ? and column_name = ?) as `exists`'
      : 'select exists(select 1 from information_schema.columns where table_schema = database() and table_name = ? and column_name = ?) as `exists`'
    let values = schema ? [schema, table.name, column] : [table.name, column]
    let client = this.#resolveClient(transaction)
    let [result] = await client.query(sql, values)

    if (!isRowsResult(result)) {
      return false
    }

    return toBooleanExists(result[0]?.exists)
  }

  /**
   * Starts a mysql transaction.
   * @param options Transaction options.
   * @returns Transaction token.
   */
  async beginTransaction(options?: TransactionOptions): Promise<TransactionToken> {
    let releaseOnClose = false
    let connection: MysqlTransactionConnection

    if (isMysqlPool(this.#client)) {
      connection = await this.#client.getConnection()
      releaseOnClose = true
    } else {
      connection = this.#client
    }

    if (options?.isolationLevel) {
      await connection.query('set transaction isolation level ' + options.isolationLevel)
    }

    if (options?.readOnly !== undefined) {
      await connection.query(
        options.readOnly ? 'set transaction read only' : 'set transaction read write',
      )
    }

    await connection.beginTransaction()

    this.#transactionCounter += 1
    let token = { id: 'tx_' + String(this.#transactionCounter) }

    this.#transactions.set(token.id, {
      connection,
      releaseOnClose,
    })

    return token
  }

  /**
   * Commits an open mysql transaction.
   * @param token Transaction token to commit.
   * @returns A promise that resolves when the transaction is committed.
   */
  async commitTransaction(token: TransactionToken): Promise<void> {
    let transaction = this.#transactions.get(token.id)

    if (!transaction) {
      throw new Error('Unknown transaction token: ' + token.id)
    }

    try {
      await transaction.connection.commit()
    } finally {
      this.#transactions.delete(token.id)

      if (transaction.releaseOnClose && isMysqlPoolConnection(transaction.connection)) {
        transaction.connection.release()
      }
    }
  }

  /**
   * Rolls back an open mysql transaction.
   * @param token Transaction token to roll back.
   * @returns A promise that resolves when the transaction is rolled back.
   */
  async rollbackTransaction(token: TransactionToken): Promise<void> {
    let transaction = this.#transactions.get(token.id)

    if (!transaction) {
      throw new Error('Unknown transaction token: ' + token.id)
    }

    try {
      await transaction.connection.rollback()
    } finally {
      this.#transactions.delete(token.id)

      if (transaction.releaseOnClose && isMysqlPoolConnection(transaction.connection)) {
        transaction.connection.release()
      }
    }
  }

  /**
   * Creates a savepoint in an open mysql transaction.
   * @param token Transaction token to use.
   * @param name Savepoint name.
   * @returns A promise that resolves when the savepoint is created.
   */
  async createSavepoint(token: TransactionToken, name: string): Promise<void> {
    let connection = this.#transactionConnection(token)
    await connection.query('savepoint ' + quoteIdentifier(name))
  }

  /**
   * Rolls back to a savepoint in an open mysql transaction.
   * @param token Transaction token to use.
   * @param name Savepoint name.
   * @returns A promise that resolves when the rollback completes.
   */
  async rollbackToSavepoint(token: TransactionToken, name: string): Promise<void> {
    let connection = this.#transactionConnection(token)
    await connection.query('rollback to savepoint ' + quoteIdentifier(name))
  }

  /**
   * Releases a savepoint in an open mysql transaction.
   * @param token Transaction token to use.
   * @param name Savepoint name.
   * @returns A promise that resolves when the savepoint is released.
   */
  async releaseSavepoint(token: TransactionToken, name: string): Promise<void> {
    let connection = this.#transactionConnection(token)
    await connection.query('release savepoint ' + quoteIdentifier(name))
  }

  /**
   * Acquires the mysql migration lock.
   * @returns A promise that resolves when the lock is acquired.
   */
  async acquireMigrationLock(): Promise<void> {
    await this.#client.query('select get_lock(?, 60)', ['data_table_migrations'])
  }

  /**
   * Releases the mysql migration lock.
   * @returns A promise that resolves when the lock is released.
   */
  async releaseMigrationLock(): Promise<void> {
    await this.#client.query('select release_lock(?)', ['data_table_migrations'])
  }

  #resolveClient(token: TransactionToken | undefined): MysqlQueryable {
    if (!token) {
      return this.#client
    }

    return this.#transactionConnection(token)
  }

  #transactionConnection(token: TransactionToken): MysqlTransactionConnection {
    let transaction = this.#transactions.get(token.id)

    if (!transaction) {
      throw new Error('Unknown transaction token: ' + token.id)
    }

    return transaction.connection
  }
}

/**
 * Creates a mysql `DatabaseAdapter`.
 * @param client Mysql pool or connection.
 * @param options Optional adapter capability overrides.
 * @returns A configured mysql adapter.
 * @example
 * ```ts
 * import { createPool } from 'mysql2/promise'
 * import { createDatabase } from 'remix/data-table'
 * import { createMysqlDatabaseAdapter } from 'remix/data-table-mysql'
 *
 * let pool = createPool({ uri: process.env.DATABASE_URL })
 * let adapter = createMysqlDatabaseAdapter(pool)
 * let db = createDatabase(adapter)
 * ```
 */
export function createMysqlDatabaseAdapter(
  client: MysqlQueryable,
  options?: MysqlDatabaseAdapterOptions,
): MysqlDatabaseAdapter {
  return new MysqlDatabaseAdapter(client, options)
}

function isMysqlPool(client: MysqlQueryable): client is MysqlPool {
  return 'getConnection' in client && typeof client.getConnection === 'function'
}

function isMysqlPoolConnection(
  connection: MysqlTransactionConnection,
): connection is MysqlPoolConnection {
  return 'release' in connection && typeof connection.release === 'function'
}

function isRowsResult(result: unknown): result is MysqlQueryRows {
  return Array.isArray(result) && (result.length === 0 || !Array.isArray(result[0]))
}

function toBooleanExists(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'number') {
    return value > 0
  }

  if (typeof value === 'bigint') {
    return value > 0n
  }

  if (typeof value === 'string') {
    return value === '1' || value.toLowerCase() === 'true'
  }

  return false
}

function normalizeRows(rows: MysqlQueryRows): Record<string, unknown>[] {
  return rows.map((row) => ({ ...row }))
}

function normalizeHeader(result: unknown): MysqlQueryResultHeader {
  if (typeof result === 'object' && result !== null) {
    let header = result as Partial<ResultSetHeader>

    return {
      affectedRows: typeof header.affectedRows === 'number' ? header.affectedRows : 0,
      insertId: header.insertId,
    }
  }

  return {
    affectedRows: 0,
    insertId: undefined,
  }
}

function normalizeCountRows(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.map((row) => {
    let count = row.count

    if (typeof count === 'string') {
      let numeric = Number(count)

      if (!Number.isNaN(numeric)) {
        return {
          ...row,
          count: numeric,
        }
      }
    }

    if (typeof count === 'bigint') {
      return {
        ...row,
        count: Number(count),
      }
    }

    return row
  })
}

function normalizeInsertId(
  kind: DataManipulationRequest['operation']['kind'],
  operation: DataManipulationRequest['operation'],
  header: MysqlQueryResultHeader,
): unknown {
  if (!isInsertOperationKind(kind) || !isInsertOperation(operation)) {
    return undefined
  }

  if (getTablePrimaryKey(operation.table).length !== 1) {
    return undefined
  }

  return header.insertId
}

function isInsertOperationKind(kind: DataManipulationRequest['operation']['kind']): boolean {
  return kind === 'insert' || kind === 'insertMany' || kind === 'upsert'
}

function isInsertOperation(
  operation: DataManipulationRequest['operation'],
): operation is Extract<
  DataManipulationRequest['operation'],
  { kind: 'insert' | 'insertMany' | 'upsert' }
> {
  return (
    operation.kind === 'insert' || operation.kind === 'insertMany' || operation.kind === 'upsert'
  )
}

function isDataManipulationOperation(
  operation: DataManipulationOperation | DataMigrationOperation,
): operation is DataManipulationOperation {
  return (
    operation.kind === 'select' ||
    operation.kind === 'count' ||
    operation.kind === 'exists' ||
    operation.kind === 'insert' ||
    operation.kind === 'insertMany' ||
    operation.kind === 'update' ||
    operation.kind === 'delete' ||
    operation.kind === 'upsert' ||
    operation.kind === 'raw'
  )
}
