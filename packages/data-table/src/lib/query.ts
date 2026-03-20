import type { JoinClause, JoinType, SelectColumn } from './adapter.ts'
import { DataTableQueryError, DataTableValidationError } from './errors.ts'
import type {
  MergeColumnTypeMaps,
  PrimaryKeyInputForRow,
  QueryColumnInput,
  QueryColumnName,
  QueryColumnTypeMap,
  QueryColumnTypeMapFromRow,
  QueryColumns,
  QueryTableInput,
  RelationMapForSourceName,
  ReturningInput,
  SelectedAliasRow,
  WriteResult,
  WriteRowResult,
  WriteRowsResult,
} from './database.ts'
import type { Predicate, WhereInput } from './operators.ts'
import { normalizeWhereInput } from './operators.ts'
import { normalizeColumnInput } from './references.ts'
import type { AnyRelation, AnyTable, LoadedRelationMap, OrderByClause } from './table.ts'
import { getTableColumns, getTableName } from './table.ts'

type QueryBindingState = 'bound' | 'unbound'

type QueryExecutionMode =
  | 'all'
  | 'first'
  | 'find'
  | 'count'
  | 'exists'
  | 'insert'
  | 'insertMany'
  | 'update'
  | 'delete'
  | 'upsert'

type InsertQueryOptions<row extends Record<string, unknown>> = {
  returning?: ReturningInput<row>
  touch?: boolean
}

type DeleteQueryOptions<row extends Record<string, unknown>> = {
  returning?: ReturningInput<row>
}

type UpsertQueryOptions<row extends Record<string, unknown>> = {
  returning?: ReturningInput<row>
  touch?: boolean
  conflictTarget?: (keyof row & string)[]
  update?: Partial<row>
}

export type QueryState = {
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

type QueryPlanAll = {
  kind: 'all'
}

type QueryPlanFirst = {
  kind: 'first'
}

type QueryPlanFind<row extends Record<string, unknown>, primaryKey extends readonly string[]> = {
  kind: 'find'
  value: PrimaryKeyInputForRow<row, primaryKey>
}

type QueryPlanCount = {
  kind: 'count'
}

type QueryPlanExists = {
  kind: 'exists'
}

type QueryPlanInsert<row extends Record<string, unknown>> = {
  kind: 'insert'
  values: Partial<row>
  options?: InsertQueryOptions<row>
}

type QueryPlanInsertMany<row extends Record<string, unknown>> = {
  kind: 'insertMany'
  values: Partial<row>[]
  options?: InsertQueryOptions<row>
}

type QueryPlanUpdate<row extends Record<string, unknown>> = {
  kind: 'update'
  changes: Partial<row>
  options?: InsertQueryOptions<row>
}

type QueryPlanDelete<row extends Record<string, unknown>> = {
  kind: 'delete'
  options?: DeleteQueryOptions<row>
}

type QueryPlanUpsert<row extends Record<string, unknown>> = {
  kind: 'upsert'
  values: Partial<row>
  options?: UpsertQueryOptions<row>
}

type AnyQueryPlan<row extends Record<string, unknown>, primaryKey extends readonly string[]> =
  | QueryPlanAll
  | QueryPlanFirst
  | QueryPlanFind<row, primaryKey>
  | QueryPlanCount
  | QueryPlanExists
  | QueryPlanInsert<row>
  | QueryPlanInsertMany<row>
  | QueryPlanUpdate<row>
  | QueryPlanDelete<row>
  | QueryPlanUpsert<row>

type QueryPlan<
  row extends Record<string, unknown>,
  primaryKey extends readonly string[],
  mode extends QueryExecutionMode = QueryExecutionMode,
> = Extract<AnyQueryPlan<row, primaryKey>, { kind: mode }>

type QueryResultMap<row extends Record<string, unknown>, loaded extends Record<string, unknown>> = {
  all: Array<row & loaded>
  first: (row & loaded) | null
  find: (row & loaded) | null
  count: number
  exists: boolean
  insert: WriteResult | WriteRowResult<row>
  insertMany: WriteResult | WriteRowsResult<row>
  update: WriteResult | WriteRowsResult<row>
  delete: WriteResult | WriteRowsResult<row>
  upsert: WriteResult | WriteRowResult<row>
}

export type QueryExecutionResult<input> =
  input extends Query<any, infer row, infer loaded, any, any, any, infer mode>
    ? QueryResultMap<row, loaded>[Extract<mode, QueryExecutionMode>]
    : never

type QueryRuntime = {
  exec<input extends Query<any, any, any, any, any, any, any>>(
    input: input,
  ): Promise<QueryExecutionResult<input>>
}

type QuerySnapshot<
  tableName extends string = string,
  row extends Record<string, unknown> = Record<string, unknown>,
  primaryKey extends readonly string[] = readonly string[],
  mode extends QueryExecutionMode = QueryExecutionMode,
> = {
  table: QueryTableInput<tableName, row, primaryKey>
  state: QueryState
  plan: QueryPlan<row, primaryKey, mode>
}

export const bindQueryRuntime = Symbol('bindQueryRuntime')
export const querySnapshot = Symbol('querySnapshot')

export class Query<
  columnTypes extends Record<string, unknown>,
  row extends Record<string, unknown>,
  loaded extends Record<string, unknown> = {},
  tableName extends string = string,
  primaryKey extends readonly string[] = readonly string[],
  binding extends QueryBindingState = 'unbound',
  mode extends QueryExecutionMode = 'all',
> {
  #table: QueryTableInput<tableName, row, primaryKey>
  #state: QueryState
  #plan: QueryPlan<row, primaryKey, mode>
  #runtime?: QueryRuntime

  constructor(table: QueryTableInput<tableName, row, primaryKey>) {
    this.#table = table
    this.#state = createInitialQueryState()
    this.#plan = { kind: 'all' } as QueryPlan<row, primaryKey, mode>
  }

  static #createInternal<
    columnTypes extends Record<string, unknown>,
    row extends Record<string, unknown>,
    loaded extends Record<string, unknown>,
    tableName extends string,
    primaryKey extends readonly string[],
    binding extends QueryBindingState,
    mode extends QueryExecutionMode,
  >(
    table: QueryTableInput<tableName, row, primaryKey>,
    state: QueryState,
    plan: QueryPlan<row, primaryKey, mode>,
    runtime?: QueryRuntime,
  ): Query<columnTypes, row, loaded, tableName, primaryKey, binding, mode> {
    let output = new Query(table) as Query<
      columnTypes,
      row,
      loaded,
      tableName,
      primaryKey,
      binding,
      mode
    >

    output.#state = cloneQueryState(state)
    output.#plan = cloneQueryPlan(plan as QueryPlan<row, primaryKey>) as QueryPlan<
      row,
      primaryKey,
      mode
    >
    output.#runtime = runtime

    return output
  }

  select<selection extends (keyof row & string)[]>(
    this: Query<columnTypes, row, loaded, tableName, primaryKey, binding, 'all'>,
    ...columns: selection
  ): Query<columnTypes, Pick<row, selection[number]>, loaded, tableName, primaryKey, binding, 'all'>
  select<selection extends Record<string, QueryColumnInput<columnTypes>>>(
    this: Query<columnTypes, row, loaded, tableName, primaryKey, binding, 'all'>,
    selection: selection,
  ): Query<
    columnTypes,
    SelectedAliasRow<columnTypes, selection>,
    loaded,
    tableName,
    primaryKey,
    binding,
    'all'
  >
  select(
    this: Query<columnTypes, row, loaded, tableName, primaryKey, binding, 'all'>,
    ...input: [Record<string, QueryColumnInput<columnTypes>>] | (keyof row & string)[]
  ): Query<columnTypes, any, loaded, tableName, primaryKey, binding, 'all'> {
    if (
      input.length === 1 &&
      typeof input[0] === 'object' &&
      input[0] !== null &&
      !Array.isArray(input[0])
    ) {
      let selection = input[0] as Record<string, QueryColumnInput<columnTypes>>
      let aliases = Object.keys(selection)
      let select = aliases.map((alias) => ({
        column: normalizeColumnInput(selection[alias]),
        alias,
      }))

      return this.#clone({ select }) as Query<
        columnTypes,
        any,
        loaded,
        tableName,
        primaryKey,
        binding,
        'all'
      >
    }

    let columns = input as (keyof row & string)[]

    return this.#clone({
      select: columns.map((column) => ({ column, alias: column })),
    }) as Query<columnTypes, any, loaded, tableName, primaryKey, binding, 'all'>
  }

  distinct(
    this: Query<columnTypes, row, loaded, tableName, primaryKey, binding, 'all'>,
    value = true,
  ): Query<columnTypes, row, loaded, tableName, primaryKey, binding, 'all'> {
    return this.#clone({ distinct: value })
  }

  where(
    this: Query<columnTypes, row, loaded, tableName, primaryKey, binding, 'all'>,
    input: WhereInput<QueryColumns<columnTypes>>,
  ): Query<columnTypes, row, loaded, tableName, primaryKey, binding, 'all'> {
    let predicate = normalizeWhereInput(input)
    let normalizedPredicate = normalizePredicateValues(
      predicate,
      createPredicateColumnResolver([this.#table, ...this.#state.joins.map((join) => join.table)]),
    )

    return this.#clone({
      where: [...this.#state.where, normalizedPredicate],
    })
  }

  having(
    this: Query<columnTypes, row, loaded, tableName, primaryKey, binding, 'all'>,
    input: WhereInput<QueryColumns<columnTypes>>,
  ): Query<columnTypes, row, loaded, tableName, primaryKey, binding, 'all'> {
    let predicate = normalizeWhereInput(input)
    let normalizedPredicate = normalizePredicateValues(
      predicate,
      createPredicateColumnResolver([this.#table, ...this.#state.joins.map((join) => join.table)]),
    )

    return this.#clone({
      having: [...this.#state.having, normalizedPredicate],
    })
  }

  join<target extends AnyTable>(
    this: Query<columnTypes, row, loaded, tableName, primaryKey, binding, 'all'>,
    target: target,
    on: Predicate<QueryColumns<columnTypes> | QueryColumnName<target>>,
    type: JoinType = 'inner',
  ): Query<
    MergeColumnTypeMaps<columnTypes, QueryColumnTypeMap<target>>,
    row,
    loaded,
    tableName,
    primaryKey,
    binding,
    'all'
  > {
    let normalizedOn = normalizePredicateValues(
      on,
      createPredicateColumnResolver([
        this.#table,
        ...this.#state.joins.map((join) => join.table),
        target,
      ]),
    ) as Predicate<QueryColumns<columnTypes> | QueryColumnName<target>>

    return this.#clone({
      joins: [...this.#state.joins, { type, table: target, on: normalizedOn }],
    }) as Query<
      MergeColumnTypeMaps<columnTypes, QueryColumnTypeMap<target>>,
      row,
      loaded,
      tableName,
      primaryKey,
      binding,
      'all'
    >
  }

  leftJoin<target extends AnyTable>(
    this: Query<columnTypes, row, loaded, tableName, primaryKey, binding, 'all'>,
    target: target,
    on: Predicate<QueryColumns<columnTypes> | QueryColumnName<target>>,
  ): Query<
    MergeColumnTypeMaps<columnTypes, QueryColumnTypeMap<target>>,
    row,
    loaded,
    tableName,
    primaryKey,
    binding,
    'all'
  > {
    return this.join(target, on, 'left')
  }

  rightJoin<target extends AnyTable>(
    this: Query<columnTypes, row, loaded, tableName, primaryKey, binding, 'all'>,
    target: target,
    on: Predicate<QueryColumns<columnTypes> | QueryColumnName<target>>,
  ): Query<
    MergeColumnTypeMaps<columnTypes, QueryColumnTypeMap<target>>,
    row,
    loaded,
    tableName,
    primaryKey,
    binding,
    'all'
  > {
    return this.join(target, on, 'right')
  }

  orderBy(
    this: Query<columnTypes, row, loaded, tableName, primaryKey, binding, 'all'>,
    column: QueryColumnInput<columnTypes>,
    direction: 'asc' | 'desc' = 'asc',
  ): Query<columnTypes, row, loaded, tableName, primaryKey, binding, 'all'> {
    return this.#clone({
      orderBy: [...this.#state.orderBy, { column: normalizeColumnInput(column), direction }],
    })
  }

  groupBy(
    this: Query<columnTypes, row, loaded, tableName, primaryKey, binding, 'all'>,
    ...columns: QueryColumnInput<columnTypes>[]
  ): Query<columnTypes, row, loaded, tableName, primaryKey, binding, 'all'> {
    return this.#clone({
      groupBy: [...this.#state.groupBy, ...columns.map((column) => normalizeColumnInput(column))],
    })
  }

  limit(
    this: Query<columnTypes, row, loaded, tableName, primaryKey, binding, 'all'>,
    value: number,
  ): Query<columnTypes, row, loaded, tableName, primaryKey, binding, 'all'> {
    return this.#clone({ limit: value })
  }

  offset(
    this: Query<columnTypes, row, loaded, tableName, primaryKey, binding, 'all'>,
    value: number,
  ): Query<columnTypes, row, loaded, tableName, primaryKey, binding, 'all'> {
    return this.#clone({ offset: value })
  }

  with<relations extends RelationMapForSourceName<tableName>>(
    this: Query<columnTypes, row, loaded, tableName, primaryKey, binding, 'all'>,
    relations: relations,
  ): Query<
    columnTypes,
    row,
    loaded & LoadedRelationMap<relations>,
    tableName,
    primaryKey,
    binding,
    'all'
  > {
    return this.#clone({
      with: {
        ...this.#state.with,
        ...relations,
      },
    }) as Query<
      columnTypes,
      row,
      loaded & LoadedRelationMap<relations>,
      tableName,
      primaryKey,
      binding,
      'all'
    >
  }

  all(
    this: Query<columnTypes, row, loaded, tableName, primaryKey, 'bound', 'all'>,
  ): Promise<Array<row & loaded>> {
    return this.#boundRuntime().exec(this) as Promise<Array<row & loaded>>
  }

  first(
    this: Query<columnTypes, row, loaded, tableName, primaryKey, 'bound', 'all'>,
  ): Promise<(row & loaded) | null>
  first(
    this: Query<columnTypes, row, loaded, tableName, primaryKey, 'unbound', 'all'>,
  ): Query<columnTypes, row, loaded, tableName, primaryKey, 'unbound', 'first'>
  first(
    this: Query<columnTypes, row, loaded, tableName, primaryKey, binding, 'all'>,
  ):
    | Promise<(row & loaded) | null>
    | Query<columnTypes, row, loaded, tableName, primaryKey, binding, 'first'> {
    let next = this.#withPlan({ kind: 'first' })
    return this.#runtime ? (this.#runtime.exec(next) as Promise<(row & loaded) | null>) : next
  }

  find(
    this: Query<columnTypes, row, loaded, tableName, primaryKey, 'bound', 'all'>,
    value: PrimaryKeyInputForRow<row, primaryKey>,
  ): Promise<(row & loaded) | null>
  find(
    this: Query<columnTypes, row, loaded, tableName, primaryKey, 'unbound', 'all'>,
    value: PrimaryKeyInputForRow<row, primaryKey>,
  ): Query<columnTypes, row, loaded, tableName, primaryKey, 'unbound', 'find'>
  find(
    this: Query<columnTypes, row, loaded, tableName, primaryKey, binding, 'all'>,
    value: PrimaryKeyInputForRow<row, primaryKey>,
  ):
    | Promise<(row & loaded) | null>
    | Query<columnTypes, row, loaded, tableName, primaryKey, binding, 'find'> {
    let next = this.#withPlan({ kind: 'find', value })
    return this.#runtime ? (this.#runtime.exec(next) as Promise<(row & loaded) | null>) : next
  }

  count(
    this: Query<columnTypes, row, loaded, tableName, primaryKey, 'bound', 'all'>,
  ): Promise<number>
  count(
    this: Query<columnTypes, row, loaded, tableName, primaryKey, 'unbound', 'all'>,
  ): Query<columnTypes, row, loaded, tableName, primaryKey, 'unbound', 'count'>
  count(
    this: Query<columnTypes, row, loaded, tableName, primaryKey, binding, 'all'>,
  ): Promise<number> | Query<columnTypes, row, loaded, tableName, primaryKey, binding, 'count'> {
    let next = this.#withPlan({ kind: 'count' })
    return this.#runtime ? (this.#runtime.exec(next) as Promise<number>) : next
  }

  exists(
    this: Query<columnTypes, row, loaded, tableName, primaryKey, 'bound', 'all'>,
  ): Promise<boolean>
  exists(
    this: Query<columnTypes, row, loaded, tableName, primaryKey, 'unbound', 'all'>,
  ): Query<columnTypes, row, loaded, tableName, primaryKey, 'unbound', 'exists'>
  exists(
    this: Query<columnTypes, row, loaded, tableName, primaryKey, binding, 'all'>,
  ): Promise<boolean> | Query<columnTypes, row, loaded, tableName, primaryKey, binding, 'exists'> {
    let next = this.#withPlan({ kind: 'exists' })
    return this.#runtime ? (this.#runtime.exec(next) as Promise<boolean>) : next
  }

  insert(
    this: Query<columnTypes, row, loaded, tableName, primaryKey, 'bound', 'all'>,
    values: Partial<row>,
    options?: InsertQueryOptions<row>,
  ): Promise<WriteResult | WriteRowResult<row>>
  insert(
    this: Query<columnTypes, row, loaded, tableName, primaryKey, 'unbound', 'all'>,
    values: Partial<row>,
    options?: InsertQueryOptions<row>,
  ): Query<columnTypes, row, loaded, tableName, primaryKey, 'unbound', 'insert'>
  insert(
    this: Query<columnTypes, row, loaded, tableName, primaryKey, binding, 'all'>,
    values: Partial<row>,
    options?: InsertQueryOptions<row>,
  ):
    | Promise<WriteResult | WriteRowResult<row>>
    | Query<columnTypes, row, loaded, tableName, primaryKey, binding, 'insert'> {
    assertWriteState(this.#state, 'insert', {
      where: false,
      orderBy: false,
      limit: false,
      offset: false,
    })

    let next = this.#withPlan({ kind: 'insert', values, options })
    return this.#runtime
      ? (this.#runtime.exec(next) as Promise<WriteResult | WriteRowResult<row>>)
      : next
  }

  insertMany(
    this: Query<columnTypes, row, loaded, tableName, primaryKey, 'bound', 'all'>,
    values: Partial<row>[],
    options?: InsertQueryOptions<row>,
  ): Promise<WriteResult | WriteRowsResult<row>>
  insertMany(
    this: Query<columnTypes, row, loaded, tableName, primaryKey, 'unbound', 'all'>,
    values: Partial<row>[],
    options?: InsertQueryOptions<row>,
  ): Query<columnTypes, row, loaded, tableName, primaryKey, 'unbound', 'insertMany'>
  insertMany(
    this: Query<columnTypes, row, loaded, tableName, primaryKey, binding, 'all'>,
    values: Partial<row>[],
    options?: InsertQueryOptions<row>,
  ):
    | Promise<WriteResult | WriteRowsResult<row>>
    | Query<columnTypes, row, loaded, tableName, primaryKey, binding, 'insertMany'> {
    assertWriteState(this.#state, 'insertMany', {
      where: false,
      orderBy: false,
      limit: false,
      offset: false,
    })

    let next = this.#withPlan({ kind: 'insertMany', values, options })
    return this.#runtime
      ? (this.#runtime.exec(next) as Promise<WriteResult | WriteRowsResult<row>>)
      : next
  }

  update(
    this: Query<columnTypes, row, loaded, tableName, primaryKey, 'bound', 'all'>,
    changes: Partial<row>,
    options?: InsertQueryOptions<row>,
  ): Promise<WriteResult | WriteRowsResult<row>>
  update(
    this: Query<columnTypes, row, loaded, tableName, primaryKey, 'unbound', 'all'>,
    changes: Partial<row>,
    options?: InsertQueryOptions<row>,
  ): Query<columnTypes, row, loaded, tableName, primaryKey, 'unbound', 'update'>
  update(
    this: Query<columnTypes, row, loaded, tableName, primaryKey, binding, 'all'>,
    changes: Partial<row>,
    options?: InsertQueryOptions<row>,
  ):
    | Promise<WriteResult | WriteRowsResult<row>>
    | Query<columnTypes, row, loaded, tableName, primaryKey, binding, 'update'> {
    assertWriteState(this.#state, 'update', {
      where: true,
      orderBy: true,
      limit: true,
      offset: true,
    })

    let next = this.#withPlan({ kind: 'update', changes, options })
    return this.#runtime
      ? (this.#runtime.exec(next) as Promise<WriteResult | WriteRowsResult<row>>)
      : next
  }

  delete(
    this: Query<columnTypes, row, loaded, tableName, primaryKey, 'bound', 'all'>,
    options?: DeleteQueryOptions<row>,
  ): Promise<WriteResult | WriteRowsResult<row>>
  delete(
    this: Query<columnTypes, row, loaded, tableName, primaryKey, 'unbound', 'all'>,
    options?: DeleteQueryOptions<row>,
  ): Query<columnTypes, row, loaded, tableName, primaryKey, 'unbound', 'delete'>
  delete(
    this: Query<columnTypes, row, loaded, tableName, primaryKey, binding, 'all'>,
    options?: DeleteQueryOptions<row>,
  ):
    | Promise<WriteResult | WriteRowsResult<row>>
    | Query<columnTypes, row, loaded, tableName, primaryKey, binding, 'delete'> {
    assertWriteState(this.#state, 'delete', {
      where: true,
      orderBy: true,
      limit: true,
      offset: true,
    })

    let next = this.#withPlan({ kind: 'delete', options })
    return this.#runtime
      ? (this.#runtime.exec(next) as Promise<WriteResult | WriteRowsResult<row>>)
      : next
  }

  upsert(
    this: Query<columnTypes, row, loaded, tableName, primaryKey, 'bound', 'all'>,
    values: Partial<row>,
    options?: UpsertQueryOptions<row>,
  ): Promise<WriteResult | WriteRowResult<row>>
  upsert(
    this: Query<columnTypes, row, loaded, tableName, primaryKey, 'unbound', 'all'>,
    values: Partial<row>,
    options?: UpsertQueryOptions<row>,
  ): Query<columnTypes, row, loaded, tableName, primaryKey, 'unbound', 'upsert'>
  upsert(
    this: Query<columnTypes, row, loaded, tableName, primaryKey, binding, 'all'>,
    values: Partial<row>,
    options?: UpsertQueryOptions<row>,
  ):
    | Promise<WriteResult | WriteRowResult<row>>
    | Query<columnTypes, row, loaded, tableName, primaryKey, binding, 'upsert'> {
    assertWriteState(this.#state, 'upsert', {
      where: false,
      orderBy: false,
      limit: false,
      offset: false,
    })

    let next = this.#withPlan({ kind: 'upsert', values, options })
    return this.#runtime
      ? (this.#runtime.exec(next) as Promise<WriteResult | WriteRowResult<row>>)
      : next
  }

  [querySnapshot](): QuerySnapshot<tableName, row, primaryKey, mode> {
    return this.#snapshot()
  }

  [bindQueryRuntime](
    runtime: QueryRuntime,
  ): Query<columnTypes, row, loaded, tableName, primaryKey, 'bound', mode> {
    return Query.#createInternal<columnTypes, row, loaded, tableName, primaryKey, 'bound', mode>(
      this.#table,
      this.#state,
      this.#plan as QueryPlan<row, primaryKey, mode>,
      runtime,
    )
  }

  #clone(
    patch: Partial<QueryState>,
  ): Query<columnTypes, row, loaded, tableName, primaryKey, binding, mode> {
    return Query.#createInternal<columnTypes, row, loaded, tableName, primaryKey, binding, mode>(
      this.#table,
      {
        select: patch.select ?? cloneSelection(this.#state.select),
        distinct: patch.distinct ?? this.#state.distinct,
        joins: patch.joins ? [...patch.joins] : [...this.#state.joins],
        where: patch.where ? [...patch.where] : [...this.#state.where],
        groupBy: patch.groupBy ? [...patch.groupBy] : [...this.#state.groupBy],
        having: patch.having ? [...patch.having] : [...this.#state.having],
        orderBy: patch.orderBy ? [...patch.orderBy] : [...this.#state.orderBy],
        limit: patch.limit === undefined ? this.#state.limit : patch.limit,
        offset: patch.offset === undefined ? this.#state.offset : patch.offset,
        with: patch.with ? { ...patch.with } : { ...this.#state.with },
      },
      this.#plan as QueryPlan<row, primaryKey, mode>,
      this.#runtime,
    )
  }

  #withPlan<nextMode extends QueryExecutionMode>(
    plan: QueryPlan<row, primaryKey, nextMode>,
  ): Query<columnTypes, row, loaded, tableName, primaryKey, binding, nextMode> {
    return Query.#createInternal<
      columnTypes,
      row,
      loaded,
      tableName,
      primaryKey,
      binding,
      nextMode
    >(this.#table, this.#state, plan, this.#runtime)
  }

  #snapshot(): QuerySnapshot<tableName, row, primaryKey, mode> {
    return {
      table: this.#table,
      state: cloneQueryState(this.#state),
      plan: cloneQueryPlan(this.#plan as QueryPlan<row, primaryKey>) as QueryPlan<
        row,
        primaryKey,
        mode
      >,
    }
  }

  #boundRuntime(): QueryRuntime {
    if (!this.#runtime) {
      throw new DataTableQueryError('Use db.exec(query) to execute an unbound Query')
    }

    return this.#runtime
  }
}

export function query<
  tableName extends string,
  row extends Record<string, unknown>,
  primaryKey extends readonly (keyof row & string)[],
>(
  table: QueryTableInput<tableName, row, primaryKey>,
): Query<
  QueryColumnTypeMapFromRow<tableName, row>,
  row,
  {},
  tableName,
  primaryKey,
  'unbound',
  'all'
> {
  return new Query(table) as Query<
    QueryColumnTypeMapFromRow<tableName, row>,
    row,
    {},
    tableName,
    primaryKey,
    'unbound',
    'all'
  >
}

export function cloneQueryState(state: QueryState): QueryState {
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

function createInitialQueryState(): QueryState {
  return {
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

function cloneQueryPlan<row extends Record<string, unknown>, primaryKey extends readonly string[]>(
  plan: QueryPlan<row, primaryKey>,
): QueryPlan<row, primaryKey> {
  switch (plan.kind) {
    case 'all':
      return { kind: 'all' } as QueryPlan<row, primaryKey>
    case 'first':
      return { kind: 'first' } as QueryPlan<row, primaryKey>
    case 'find':
      return {
        kind: 'find',
        value: clonePrimaryKeyValue(plan.value) as PrimaryKeyInputForRow<row, primaryKey>,
      } as QueryPlan<row, primaryKey>
    case 'count':
      return { kind: 'count' } as QueryPlan<row, primaryKey>
    case 'exists':
      return { kind: 'exists' } as QueryPlan<row, primaryKey>
    case 'insert':
      return {
        kind: 'insert',
        values: { ...plan.values },
        options: plan.options ? { ...plan.options } : undefined,
      } as QueryPlan<row, primaryKey>
    case 'insertMany':
      return {
        kind: 'insertMany',
        values: plan.values.map((value: Partial<row>) => ({ ...value })),
        options: plan.options ? { ...plan.options } : undefined,
      } as QueryPlan<row, primaryKey>
    case 'update':
      return {
        kind: 'update',
        changes: { ...plan.changes },
        options: plan.options ? { ...plan.options } : undefined,
      } as QueryPlan<row, primaryKey>
    case 'delete':
      return {
        kind: 'delete',
        options: plan.options ? { ...plan.options } : undefined,
      } as QueryPlan<row, primaryKey>
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
      } as QueryPlan<row, primaryKey>
  }
}

function clonePrimaryKeyValue(value: unknown): unknown {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return value
  }

  return { ...value }
}

function cloneSelection(selection: '*' | SelectColumn[]): '*' | SelectColumn[] {
  if (selection === '*') {
    return '*'
  }

  return selection.map((column) => ({ ...column }))
}

type WriteStatePolicy = {
  where: boolean
  orderBy: boolean
  limit: boolean
  offset: boolean
}

function assertWriteState(
  state: QueryState,
  operation: 'insert' | 'insertMany' | 'update' | 'delete' | 'upsert',
  policy: WriteStatePolicy,
): void {
  let unsupported: string[] = []

  if (state.select !== '*') unsupported.push('select()')
  if (state.distinct) unsupported.push('distinct()')
  if (state.joins.length > 0) unsupported.push('join()')
  if (state.groupBy.length > 0) unsupported.push('groupBy()')
  if (state.having.length > 0) unsupported.push('having()')
  if (Object.keys(state.with).length > 0) unsupported.push('with()')
  if (!policy.where && state.where.length > 0) unsupported.push('where()')
  if (!policy.orderBy && state.orderBy.length > 0) unsupported.push('orderBy()')
  if (!policy.limit && state.limit !== undefined) unsupported.push('limit()')
  if (!policy.offset && state.offset !== undefined) unsupported.push('offset()')

  if (unsupported.length > 0) {
    throw new DataTableQueryError(
      operation + '() does not support these query modifiers: ' + unsupported.join(', '),
    )
  }
}

type ResolvedPredicateColumn = {
  tableName: string
  columnName: string
}

function createPredicateColumnResolver(
  tables: AnyTable[],
): (column: string) => ResolvedPredicateColumn {
  let qualifiedColumns = new Map<string, ResolvedPredicateColumn>()
  let unqualifiedColumns = new Map<string, ResolvedPredicateColumn>()
  let ambiguousColumns = new Set<string>()

  for (let table of tables) {
    let tableColumns = getTableColumns(table)
    let tableName = getTableName(table)

    for (let columnName in tableColumns) {
      if (!Object.prototype.hasOwnProperty.call(tableColumns, columnName)) {
        continue
      }

      let resolvedColumn: ResolvedPredicateColumn = {
        tableName,
        columnName,
      }

      qualifiedColumns.set(tableName + '.' + columnName, resolvedColumn)

      if (ambiguousColumns.has(columnName)) {
        continue
      }

      if (unqualifiedColumns.has(columnName)) {
        unqualifiedColumns.delete(columnName)
        ambiguousColumns.add(columnName)
        continue
      }

      unqualifiedColumns.set(columnName, resolvedColumn)
    }
  }

  return function resolveColumn(column: string): ResolvedPredicateColumn {
    let qualified = qualifiedColumns.get(column)
    if (qualified) return qualified

    if (column.includes('.')) {
      throw new DataTableQueryError('Unknown predicate column "' + column + '"')
    }

    if (ambiguousColumns.has(column)) {
      throw new DataTableQueryError(
        'Ambiguous predicate column "' + column + '". Use a qualified column name',
      )
    }

    let unqualified = unqualifiedColumns.get(column)

    if (!unqualified) {
      throw new DataTableQueryError('Unknown predicate column "' + column + '"')
    }

    return unqualified
  }
}

function normalizePredicateValues(
  predicate: Predicate,
  resolveColumn: (column: string) => ResolvedPredicateColumn,
): Predicate {
  if (predicate.type === 'comparison') {
    let column = resolveColumn(predicate.column)

    if (predicate.valueType === 'column') {
      resolveColumn(predicate.value)
      return predicate
    }

    if (predicate.operator === 'in' || predicate.operator === 'notIn') {
      if (!Array.isArray(predicate.value)) {
        throw new DataTableValidationError(
          'Invalid filter value for column "' +
            column.columnName +
            '" in table "' +
            column.tableName +
            '"',
          [{ message: 'Expected an array value for "' + predicate.operator + '" predicate' }],
          {
            metadata: {
              table: column.tableName,
              column: column.columnName,
            },
          },
        )
      }

      return predicate
    }

    return predicate
  }

  if (predicate.type === 'between') {
    resolveColumn(predicate.column)
    return predicate
  }

  if (predicate.type === 'null') {
    resolveColumn(predicate.column)
    return predicate
  }

  return {
    ...predicate,
    predicates: predicate.predicates.map((child) => normalizePredicateValues(child, resolveColumn)),
  }
}
