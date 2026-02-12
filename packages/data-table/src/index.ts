export type {
  AdapterCapabilities,
  AdapterExecuteRequest,
  AdapterResult,
  AdapterStatement,
  DatabaseAdapter,
  TransactionOptions,
  TransactionToken,
} from './lib/adapter.ts'

export {
  DataTableAdapterError,
  DataTableConstraintError,
  DataTableError,
  DataTableQueryError,
  DataTableValidationError,
} from './lib/errors.ts'

export type {
  AnyRelation,
  AnyTable,
  BelongsToOptions,
  ColumnSchemas,
  DataSchema,
  HasManyOptions,
  HasManyThroughOptions,
  HasOneOptions,
  KeySelector,
  OrderByClause,
  OrderDirection,
  PrimaryKeyInput,
  Relation,
  RelationCardinality,
  RelationKind,
  RelationMapForTable,
  Table,
  TableRow,
  TimestampConfig,
  TimestampOptions,
} from './lib/table.ts'
export { createTable, timestampSchema, timestamps } from './lib/table.ts'

export type { Predicate, WhereInput, WhereObject } from './lib/operators.ts'
export {
  and,
  between,
  eq,
  gt,
  gte,
  ilike,
  inList,
  isNull,
  like,
  lt,
  lte,
  ne,
  notInList,
  notNull,
  or,
} from './lib/operators.ts'

export type { SqlStatement } from './lib/sql.ts'
export { rawSql, sql } from './lib/sql.ts'

export type { Database, WriteResult, WriteRowResult, WriteRowsResult } from './lib/database.ts'
export { createDatabase, QueryBuilder } from './lib/database.ts'

export type { MemoryAdapterOptions, MemoryDatabaseSeed } from './lib/memory-adapter.ts'
export { createMemoryDatabaseAdapter, MemoryDatabaseAdapter } from './lib/memory-adapter.ts'
