import type {
  PrimaryKeyInputForRow,
  ReturningInput,
  WriteResult,
  WriteRowResult,
  WriteRowsResult,
} from '../database.ts'

export type InsertQueryOptions<row extends Record<string, unknown>> = {
  returning?: ReturningInput<row>
  touch?: boolean
}

export type DeleteQueryOptions<row extends Record<string, unknown>> = {
  returning?: ReturningInput<row>
}

export type UpsertQueryOptions<row extends Record<string, unknown>> = {
  returning?: ReturningInput<row>
  touch?: boolean
  conflictTarget?: (keyof row & string)[]
  update?: Partial<row>
}

type QueryPlanMap<row extends Record<string, unknown>, primaryKey extends readonly string[]> = {
  all: { kind: 'all' }
  first: { kind: 'first' }
  find: {
    kind: 'find'
    value: PrimaryKeyInputForRow<row, primaryKey>
  }
  count: { kind: 'count' }
  exists: { kind: 'exists' }
  insert: {
    kind: 'insert'
    values: Partial<row>
    options?: InsertQueryOptions<row>
  }
  insertMany: {
    kind: 'insertMany'
    values: Partial<row>[]
    options?: InsertQueryOptions<row>
  }
  update: {
    kind: 'update'
    changes: Partial<row>
    options?: InsertQueryOptions<row>
  }
  delete: {
    kind: 'delete'
    options?: DeleteQueryOptions<row>
  }
  upsert: {
    kind: 'upsert'
    values: Partial<row>
    options?: UpsertQueryOptions<row>
  }
}

export type QueryExecutionMode = keyof QueryPlanMap<Record<string, unknown>, readonly string[]>

export type QueryPlan<
  row extends Record<string, unknown>,
  primaryKey extends readonly string[],
  mode extends QueryExecutionMode = QueryExecutionMode,
> = QueryPlanMap<row, primaryKey>[mode]

function clonePrimaryKeyValue(value: unknown): unknown {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return value
  }

  return { ...value }
}

export function cloneQueryPlan<
  row extends Record<string, unknown>,
  primaryKey extends readonly string[],
  mode extends QueryExecutionMode,
>(plan: QueryPlan<row, primaryKey, mode>): QueryPlan<row, primaryKey, mode> {
  switch (plan.kind) {
    case 'all':
      return { kind: 'all' } as QueryPlan<row, primaryKey, mode>
    case 'first':
      return { kind: 'first' } as QueryPlan<row, primaryKey, mode>
    case 'find':
      return {
        kind: 'find',
        value: clonePrimaryKeyValue(plan.value) as PrimaryKeyInputForRow<row, primaryKey>,
      } as QueryPlan<row, primaryKey, mode>
    case 'count':
      return { kind: 'count' } as QueryPlan<row, primaryKey, mode>
    case 'exists':
      return { kind: 'exists' } as QueryPlan<row, primaryKey, mode>
    case 'insert':
      return {
        kind: 'insert',
        values: { ...plan.values },
        options: plan.options ? { ...plan.options } : undefined,
      } as QueryPlan<row, primaryKey, mode>
    case 'insertMany':
      return {
        kind: 'insertMany',
        values: plan.values.map((value: Partial<row>) => ({ ...value })),
        options: plan.options ? { ...plan.options } : undefined,
      } as QueryPlan<row, primaryKey, mode>
    case 'update':
      return {
        kind: 'update',
        changes: { ...plan.changes },
        options: plan.options ? { ...plan.options } : undefined,
      } as QueryPlan<row, primaryKey, mode>
    case 'delete':
      return {
        kind: 'delete',
        options: plan.options ? { ...plan.options } : undefined,
      } as QueryPlan<row, primaryKey, mode>
    case 'upsert':
      return {
        kind: 'upsert',
        values: { ...plan.values },
        options: plan.options
          ? {
              ...plan.options,
              conflictTarget: plan.options.conflictTarget
                ? [...plan.options.conflictTarget]
                : undefined,
              update: plan.options.update ? { ...plan.options.update } : undefined,
          }
          : undefined,
      } as QueryPlan<row, primaryKey, mode>
  }
}
