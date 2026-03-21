import type { Predicate } from '../operators.ts'
import type { OrderByClause } from './ordering.ts'

/**
 * Validation lifecycle operations.
 */
export type TableValidationOperation = 'create' | 'update'

/**
 * Write lifecycle operations.
 */
export type TableWriteOperation = TableValidationOperation

/**
 * All lifecycle operations exposed by table hooks.
 */
export type TableLifecycleOperation = TableWriteOperation | 'delete' | 'read'

/**
 * Single validation issue reported by table hooks.
 */
export type ValidationIssue = {
  message: string
  path?: Array<string | number>
}

/**
 * Validation failure returned from table hooks.
 */
export type ValidationFailure = {
  issues: ReadonlyArray<ValidationIssue>
}

/**
 * Context passed to the `validate` hook.
 */
export type TableValidationContext<row extends Record<string, unknown>> = {
  operation: TableValidationOperation
  tableName: string
  value: Partial<row>
}

/**
 * Result returned from the `validate` hook.
 */
export type TableValidationResult<row extends Record<string, unknown>> =
  | { value: Partial<row> }
  | ValidationFailure

/**
 * Validation hook that runs before writes.
 */
export type TableValidate<row extends Record<string, unknown>> = (
  context: TableValidationContext<row>,
) => TableValidationResult<row>

/**
 * Context passed to the `beforeWrite` hook.
 */
export type TableBeforeWriteContext<row extends Record<string, unknown>> = {
  operation: TableWriteOperation
  tableName: string
  value: Partial<row>
}

/**
 * Result returned from the `beforeWrite` hook.
 */
export type TableBeforeWriteResult<row extends Record<string, unknown>> =
  | { value: Partial<row> }
  | ValidationFailure

/**
 * Hook invoked before a row write executes.
 */
export type TableBeforeWrite<row extends Record<string, unknown>> = (
  context: TableBeforeWriteContext<row>,
) => TableBeforeWriteResult<row>

/**
 * Context passed to the `afterWrite` hook.
 */
export type TableAfterWriteContext<row extends Record<string, unknown>> = {
  operation: TableWriteOperation
  tableName: string
  values: ReadonlyArray<Partial<row>>
  affectedRows: number
  insertId?: unknown
}

/**
 * Hook invoked after a row write completes.
 */
export type TableAfterWrite<row extends Record<string, unknown>> = (
  context: TableAfterWriteContext<row>,
) => void

/**
 * Context passed to the `beforeDelete` hook.
 */
export type TableBeforeDeleteContext = {
  tableName: string
  where: ReadonlyArray<Predicate<string>>
  orderBy: ReadonlyArray<OrderByClause>
  limit?: number
  offset?: number
}

/**
 * Result returned from the `beforeDelete` hook.
 */
export type TableBeforeDeleteResult = void | ValidationFailure

/**
 * Hook invoked before a delete operation executes.
 */
export type TableBeforeDelete = (context: TableBeforeDeleteContext) => TableBeforeDeleteResult

/**
 * Context passed to the `afterDelete` hook.
 */
export type TableAfterDeleteContext = {
  tableName: string
  where: ReadonlyArray<Predicate<string>>
  orderBy: ReadonlyArray<OrderByClause>
  limit?: number
  offset?: number
  affectedRows: number
}

/**
 * Hook invoked after a delete operation completes.
 */
export type TableAfterDelete = (context: TableAfterDeleteContext) => void

/**
 * Context passed to the `afterRead` hook.
 */
export type TableAfterReadContext<row extends Record<string, unknown>> = {
  tableName: string
  /**
   * The current row shape being returned. This may be a projection/partial row.
   */
  value: Partial<row>
}

/**
 * Result returned from the `afterRead` hook.
 */
export type TableAfterReadResult<row extends Record<string, unknown>> =
  | { value: Partial<row> }
  | ValidationFailure

/**
 * Hook invoked after a row is read.
 */
export type TableAfterRead<row extends Record<string, unknown>> = (
  context: TableAfterReadContext<row>,
) => TableAfterReadResult<row>
