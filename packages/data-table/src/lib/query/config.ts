import type { JoinClause, SelectColumn } from '../adapter.ts'
import type { PrimaryKeyInputForRow, ReturningInput } from '../database.ts'
import type { Predicate } from '../operators.ts'
import type { AnyRelation } from '../table-relations.ts'
import type { OrderByClause } from '../table.ts'

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

export type QueryConfigState = {
  select: '*' | SelectColumn[]
  distinct: boolean
  joins: JoinClause[]
  where: Predicate<string>[]
  groupBy: string[]
  having: Predicate<string>[]
  orderBy: OrderByClause[]
  limit?: number
  offset?: number
  with: Record<string, AnyRelation>
}

type QueryConfigMap<
  row extends Record<string, unknown>,
  primaryKey extends readonly string[],
> = {
  all: {
    kind: 'all'
  }
  first: {
    kind: 'first'
  }
  find: {
    kind: 'find'
    value: PrimaryKeyInputForRow<row, primaryKey>
  }
  count: {
    kind: 'count'
  }
  exists: {
    kind: 'exists'
  }
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

export type QueryExecutionMode = keyof QueryConfigMap<Record<string, unknown>, readonly string[]>

type QueryConfigAction<
  row extends Record<string, unknown>,
  primaryKey extends readonly string[],
  mode extends QueryExecutionMode,
> = QueryConfigMap<row, primaryKey>[mode]

export type QueryConfig<
  row extends Record<string, unknown>,
  primaryKey extends readonly string[],
  mode extends QueryExecutionMode = QueryExecutionMode,
> = QueryConfigState & QueryConfigAction<row, primaryKey, mode>

export type QueryConfigPatch = Partial<QueryConfigState>

export function createInitialQueryConfig<
  row extends Record<string, unknown>,
  primaryKey extends readonly string[],
>(): QueryConfig<row, primaryKey, 'all'> {
  return {
    kind: 'all',
    select: '*',
    distinct: false,
    joins: [],
    where: [],
    groupBy: [],
    having: [],
    orderBy: [],
    with: {},
  }
}

export function mergeQueryConfig<
  row extends Record<string, unknown>,
  primaryKey extends readonly string[],
  mode extends QueryExecutionMode,
>(
  config: QueryConfig<row, primaryKey, mode>,
  patch: QueryConfigPatch,
): QueryConfig<row, primaryKey, mode> {
  let next = cloneQueryConfig(config)

  if (patch.select !== undefined) {
    next.select = cloneSelection(patch.select)
  }

  if (patch.distinct !== undefined) {
    next.distinct = patch.distinct
  }

  if (patch.joins !== undefined) {
    next.joins = [...patch.joins]
  }

  if (patch.where !== undefined) {
    next.where = [...patch.where]
  }

  if (patch.groupBy !== undefined) {
    next.groupBy = [...patch.groupBy]
  }

  if (patch.having !== undefined) {
    next.having = [...patch.having]
  }

  if (patch.orderBy !== undefined) {
    next.orderBy = [...patch.orderBy]
  }

  if ('limit' in patch) {
    next.limit = patch.limit
  }

  if ('offset' in patch) {
    next.offset = patch.offset
  }

  if (patch.with !== undefined) {
    next.with = { ...patch.with }
  }

  return next
}

export function cloneQueryConfig<
  row extends Record<string, unknown>,
  primaryKey extends readonly string[],
  mode extends QueryExecutionMode,
>(config: QueryConfig<row, primaryKey, mode>): QueryConfig<row, primaryKey, mode> {
  let state = cloneQueryConfigState(config)
  let cloned: QueryConfig<row, primaryKey>

  switch (config.kind) {
    case 'all':
      cloned = { ...state, kind: 'all' }
      break
    case 'first':
      cloned = { ...state, kind: 'first' }
      break
    case 'find':
      cloned = {
        ...state,
        kind: 'find',
        value: clonePrimaryKeyValue(config.value) as PrimaryKeyInputForRow<row, primaryKey>,
      }
      break
    case 'count':
      cloned = { ...state, kind: 'count' }
      break
    case 'exists':
      cloned = { ...state, kind: 'exists' }
      break
    case 'insert':
      cloned = {
        ...state,
        kind: 'insert',
        values: { ...config.values },
        options: config.options ? { ...config.options } : undefined,
      }
      break
    case 'insertMany':
      cloned = {
        ...state,
        kind: 'insertMany',
        values: config.values.map((value) => ({ ...value })),
        options: config.options ? { ...config.options } : undefined,
      }
      break
    case 'update':
      cloned = {
        ...state,
        kind: 'update',
        changes: { ...config.changes },
        options: config.options ? { ...config.options } : undefined,
      }
      break
    case 'delete':
      cloned = {
        ...state,
        kind: 'delete',
        options: config.options ? { ...config.options } : undefined,
      }
      break
    case 'upsert':
      cloned = {
        ...state,
        kind: 'upsert',
        values: { ...config.values },
        options: config.options
          ? {
              ...config.options,
              conflictTarget: config.options.conflictTarget
                ? [...config.options.conflictTarget]
                : undefined,
              update: config.options.update ? { ...config.options.update } : undefined,
            }
          : undefined,
      }
      break
  }

  return cloned as QueryConfig<row, primaryKey, mode>
}

function cloneQueryConfigState(state: QueryConfigState): QueryConfigState {
  return {
    select: cloneSelection(state.select),
    distinct: state.distinct,
    joins: [...state.joins],
    where: [...state.where],
    groupBy: [...state.groupBy],
    having: [...state.having],
    orderBy: [...state.orderBy],
    limit: state.limit,
    offset: state.offset,
    with: { ...state.with },
  }
}

function cloneSelection(selection: '*' | SelectColumn[]): '*' | SelectColumn[] {
  if (selection === '*') {
    return '*'
  }

  return selection.map((column) => ({ ...column }))
}

function clonePrimaryKeyValue(value: unknown): unknown {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return value
  }

  return { ...value }
}
