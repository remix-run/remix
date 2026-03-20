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
import { getPrimaryKeyObject, getTableColumns, getTableName } from './table.ts'

export type QueryBindingState = 'bound' | 'unbound'

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

export type FirstQuery<
  columnTypes extends Record<string, unknown>,
  row extends Record<string, unknown>,
  loaded extends Record<string, unknown>,
  tableName extends string,
  primaryKey extends readonly string[],
> = {
  kind: 'first'
  table: QueryTableInput<tableName, row, primaryKey>
  state: QueryState
}

export type FindQuery<
  columnTypes extends Record<string, unknown>,
  row extends Record<string, unknown>,
  loaded extends Record<string, unknown>,
  tableName extends string,
  primaryKey extends readonly string[],
> = {
  kind: 'find'
  table: QueryTableInput<tableName, row, primaryKey>
  state: QueryState
  value: PrimaryKeyInputForRow<row, primaryKey>
}

export type CountQuery<
  columnTypes extends Record<string, unknown>,
  row extends Record<string, unknown>,
  loaded extends Record<string, unknown>,
  tableName extends string,
  primaryKey extends readonly string[],
> = {
  kind: 'count'
  table: QueryTableInput<tableName, row, primaryKey>
  state: QueryState
}

export type ExistsQuery<
  columnTypes extends Record<string, unknown>,
  row extends Record<string, unknown>,
  loaded extends Record<string, unknown>,
  tableName extends string,
  primaryKey extends readonly string[],
> = {
  kind: 'exists'
  table: QueryTableInput<tableName, row, primaryKey>
  state: QueryState
}

export type InsertCommand<
  columnTypes extends Record<string, unknown>,
  row extends Record<string, unknown>,
  loaded extends Record<string, unknown>,
  tableName extends string,
  primaryKey extends readonly string[],
> = {
  kind: 'insert'
  table: QueryTableInput<tableName, row, primaryKey>
  state: QueryState
  values: Partial<row>
  options?: { returning?: ReturningInput<row>; touch?: boolean }
}

export type InsertManyCommand<
  columnTypes extends Record<string, unknown>,
  row extends Record<string, unknown>,
  loaded extends Record<string, unknown>,
  tableName extends string,
  primaryKey extends readonly string[],
> = {
  kind: 'insertMany'
  table: QueryTableInput<tableName, row, primaryKey>
  state: QueryState
  values: Partial<row>[]
  options?: { returning?: ReturningInput<row>; touch?: boolean }
}

export type UpdateCommand<
  columnTypes extends Record<string, unknown>,
  row extends Record<string, unknown>,
  loaded extends Record<string, unknown>,
  tableName extends string,
  primaryKey extends readonly string[],
> = {
  kind: 'update'
  table: QueryTableInput<tableName, row, primaryKey>
  state: QueryState
  changes: Partial<row>
  options?: { returning?: ReturningInput<row>; touch?: boolean }
}

export type DeleteCommand<
  columnTypes extends Record<string, unknown>,
  row extends Record<string, unknown>,
  loaded extends Record<string, unknown>,
  tableName extends string,
  primaryKey extends readonly string[],
> = {
  kind: 'delete'
  table: QueryTableInput<tableName, row, primaryKey>
  state: QueryState
  options?: { returning?: ReturningInput<row> }
}

export type UpsertCommand<
  columnTypes extends Record<string, unknown>,
  row extends Record<string, unknown>,
  loaded extends Record<string, unknown>,
  tableName extends string,
  primaryKey extends readonly string[],
> = {
  kind: 'upsert'
  table: QueryTableInput<tableName, row, primaryKey>
  state: QueryState
  values: Partial<row>
  options?: {
    returning?: ReturningInput<row>
    touch?: boolean
    conflictTarget?: (keyof row & string)[]
    update?: Partial<row>
  }
}

export type ExecutableQueryInput =
  | Query<any, any, any, any, any, any>
  | FirstQuery<any, any, any, any, any>
  | FindQuery<any, any, any, any, any>
  | CountQuery<any, any, any, any, any>
  | ExistsQuery<any, any, any, any, any>
  | InsertCommand<any, any, any, any, any>
  | InsertManyCommand<any, any, any, any, any>
  | UpdateCommand<any, any, any, any, any>
  | DeleteCommand<any, any, any, any, any>
  | UpsertCommand<any, any, any, any, any>

export type QueryExecutionResult<input> = input extends Query<any, infer row, infer loaded, any, any, any>
  ? Array<row & loaded>
  : input extends FirstQuery<any, infer row, infer loaded, any, any>
    ? (row & loaded) | null
    : input extends FindQuery<any, infer row, infer loaded, any, any>
      ? (row & loaded) | null
      : input extends CountQuery<any, any, any, any, any>
        ? number
        : input extends ExistsQuery<any, any, any, any, any>
          ? boolean
          : input extends InsertCommand<any, infer row, any, any, any>
            ? WriteResult | WriteRowResult<row>
            : input extends InsertManyCommand<any, infer row, any, any, any>
              ? WriteResult | WriteRowsResult<row>
              : input extends UpdateCommand<any, infer row, any, any, any>
                ? WriteResult | WriteRowsResult<row>
                : input extends DeleteCommand<any, infer row, any, any, any>
                  ? WriteResult | WriteRowsResult<row>
                  : input extends UpsertCommand<any, infer row, any, any, any>
                    ? WriteResult | WriteRowResult<row>
                    : never

type QueryRuntime = {
  exec<input extends ExecutableQueryInput>(input: input): Promise<QueryExecutionResult<input>>
}

type QueryInternals = {
  table: AnyTable
  state: QueryState
  runtime?: QueryRuntime
}

let queryInternals = new WeakMap<object, QueryInternals>()

export class Query<
  columnTypes extends Record<string, unknown>,
  row extends Record<string, unknown>,
  loaded extends Record<string, unknown> = {},
  tableName extends string = string,
  primaryKey extends readonly string[] = readonly string[],
  binding extends QueryBindingState = 'unbound',
> {
  constructor(table: QueryTableInput<tableName, row, primaryKey>) {
    queryInternals.set(this, {
      table,
      state: createInitialQueryState(),
    })
  }

  select<selection extends (keyof row & string)[]>(
    ...columns: selection
  ): Query<columnTypes, Pick<row, selection[number]>, loaded, tableName, primaryKey, binding>
  select<selection extends Record<string, QueryColumnInput<columnTypes>>>(
    selection: selection,
  ): Query<
    columnTypes,
    SelectedAliasRow<columnTypes, selection>,
    loaded,
    tableName,
    primaryKey,
    binding
  >
  select(
    ...input: [Record<string, QueryColumnInput<columnTypes>>] | (keyof row & string)[]
  ): Query<columnTypes, any, loaded, tableName, primaryKey, binding> {
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

      return this.#clone({ select }) as Query<columnTypes, any, loaded, tableName, primaryKey, binding>
    }

    let columns = input as (keyof row & string)[]

    return this.#clone({
      select: columns.map((column) => ({ column, alias: column })),
    }) as Query<columnTypes, any, loaded, tableName, primaryKey, binding>
  }

  distinct(value = true): Query<columnTypes, row, loaded, tableName, primaryKey, binding> {
    return this.#clone({ distinct: value })
  }

  where(
    input: WhereInput<QueryColumns<columnTypes>>,
  ): Query<columnTypes, row, loaded, tableName, primaryKey, binding> {
    let internals = getQueryInternals(this)
    let predicate = normalizeWhereInput(input)
    let normalizedPredicate = normalizePredicateValues(
      predicate,
      createPredicateColumnResolver([
        internals.table,
        ...internals.state.joins.map((join) => join.table),
      ]),
    )

    return this.#clone({
      where: [...internals.state.where, normalizedPredicate],
    })
  }

  having(
    input: WhereInput<QueryColumns<columnTypes>>,
  ): Query<columnTypes, row, loaded, tableName, primaryKey, binding> {
    let internals = getQueryInternals(this)
    let predicate = normalizeWhereInput(input)
    let normalizedPredicate = normalizePredicateValues(
      predicate,
      createPredicateColumnResolver([
        internals.table,
        ...internals.state.joins.map((join) => join.table),
      ]),
    )

    return this.#clone({
      having: [...internals.state.having, normalizedPredicate],
    })
  }

  join<target extends AnyTable>(
    target: target,
    on: Predicate<QueryColumns<columnTypes> | QueryColumnName<target>>,
    type: JoinType = 'inner',
  ): Query<
    MergeColumnTypeMaps<columnTypes, QueryColumnTypeMap<target>>,
    row,
    loaded,
    tableName,
    primaryKey,
    binding
  > {
    let internals = getQueryInternals(this)
    let normalizedOn = normalizePredicateValues(
      on,
      createPredicateColumnResolver([
        internals.table,
        ...internals.state.joins.map((join) => join.table),
        target,
      ]),
    ) as Predicate<QueryColumns<columnTypes> | QueryColumnName<target>>

    return this.#clone({
      joins: [...internals.state.joins, { type, table: target, on: normalizedOn }],
    }) as Query<
      MergeColumnTypeMaps<columnTypes, QueryColumnTypeMap<target>>,
      row,
      loaded,
      tableName,
      primaryKey,
      binding
    >
  }

  leftJoin<target extends AnyTable>(
    target: target,
    on: Predicate<QueryColumns<columnTypes> | QueryColumnName<target>>,
  ): Query<
    MergeColumnTypeMaps<columnTypes, QueryColumnTypeMap<target>>,
    row,
    loaded,
    tableName,
    primaryKey,
    binding
  > {
    return this.join(target, on, 'left')
  }

  rightJoin<target extends AnyTable>(
    target: target,
    on: Predicate<QueryColumns<columnTypes> | QueryColumnName<target>>,
  ): Query<
    MergeColumnTypeMaps<columnTypes, QueryColumnTypeMap<target>>,
    row,
    loaded,
    tableName,
    primaryKey,
    binding
  > {
    return this.join(target, on, 'right')
  }

  orderBy(
    column: QueryColumnInput<columnTypes>,
    direction: 'asc' | 'desc' = 'asc',
  ): Query<columnTypes, row, loaded, tableName, primaryKey, binding> {
    let internals = getQueryInternals(this)

    return this.#clone({
      orderBy: [...internals.state.orderBy, { column: normalizeColumnInput(column), direction }],
    })
  }

  groupBy(
    ...columns: QueryColumnInput<columnTypes>[]
  ): Query<columnTypes, row, loaded, tableName, primaryKey, binding> {
    let internals = getQueryInternals(this)

    return this.#clone({
      groupBy: [
        ...internals.state.groupBy,
        ...columns.map((column) => normalizeColumnInput(column)),
      ],
    })
  }

  limit(value: number): Query<columnTypes, row, loaded, tableName, primaryKey, binding> {
    return this.#clone({ limit: value })
  }

  offset(value: number): Query<columnTypes, row, loaded, tableName, primaryKey, binding> {
    return this.#clone({ offset: value })
  }

  with<relations extends RelationMapForSourceName<tableName>>(
    relations: relations,
  ): Query<
    columnTypes,
    row,
    loaded & LoadedRelationMap<relations>,
    tableName,
    primaryKey,
    binding
  > {
    let internals = getQueryInternals(this)

    return this.#clone({
      with: {
        ...internals.state.with,
        ...relations,
      },
    }) as Query<
      columnTypes,
      row,
      loaded & LoadedRelationMap<relations>,
      tableName,
      primaryKey,
      binding
    >
  }

  all(this: Query<columnTypes, row, loaded, tableName, primaryKey, 'bound'>): Promise<Array<row & loaded>> {
    return this.#runtime().exec(this) as Promise<Array<row & loaded>>
  }

  first(
    this: Query<columnTypes, row, loaded, tableName, primaryKey, 'bound'>,
  ): Promise<(row & loaded) | null>
  first(
    this: Query<columnTypes, row, loaded, tableName, primaryKey, 'unbound'>,
  ): FirstQuery<columnTypes, row, loaded, tableName, primaryKey>
  first(): Promise<(row & loaded) | null> | FirstQuery<columnTypes, row, loaded, tableName, primaryKey> {
    let command = createFirstQuery(this)
    let runtime = getQueryInternals(this).runtime
    return runtime ? runtime.exec(command) as Promise<(row & loaded) | null> : command
  }

  find(
    this: Query<columnTypes, row, loaded, tableName, primaryKey, 'bound'>,
    value: PrimaryKeyInputForRow<row, primaryKey>,
  ): Promise<(row & loaded) | null>
  find(
    this: Query<columnTypes, row, loaded, tableName, primaryKey, 'unbound'>,
    value: PrimaryKeyInputForRow<row, primaryKey>,
  ): FindQuery<columnTypes, row, loaded, tableName, primaryKey>
  find(
    value: PrimaryKeyInputForRow<row, primaryKey>,
  ):
    | Promise<(row & loaded) | null>
    | FindQuery<columnTypes, row, loaded, tableName, primaryKey> {
    let command = createFindQuery(this, value)
    let runtime = getQueryInternals(this).runtime
    return runtime ? runtime.exec(command) as Promise<(row & loaded) | null> : command
  }

  count(
    this: Query<columnTypes, row, loaded, tableName, primaryKey, 'bound'>,
  ): Promise<number>
  count(
    this: Query<columnTypes, row, loaded, tableName, primaryKey, 'unbound'>,
  ): CountQuery<columnTypes, row, loaded, tableName, primaryKey>
  count(): Promise<number> | CountQuery<columnTypes, row, loaded, tableName, primaryKey> {
    let command = createCountQuery(this)
    let runtime = getQueryInternals(this).runtime
    return runtime ? runtime.exec(command) as Promise<number> : command
  }

  exists(
    this: Query<columnTypes, row, loaded, tableName, primaryKey, 'bound'>,
  ): Promise<boolean>
  exists(
    this: Query<columnTypes, row, loaded, tableName, primaryKey, 'unbound'>,
  ): ExistsQuery<columnTypes, row, loaded, tableName, primaryKey>
  exists(): Promise<boolean> | ExistsQuery<columnTypes, row, loaded, tableName, primaryKey> {
    let command = createExistsQuery(this)
    let runtime = getQueryInternals(this).runtime
    return runtime ? runtime.exec(command) as Promise<boolean> : command
  }

  insert(
    this: Query<columnTypes, row, loaded, tableName, primaryKey, 'bound'>,
    values: Partial<row>,
    options?: { returning?: ReturningInput<row>; touch?: boolean },
  ): Promise<WriteResult | WriteRowResult<row>>
  insert(
    this: Query<columnTypes, row, loaded, tableName, primaryKey, 'unbound'>,
    values: Partial<row>,
    options?: { returning?: ReturningInput<row>; touch?: boolean },
  ): InsertCommand<columnTypes, row, loaded, tableName, primaryKey>
  insert(
    values: Partial<row>,
    options?: { returning?: ReturningInput<row>; touch?: boolean },
  ): Promise<WriteResult | WriteRowResult<row>> | InsertCommand<columnTypes, row, loaded, tableName, primaryKey> {
    let command = createInsertCommand(this, values, options)
    let runtime = getQueryInternals(this).runtime
    return runtime ? runtime.exec(command) as Promise<WriteResult | WriteRowResult<row>> : command
  }

  insertMany(
    this: Query<columnTypes, row, loaded, tableName, primaryKey, 'bound'>,
    values: Partial<row>[],
    options?: { returning?: ReturningInput<row>; touch?: boolean },
  ): Promise<WriteResult | WriteRowsResult<row>>
  insertMany(
    this: Query<columnTypes, row, loaded, tableName, primaryKey, 'unbound'>,
    values: Partial<row>[],
    options?: { returning?: ReturningInput<row>; touch?: boolean },
  ): InsertManyCommand<columnTypes, row, loaded, tableName, primaryKey>
  insertMany(
    values: Partial<row>[],
    options?: { returning?: ReturningInput<row>; touch?: boolean },
  ):
    | Promise<WriteResult | WriteRowsResult<row>>
    | InsertManyCommand<columnTypes, row, loaded, tableName, primaryKey> {
    let command = createInsertManyCommand(this, values, options)
    let runtime = getQueryInternals(this).runtime
    return runtime ? runtime.exec(command) as Promise<WriteResult | WriteRowsResult<row>> : command
  }

  update(
    this: Query<columnTypes, row, loaded, tableName, primaryKey, 'bound'>,
    changes: Partial<row>,
    options?: { returning?: ReturningInput<row>; touch?: boolean },
  ): Promise<WriteResult | WriteRowsResult<row>>
  update(
    this: Query<columnTypes, row, loaded, tableName, primaryKey, 'unbound'>,
    changes: Partial<row>,
    options?: { returning?: ReturningInput<row>; touch?: boolean },
  ): UpdateCommand<columnTypes, row, loaded, tableName, primaryKey>
  update(
    changes: Partial<row>,
    options?: { returning?: ReturningInput<row>; touch?: boolean },
  ):
    | Promise<WriteResult | WriteRowsResult<row>>
    | UpdateCommand<columnTypes, row, loaded, tableName, primaryKey> {
    let command = createUpdateCommand(this, changes, options)
    let runtime = getQueryInternals(this).runtime
    return runtime ? runtime.exec(command) as Promise<WriteResult | WriteRowsResult<row>> : command
  }

  delete(
    this: Query<columnTypes, row, loaded, tableName, primaryKey, 'bound'>,
    options?: { returning?: ReturningInput<row> },
  ): Promise<WriteResult | WriteRowsResult<row>>
  delete(
    this: Query<columnTypes, row, loaded, tableName, primaryKey, 'unbound'>,
    options?: { returning?: ReturningInput<row> },
  ): DeleteCommand<columnTypes, row, loaded, tableName, primaryKey>
  delete(
    options?: { returning?: ReturningInput<row> },
  ):
    | Promise<WriteResult | WriteRowsResult<row>>
    | DeleteCommand<columnTypes, row, loaded, tableName, primaryKey> {
    let command = createDeleteCommand(this, options)
    let runtime = getQueryInternals(this).runtime
    return runtime ? runtime.exec(command) as Promise<WriteResult | WriteRowsResult<row>> : command
  }

  upsert(
    this: Query<columnTypes, row, loaded, tableName, primaryKey, 'bound'>,
    values: Partial<row>,
    options?: {
      returning?: ReturningInput<row>
      touch?: boolean
      conflictTarget?: (keyof row & string)[]
      update?: Partial<row>
    },
  ): Promise<WriteResult | WriteRowResult<row>>
  upsert(
    this: Query<columnTypes, row, loaded, tableName, primaryKey, 'unbound'>,
    values: Partial<row>,
    options?: {
      returning?: ReturningInput<row>
      touch?: boolean
      conflictTarget?: (keyof row & string)[]
      update?: Partial<row>
    },
  ): UpsertCommand<columnTypes, row, loaded, tableName, primaryKey>
  upsert(
    values: Partial<row>,
    options?: {
      returning?: ReturningInput<row>
      touch?: boolean
      conflictTarget?: (keyof row & string)[]
      update?: Partial<row>
    },
  ):
    | Promise<WriteResult | WriteRowResult<row>>
    | UpsertCommand<columnTypes, row, loaded, tableName, primaryKey> {
    let command = createUpsertCommand(this, values, options)
    let runtime = getQueryInternals(this).runtime
    return runtime ? runtime.exec(command) as Promise<WriteResult | WriteRowResult<row>> : command
  }

  #clone(
    patch: Partial<QueryState>,
  ): Query<columnTypes, row, loaded, tableName, primaryKey, binding> {
    let internals = getQueryInternals(this)

    return createQueryWithState(
      internals.table as QueryTableInput<tableName, row, primaryKey>,
      {
        select: patch.select ?? cloneSelection(internals.state.select),
        distinct: patch.distinct ?? internals.state.distinct,
        joins: patch.joins ? [...patch.joins] : [...internals.state.joins],
        where: patch.where ? [...patch.where] : [...internals.state.where],
        groupBy: patch.groupBy ? [...patch.groupBy] : [...internals.state.groupBy],
        having: patch.having ? [...patch.having] : [...internals.state.having],
        orderBy: patch.orderBy ? [...patch.orderBy] : [...internals.state.orderBy],
        limit: patch.limit === undefined ? internals.state.limit : patch.limit,
        offset: patch.offset === undefined ? internals.state.offset : patch.offset,
        with: patch.with ? { ...patch.with } : { ...internals.state.with },
      },
      internals.runtime,
    ) as Query<columnTypes, row, loaded, tableName, primaryKey, binding>
  }

  #runtime(): QueryRuntime {
    let runtime = getQueryInternals(this).runtime

    if (!runtime) {
      throw new DataTableQueryError('Use db.exec(query) to execute an unbound Query')
    }

    return runtime
  }
}

export function query<
  tableName extends string,
  row extends Record<string, unknown>,
  primaryKey extends readonly (keyof row & string)[],
>(
  table: QueryTableInput<tableName, row, primaryKey>,
): Query<QueryColumnTypeMapFromRow<tableName, row>, row, {}, tableName, primaryKey, 'unbound'> {
  return new Query(table) as Query<
    QueryColumnTypeMapFromRow<tableName, row>,
    row,
    {},
    tableName,
    primaryKey,
    'unbound'
  >
}

export function bindQuery<
  columnTypes extends Record<string, unknown>,
  row extends Record<string, unknown>,
  loaded extends Record<string, unknown>,
  tableName extends string,
  primaryKey extends readonly string[],
>(
  input: Query<columnTypes, row, loaded, tableName, primaryKey, any>,
  runtime: QueryRuntime,
): Query<columnTypes, row, loaded, tableName, primaryKey, 'bound'> {
  let internals = getQueryInternals(input)

  return createQueryWithState(
    internals.table as QueryTableInput<tableName, row, primaryKey>,
    cloneQueryState(internals.state),
    runtime,
  ) as Query<columnTypes, row, loaded, tableName, primaryKey, 'bound'>
}

export function isQuery(input: unknown): input is Query<any, any, any, any, any, any> {
  return typeof input === 'object' && input !== null && queryInternals.has(input)
}

export function getQueryInternals(
  input: Query<any, any, any, any, any, any>,
): QueryInternals {
  let internals = queryInternals.get(input)

  if (!internals) {
    throw new DataTableQueryError('Query internals are unavailable')
  }

  return internals
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

export function createInitialQueryState(): QueryState {
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

function createQueryWithState(
  table: QueryTableInput<any, any, any>,
  state: QueryState,
  runtime?: QueryRuntime,
): Query<any, any, any, any, any, any> {
  let output = new Query(table)
  queryInternals.set(output, {
    table,
    state,
    runtime,
  })
  return output
}

function createFirstQuery(
  input: Query<any, any, any, any, any, any>,
): FirstQuery<any, any, any, any, any> {
  let internals = getQueryInternals(input)

  return {
    kind: 'first',
    table: internals.table as QueryTableInput<any, any, any>,
    state: cloneQueryState(internals.state),
  }
}

function createFindQuery(
  input: Query<any, any, any, any, any, any>,
  value: unknown,
): FindQuery<any, any, any, any, any> {
  let internals = getQueryInternals(input)

  return {
    kind: 'find',
    table: internals.table as QueryTableInput<any, any, any>,
    state: cloneQueryState(internals.state),
    value: value as never,
  }
}

function createCountQuery(
  input: Query<any, any, any, any, any, any>,
): CountQuery<any, any, any, any, any> {
  let internals = getQueryInternals(input)

  return {
    kind: 'count',
    table: internals.table as QueryTableInput<any, any, any>,
    state: cloneQueryState(internals.state),
  }
}

function createExistsQuery(
  input: Query<any, any, any, any, any, any>,
): ExistsQuery<any, any, any, any, any> {
  let internals = getQueryInternals(input)

  return {
    kind: 'exists',
    table: internals.table as QueryTableInput<any, any, any>,
    state: cloneQueryState(internals.state),
  }
}

function createInsertCommand(
  input: Query<any, any, any, any, any, any>,
  values: Record<string, unknown>,
  options?: { returning?: ReturningInput<Record<string, unknown>>; touch?: boolean },
): InsertCommand<any, any, any, any, any> {
  let internals = getQueryInternals(input)
  assertWriteState(internals.state, 'insert', {
    where: false,
    orderBy: false,
    limit: false,
    offset: false,
  })

  return {
    kind: 'insert',
    table: internals.table as QueryTableInput<any, any, any>,
    state: cloneQueryState(internals.state),
    values,
    options,
  }
}

function createInsertManyCommand(
  input: Query<any, any, any, any, any, any>,
  values: Record<string, unknown>[],
  options?: { returning?: ReturningInput<Record<string, unknown>>; touch?: boolean },
): InsertManyCommand<any, any, any, any, any> {
  let internals = getQueryInternals(input)
  assertWriteState(internals.state, 'insertMany', {
    where: false,
    orderBy: false,
    limit: false,
    offset: false,
  })

  return {
    kind: 'insertMany',
    table: internals.table as QueryTableInput<any, any, any>,
    state: cloneQueryState(internals.state),
    values,
    options,
  }
}

function createUpdateCommand(
  input: Query<any, any, any, any, any, any>,
  changes: Record<string, unknown>,
  options?: { returning?: ReturningInput<Record<string, unknown>>; touch?: boolean },
): UpdateCommand<any, any, any, any, any> {
  let internals = getQueryInternals(input)
  assertWriteState(internals.state, 'update', {
    where: true,
    orderBy: true,
    limit: true,
    offset: true,
  })

  return {
    kind: 'update',
    table: internals.table as QueryTableInput<any, any, any>,
    state: cloneQueryState(internals.state),
    changes,
    options,
  }
}

function createDeleteCommand(
  input: Query<any, any, any, any, any, any>,
  options?: { returning?: ReturningInput<Record<string, unknown>> },
): DeleteCommand<any, any, any, any, any> {
  let internals = getQueryInternals(input)
  assertWriteState(internals.state, 'delete', {
    where: true,
    orderBy: true,
    limit: true,
    offset: true,
  })

  return {
    kind: 'delete',
    table: internals.table as QueryTableInput<any, any, any>,
    state: cloneQueryState(internals.state),
    options,
  }
}

function createUpsertCommand(
  input: Query<any, any, any, any, any, any>,
  values: Record<string, unknown>,
  options?: {
    returning?: ReturningInput<Record<string, unknown>>
    touch?: boolean
    conflictTarget?: string[]
    update?: Record<string, unknown>
  },
): UpsertCommand<any, any, any, any, any> {
  let internals = getQueryInternals(input)
  assertWriteState(internals.state, 'upsert', {
    where: false,
    orderBy: false,
    limit: false,
    offset: false,
  })

  return {
    kind: 'upsert',
    table: internals.table as QueryTableInput<any, any, any>,
    state: cloneQueryState(internals.state),
    values,
    options: options as UpsertCommand<any, any, any, any, any>['options'],
  }
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
