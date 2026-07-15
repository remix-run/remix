import type {
  DataManipulationRequest,
  DataManipulationResult,
  DataManipulationOperation,
  DatabaseAdapter,
  SqlStatement,
  TableRef,
  TransactionOptions,
  TransactionToken,
} from '@remix-run/data-table'
import { getTablePrimaryKey } from '@remix-run/data-table'
import mysql from 'mysql2/promise'
import type {
  Connection as MysqlConnection,
  Pool as MysqlPool,
  PoolConnection as MysqlPoolConnection,
  PoolOptions as MysqlPoolOptions,
  ResultSetHeader,
  RowDataPacket,
} from 'mysql2/promise'

import { compileMysqlOperation } from './sql-compiler.ts'

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

type MysqlAdapterOptions = {
  characterSet?: string
  collation?: string
}

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

  #config?: string | MysqlPoolOptions
  #client: MysqlQueryable
  #characterSet?: string
  #collation?: string
  #transactions = new Map<string, TransactionState>()
  #transactionCounter = 0

  constructor(config: string | MysqlPoolOptions | MysqlQueryable, options: MysqlAdapterOptions = {}) {
    if (isMysqlQueryable(config)) {
      this.#client = config
    } else {
      this.#config = config
      this.#client = createMysqlPool(config)
    }

    this.#characterSet = options.characterSet
    this.#collation = options.collation
    this.capabilities = {
      returning: false,
      savepoints: true,
      upsert: true,
      transactionalDdl: false,
      migrationLock: true,
    }
  }

  /**
   * Compiles a data-manipulation operation to mysql SQL statements.
   * @param operation Operation to compile.
   * @returns Compiled SQL statements.
   */
  compileSql(operation: DataManipulationOperation): SqlStatement[] {
    let compiled = compileMysqlOperation(operation)
    return [{ text: compiled.text, values: compiled.values }]
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
   * Executes a multi-statement mysql SQL script.
   *
   * mysql2 only accepts multi-statement scripts when the underlying connection
   * was created with `multipleStatements: true`.
   * @param sql SQL script to execute.
   * @param transaction Optional transaction token.
   * @returns A promise that resolves once execution completes.
   */
  async executeScript(sql: string, transaction?: TransactionToken): Promise<void> {
    let client = this.#resolveClient(transaction)
    await client.query(sql)
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
  async create(): Promise<void> {
    let config = this.#configOrThrow('create')
    let database = resolveMysqlDatabaseName(config)
    let connection = await createMysqlConnection(toMysqlServerConfig(config))

    try {
      let sql = 'create database if not exists ' + quoteIdentifier(database)

      if (this.#characterSet) {
        sql += ' character set ' + this.#characterSet
      }

      if (this.#collation) {
        sql += ' collate ' + this.#collation
      }

      await connection.query(sql)
    } finally {
      await connection.end()
    }

    await this.#replacePool()
  }

  async drop(): Promise<void> {
    let config = this.#configOrThrow('drop')
    let database = resolveMysqlDatabaseName(config)
    await this.#closePool()
    let connection = await createMysqlConnection(toMysqlServerConfig(config))

    try {
      await connection.query('drop database if exists ' + quoteIdentifier(database))
    } finally {
      await connection.end()
    }
  }

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

  async #closePool(): Promise<void> {
    this.#transactions.clear()
    if (isMysqlPool(this.#client)) {
      await this.#client.end()
    }
  }

  async #replacePool(): Promise<void> {
    await this.#closePool().catch(() => undefined)

    if (this.#config) {
      this.#client = createMysqlPool(this.#config)
    }
  }

  #configOrThrow(method: string): string | MysqlPoolOptions {
    if (!this.#config) {
      throw new Error('MySQL adapter ' + method + '() requires config-based construction')
    }

    return this.#config
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
 * import { createDatabase } from 'remix/data-table'
 * import { createMysqlDatabaseAdapter } from 'remix/data-table/mysql'
 *
 * let adapter = createMysqlDatabaseAdapter(process.env.DATABASE_URL!)
 * let db = createDatabase(adapter)
 * ```
 */
export function createMysqlDatabaseAdapter(
  config: string | MysqlPoolOptions,
  options?: MysqlAdapterOptions,
): MysqlDatabaseAdapter {
  return new MysqlDatabaseAdapter(config, options)
}

function isMysqlQueryable(value: unknown): value is MysqlQueryable {
  return typeof value === 'object' && value !== null && 'query' in value
}

function createMysqlPool(config: string | MysqlPoolOptions): MysqlPool {
  return typeof config === 'string' ? mysql.createPool(config) : mysql.createPool(config)
}

function createMysqlConnection(config: string | MysqlPoolOptions): Promise<MysqlConnection> {
  return typeof config === 'string' ? mysql.createConnection(config) : mysql.createConnection(config)
}

function isMysqlPool(client: MysqlQueryable): client is MysqlPool {
  return 'getConnection' in client && typeof client.getConnection === 'function'
}

function resolveMysqlDatabaseName(config: string | MysqlPoolOptions): string {
  let database = typeof config === 'string' ? resolveDatabaseNameFromUrl(config) : config.database
  database ??= process.env.MYSQL_DATABASE

  if (!database) {
    throw new Error('MySQL database config requires a database name')
  }

  return database
}

function resolveDatabaseNameFromUrl(value: string): string | undefined {
  try {
    let url = new URL(value)
    let database = decodeURIComponent(url.pathname.replace(/^\//, ''))
    return database || undefined
  } catch {
    return undefined
  }
}

function toMysqlServerConfig(config: string | MysqlPoolOptions): string | MysqlPoolOptions {
  if (typeof config === 'string') {
    try {
      let url = new URL(config)
      url.pathname = '/'
      return url.toString()
    } catch {
      return config
    }
  }

  let { database: _database, ...serverConfig } = config
  return serverConfig
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

function quoteIdentifier(value: string): string {
  return '`' + value.replace(/`/g, '``') + '`'
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
