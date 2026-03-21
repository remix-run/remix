import type { RawOperation } from './data-manipulation.ts'

/**
 * Qualified table reference used in migration operations.
 */
export type TableRef = {
  name: string
  schema?: string
}

/**
 * Referential actions supported by foreign key constraints.
 */
export type ForeignKeyAction = 'cascade' | 'restrict' | 'set null' | 'set default' | 'no action'

/**
 * Logical column type names used by schema definitions.
 */
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

/**
 * Default value definition for a column.
 */
export type ColumnDefault =
  | { kind: 'literal'; value: unknown }
  | { kind: 'now' }
  | { kind: 'sql'; expression: string }

/**
 * Definition for a computed or generated column.
 */
export type ColumnComputed = {
  expression: string
  stored: boolean
}

/** Options for configuring identity column generation. */
export type IdentityOptions = {
  always?: boolean
  start?: number
  increment?: number
}

/** Foreign-key reference metadata declared on a column. */
export type ColumnReference = {
  table: TableRef
  columns: string[]
  name: string
  onDelete?: ForeignKeyAction
  onUpdate?: ForeignKeyAction
}

/**
 * Check constraint declared on a column definition.
 */
export type ColumnCheck = {
  expression: string
  name: string
}

/**
 * Normalized column definition used in schema operations.
 */
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

/**
 * Primary key constraint definition.
 */
export type PrimaryKeyConstraint = {
  columns: string[]
  name: string
}

/**
 * Unique constraint definition.
 */
export type UniqueConstraint = {
  columns: string[]
  name: string
}

/**
 * Check constraint definition.
 */
export type CheckConstraint = {
  expression: string
  name: string
}

/**
 * Foreign key constraint definition.
 */
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

/**
 * Index method used when creating an index.
 */
export type IndexMethod = 'btree' | 'hash' | 'gin' | 'gist' | 'fulltext' | (string & {})

/**
 * Index definition used in schema operations.
 */
export type IndexDefinition = {
  table: TableRef
  name: string
  columns: string[]
  unique?: boolean
  where?: string
  using?: IndexMethod
}

/**
 * Operation that creates a new table.
 */
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

/**
 * Alter-table change that adds a column.
 */
export type AddColumnChange = {
  kind: 'addColumn'
  column: string
  definition: ColumnDefinition
}

/**
 * Alter-table change that replaces a column definition.
 */
export type ChangeColumnChange = {
  kind: 'changeColumn'
  column: string
  definition: ColumnDefinition
}

/**
 * Alter-table change that renames a column.
 */
export type RenameColumnChange = {
  kind: 'renameColumn'
  from: string
  to: string
}

/**
 * Alter-table change that drops a column.
 */
export type DropColumnChange = {
  kind: 'dropColumn'
  column: string
  ifExists?: boolean
}

/**
 * Alter-table change that adds a primary key.
 */
export type AddPrimaryKeyChange = {
  kind: 'addPrimaryKey'
  constraint: PrimaryKeyConstraint
}

/**
 * Alter-table change that drops a primary key.
 */
export type DropPrimaryKeyChange = {
  kind: 'dropPrimaryKey'
  name: string
}

/**
 * Alter-table change that adds a unique constraint.
 */
export type AddUniqueChange = {
  kind: 'addUnique'
  constraint: UniqueConstraint
}

/**
 * Alter-table change that drops a unique constraint.
 */
export type DropUniqueChange = {
  kind: 'dropUnique'
  name: string
}

/**
 * Alter-table change that adds a foreign key constraint.
 */
export type AddForeignKeyChange = {
  kind: 'addForeignKey'
  constraint: ForeignKeyConstraint
}

/**
 * Alter-table change that drops a foreign key constraint.
 */
export type DropForeignKeyChange = {
  kind: 'dropForeignKey'
  name: string
}

/**
 * Alter-table change that adds a check constraint.
 */
export type AddCheckChange = {
  kind: 'addCheck'
  constraint: CheckConstraint
}

/**
 * Alter-table change that drops a check constraint.
 */
export type DropCheckChange = {
  kind: 'dropCheck'
  name: string
}

/**
 * Alter-table change that updates a table comment.
 */
export type SetTableCommentChange = {
  kind: 'setTableComment'
  comment: string
}

/**
 * Union of supported `alterTable` changes.
 */
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

/**
 * Operation that applies one or more table changes.
 */
export type AlterTableOperation = {
  kind: 'alterTable'
  table: TableRef
  changes: AlterTableChange[]
  ifExists?: boolean
}

/**
 * Operation that renames a table.
 */
export type RenameTableOperation = {
  kind: 'renameTable'
  from: TableRef
  to: TableRef
}

/**
 * Operation that drops a table.
 */
export type DropTableOperation = {
  kind: 'dropTable'
  table: TableRef
  ifExists?: boolean
  cascade?: boolean
}

/**
 * Operation that creates an index.
 */
export type CreateIndexOperation = {
  kind: 'createIndex'
  index: IndexDefinition
  ifNotExists?: boolean
}

/**
 * Operation that drops an index.
 */
export type DropIndexOperation = {
  kind: 'dropIndex'
  table: TableRef
  name: string
  ifExists?: boolean
}

/**
 * Operation that renames an index.
 */
export type RenameIndexOperation = {
  kind: 'renameIndex'
  table: TableRef
  from: string
  to: string
}

/**
 * Operation that adds a table-level foreign key.
 */
export type AddForeignKeyOperation = {
  kind: 'addForeignKey'
  table: TableRef
  constraint: ForeignKeyConstraint
}

/**
 * Operation that drops a table-level foreign key.
 */
export type DropForeignKeyOperation = {
  kind: 'dropForeignKey'
  table: TableRef
  name: string
}

/**
 * Operation that adds a table-level check constraint.
 */
export type AddCheckOperation = {
  kind: 'addCheck'
  table: TableRef
  constraint: CheckConstraint
}

/**
 * Operation that drops a table-level check constraint.
 */
export type DropCheckOperation = {
  kind: 'dropCheck'
  table: TableRef
  name: string
}

/**
 * Union of schema and migration operations understood by adapters.
 */
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
