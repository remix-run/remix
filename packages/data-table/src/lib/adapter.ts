import type { AnyTable, OrderByClause } from './table.ts'
import type { Predicate } from './operators.ts'
import type { SqlStatement } from './sql.ts'
import type { Pretty } from './types.ts'

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

export type TableRef = {
  name: string
  schema?: string
}

export type ForeignKeyAction = 'cascade' | 'restrict' | 'set null' | 'set default' | 'no action'

export type ColumnTypeName =
  | 'varchar'
  | 'text'
  | 'integer'
  | 'bigint'
  | 'decimal'
  | 'boolean'
  | 'uuid'
  | 'date'
  | 'time'
  | 'timestamp'
  | 'json'
  | 'binary'
  | 'enum'

export type ColumnDefault =
  | { kind: 'literal'; value: unknown }
  | { kind: 'now' }
  | { kind: 'sql'; expression: string }

export type ColumnComputed = {
  expression: string
  stored: boolean
}

export type IdentityOptions = {
  always?: boolean
  start?: number
  increment?: number
}

export type ColumnReference = {
  table: TableRef
  columns: string[]
  name: string
  onDelete?: ForeignKeyAction
  onUpdate?: ForeignKeyAction
}

export type ColumnCheck = {
  expression: string
  name: string
}

export type ColumnDefinition = {
  type: ColumnTypeName
  nullable?: boolean
  primaryKey?: boolean
  unique?: boolean | { name?: string }
  default?: ColumnDefault
  computed?: ColumnComputed
  references?: ColumnReference
  checks?: ColumnCheck[]
  comment?: string
  length?: number
  precision?: number
  scale?: number
  unsigned?: boolean
  withTimezone?: boolean
  enumValues?: string[]
  autoIncrement?: boolean
  identity?: IdentityOptions
  collate?: string
  charset?: string
}

export type PrimaryKeyConstraint = {
  columns: string[]
  name: string
}

export type UniqueConstraint = {
  columns: string[]
  name: string
}

export type CheckConstraint = {
  expression: string
  name: string
}

export type ForeignKeyConstraint = {
  columns: string[]
  references: {
    table: TableRef
    columns: string[]
  }
  name: string
  onDelete?: ForeignKeyAction
  onUpdate?: ForeignKeyAction
}

export type IndexMethod = 'btree' | 'hash' | 'gin' | 'gist' | 'fulltext' | (string & {})

export type IndexDefinition = {
  table: TableRef
  name: string
  columns: string[]
  unique?: boolean
  where?: string
  using?: IndexMethod
}

export type CreateTableOperation = {
  kind: 'createTable'
  table: TableRef
  ifNotExists?: boolean
  columns: Record<string, ColumnDefinition>
  primaryKey?: PrimaryKeyConstraint
  uniques?: UniqueConstraint[]
  checks?: CheckConstraint[]
  foreignKeys?: ForeignKeyConstraint[]
  comment?: string
}

export type AddColumnChange = {
  kind: 'addColumn'
  column: string
  definition: ColumnDefinition
}

export type ChangeColumnChange = {
  kind: 'changeColumn'
  column: string
  definition: ColumnDefinition
}

export type RenameColumnChange = {
  kind: 'renameColumn'
  from: string
  to: string
}

export type DropColumnChange = {
  kind: 'dropColumn'
  column: string
  ifExists?: boolean
}

export type AddPrimaryKeyChange = {
  kind: 'addPrimaryKey'
  constraint: PrimaryKeyConstraint
}

export type DropPrimaryKeyChange = {
  kind: 'dropPrimaryKey'
  name: string
}

export type AddUniqueChange = {
  kind: 'addUnique'
  constraint: UniqueConstraint
}

export type DropUniqueChange = {
  kind: 'dropUnique'
  name: string
}

export type AddForeignKeyChange = {
  kind: 'addForeignKey'
  constraint: ForeignKeyConstraint
}

export type DropForeignKeyChange = {
  kind: 'dropForeignKey'
  name: string
}

export type AddCheckChange = {
  kind: 'addCheck'
  constraint: CheckConstraint
}

export type DropCheckChange = {
  kind: 'dropCheck'
  name: string
}

export type SetTableCommentChange = {
  kind: 'setTableComment'
  comment: string
}

export type AlterTableChange =
  | AddColumnChange
  | ChangeColumnChange
  | RenameColumnChange
  | DropColumnChange
  | AddPrimaryKeyChange
  | DropPrimaryKeyChange
  | AddUniqueChange
  | DropUniqueChange
  | AddForeignKeyChange
  | DropForeignKeyChange
  | AddCheckChange
  | DropCheckChange
  | SetTableCommentChange

export type AlterTableOperation = {
  kind: 'alterTable'
  table: TableRef
  changes: AlterTableChange[]
  ifExists?: boolean
}

export type RenameTableOperation = {
  kind: 'renameTable'
  from: TableRef
  to: TableRef
}

export type DropTableOperation = {
  kind: 'dropTable'
  table: TableRef
  ifExists?: boolean
  cascade?: boolean
}

export type CreateIndexOperation = {
  kind: 'createIndex'
  index: IndexDefinition
  ifNotExists?: boolean
}

export type DropIndexOperation = {
  kind: 'dropIndex'
  table: TableRef
  name: string
  ifExists?: boolean
}

export type RenameIndexOperation = {
  kind: 'renameIndex'
  table: TableRef
  from: string
  to: string
}

export type AddForeignKeyOperation = {
  kind: 'addForeignKey'
  table: TableRef
  constraint: ForeignKeyConstraint
}

export type DropForeignKeyOperation = {
  kind: 'dropForeignKey'
  table: TableRef
  name: string
}

export type AddCheckOperation = {
  kind: 'addCheck'
  table: TableRef
  constraint: CheckConstraint
}

export type DropCheckOperation = {
  kind: 'dropCheck'
  table: TableRef
  name: string
}

export type DataMigrationOperation =
  | CreateTableOperation
  | AlterTableOperation
  | RenameTableOperation
  | DropTableOperation
  | CreateIndexOperation
  | DropIndexOperation
  | RenameIndexOperation
  | AddForeignKeyOperation
  | DropForeignKeyOperation
  | AddCheckOperation
  | DropCheckOperation
  | RawOperation

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
  dialect: string
  capabilities: AdapterCapabilities
  compileSql(operation: DataManipulationOperation | DataMigrationOperation): SqlStatement[]
  execute(request: DataManipulationRequest): Promise<DataManipulationResult>
  migrate(request: DataMigrationRequest): Promise<DataMigrationResult>
  hasTable(table: TableRef, transaction?: TransactionToken): Promise<boolean>
  hasColumn(table: TableRef, column: string, transaction?: TransactionToken): Promise<boolean>
  beginTransaction(options?: TransactionOptions): Promise<TransactionToken>
  commitTransaction(token: TransactionToken): Promise<void>
  rollbackTransaction(token: TransactionToken): Promise<void>
  createSavepoint(token: TransactionToken, name: string): Promise<void>
  rollbackToSavepoint(token: TransactionToken, name: string): Promise<void>
  releaseSavepoint(token: TransactionToken, name: string): Promise<void>
  acquireMigrationLock?(): Promise<void>
  releaseMigrationLock?(): Promise<void>
}
