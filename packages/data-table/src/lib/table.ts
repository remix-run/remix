/**
 * Symbol key used to store non-enumerable table metadata.
 */
export { columnMetadataKey, tableMetadataKey } from './references.ts'

export type { OrderByClause, OrderDirection } from './table/ordering.ts'
export type {
  TableAfterDelete,
  TableAfterDeleteContext,
  TableAfterRead,
  TableAfterReadContext,
  TableAfterReadResult,
  TableAfterWrite,
  TableAfterWriteContext,
  TableBeforeDelete,
  TableBeforeDeleteContext,
  TableBeforeDeleteResult,
  TableBeforeWrite,
  TableBeforeWriteContext,
  TableBeforeWriteResult,
  TableLifecycleOperation,
  TableValidate,
  TableValidationContext,
  TableValidationOperation,
  TableValidationResult,
  TableWriteOperation,
  ValidationFailure,
  ValidationIssue,
} from './table/lifecycle.ts'
export type {
  AnyColumn,
  AnyTable,
  ColumnReference,
  ColumnReferenceForQualifiedName,
  QualifiedTableColumnName,
  Table,
  TableColumnInput,
  TableColumnName,
  TableColumns,
  TableColumnsDefinition,
  TableName,
  TablePrimaryKey,
  TableReference,
  TableRow,
  TableRowWith,
  TableTimestamps,
  TimestampConfig,
  TimestampOptions,
} from './table/metadata.ts'
export type { CreateTableOptions } from './table/factory.ts'
export {
  getTableAfterDelete,
  getTableAfterRead,
  getTableAfterWrite,
  getTableBeforeDelete,
  getTableBeforeWrite,
  getTableColumnDefinitions,
  getTableColumns,
  getTableName,
  getTablePrimaryKey,
  getTableReference,
  getTableTimestamps,
  getTableValidator,
} from './table/metadata.ts'
export { table } from './table/factory.ts'
