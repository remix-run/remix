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

type QueryPlanMap<
  row extends Record<string, unknown>,
  primaryKey extends readonly string[],
> = {
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

type QueryExecutionMode = keyof QueryPlanMap<Record<string, unknown>, readonly string[]>

type QueryPhase<
  binding extends QueryBindingState = QueryBindingState,
  mode extends QueryExecutionMode = QueryExecutionMode,
> = {
  binding: binding
  mode: mode
}

export type BoundQueryPhase<mode extends QueryExecutionMode = QueryExecutionMode> = QueryPhase<
  'bound',
  mode
>

export type UnboundQueryPhase<mode extends QueryExecutionMode = QueryExecutionMode> = QueryPhase<
  'unbound',
  mode
>

type AnyQuerySource = QueryTableInput<string, Record<string, unknown>, readonly string[]>

type QuerySourceTableName<source extends AnyQuerySource> =
  source extends QueryTableInput<infer tableName, any, any> ? tableName : never

type QuerySourceRow<source extends AnyQuerySource> =
  source extends QueryTableInput<any, infer row, any> ? row : never

type QuerySourcePrimaryKey<source extends AnyQuerySource> =
  source extends QueryTableInput<any, any, infer primaryKey> ? primaryKey : never

type QuerySourceColumnTypes<source extends AnyQuerySource> = QueryColumnTypeMapFromRow<
  QuerySourceTableName<source>,
  QuerySourceRow<source>
>

type QueryPlan<
  row extends Record<string, unknown>,
  primaryKey extends readonly string[],
  mode extends QueryExecutionMode = QueryExecutionMode,
> = QueryPlanMap<row, primaryKey>[mode]

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

export type AnyQuery = Query<any, any, any, any, any>

type QuerySource<input extends AnyQuery> = input extends Query<infer source, any, any, any, any>
  ? source
  : never

type QueryColumnTypes<input extends AnyQuery> =
  input extends Query<any, infer columnTypes, any, any, any> ? columnTypes : never

type QueryRow<input extends AnyQuery> =
  input extends Query<any, any, infer row, any, any> ? row : never

type QueryLoaded<input extends AnyQuery> =
  input extends Query<any, any, any, infer loaded, any> ? loaded : never

type QueryPhaseOf<input extends AnyQuery> = input extends Query<any, any, any, any, infer phase>
  ? phase
  : never

type QueryBinding<input extends AnyQuery> = QueryPhaseOf<input>['binding']

type QueryMode<input extends AnyQuery> = QueryPhaseOf<input>['mode']

type QueryPhaseBinding<phase extends QueryPhase> = phase['binding']

type QueryPhaseMode<phase extends QueryPhase> = phase['mode']

type QueryAllPhase<phase extends QueryPhase> = QueryPhase<QueryPhaseBinding<phase>, 'all'>

type QueryNextPhase<phase extends QueryPhase, mode extends QueryExecutionMode> = QueryPhase<
  QueryPhaseBinding<phase>,
  mode
>

type QueryWith<input extends AnyQuery, phase extends QueryPhase> = Query<
  QuerySource<input>,
  QueryColumnTypes<input>,
  QueryRow<input>,
  QueryLoaded<input>,
  phase
>

type QueryTerminalResult<input extends AnyQuery, mode extends QueryExecutionMode, result> =
  QueryBinding<input> extends 'bound' ? Promise<result> : QueryWith<input, UnboundQueryPhase<mode>>

export type QueryExecutionResult<input> =
  input extends AnyQuery
    ? QueryResultMap<QueryRow<input>, QueryLoaded<input>>[Extract<QueryMode<input>, QueryExecutionMode>]
    : never

type QueryRuntime = {
  exec<input extends AnyQuery>(input: input): Promise<QueryExecutionResult<input>>
}

type QuerySnapshot<
  source extends AnyQuerySource = AnyQuerySource,
  row extends Record<string, unknown> = Record<string, unknown>,
  mode extends QueryExecutionMode = QueryExecutionMode,
> = {
  table: source
  state: QueryState
  plan: QueryPlan<row, QuerySourcePrimaryKey<source>, mode>
}

export const bindQueryRuntime = Symbol('bindQueryRuntime')
export const querySnapshot = Symbol('querySnapshot')

declare const queryTypeBrand: unique symbol

export class Query<
  source extends AnyQuerySource,
  columnTypes extends Record<string, unknown> = QuerySourceColumnTypes<source>,
  row extends Record<string, unknown> = QuerySourceRow<source>,
  loaded extends Record<string, unknown> = {},
  phase extends QueryPhase = UnboundQueryPhase<'all'>,
> {
  declare readonly [queryTypeBrand]: {
    binding: QueryPhaseBinding<phase>
    mode: QueryPhaseMode<phase>
  }

  #table: source
  #state: QueryState
  #plan: QueryPlan<row, QuerySourcePrimaryKey<source>, QueryPhaseMode<phase>>
  #runtime?: QueryRuntime

  constructor(table: source) {
    this.#table = table
    this.#state = createInitialQueryState()
    this.#plan = { kind: 'all' } as QueryPlan<
      row,
      QuerySourcePrimaryKey<source>,
      QueryPhaseMode<phase>
    >
  }

  static #createInternal<
    source extends AnyQuerySource,
    columnTypes extends Record<string, unknown>,
    row extends Record<string, unknown>,
    loaded extends Record<string, unknown>,
    phase extends QueryPhase,
  >(
    table: source,
    state: QueryState,
    plan: QueryPlan<row, QuerySourcePrimaryKey<source>, QueryPhaseMode<phase>>,
    runtime?: QueryRuntime,
  ): Query<source, columnTypes, row, loaded, phase> {
    let output = new Query(table) as Query<source, columnTypes, row, loaded, phase>

    output.#state = cloneQueryState(state)
    output.#plan = cloneQueryPlan(
      plan as QueryPlan<row, QuerySourcePrimaryKey<source>>,
    ) as QueryPlan<row, QuerySourcePrimaryKey<source>, QueryPhaseMode<phase>>
    output.#runtime = runtime

    return output
  }

  select<selection extends (keyof row & string)[]>(
    this: Query<source, columnTypes, row, loaded, QueryAllPhase<phase>>,
    ...columns: selection
  ): Query<source, columnTypes, Pick<row, selection[number]>, loaded, QueryAllPhase<phase>>
  select<selection extends Record<string, QueryColumnInput<columnTypes>>>(
    this: Query<source, columnTypes, row, loaded, QueryAllPhase<phase>>,
    selection: selection,
  ): Query<source, columnTypes, SelectedAliasRow<columnTypes, selection>, loaded, QueryAllPhase<phase>>
  select(
    this: Query<source, columnTypes, row, loaded, QueryAllPhase<phase>>,
    ...input: [Record<string, QueryColumnInput<columnTypes>>] | (keyof row & string)[]
  ): Query<source, columnTypes, any, loaded, QueryAllPhase<phase>> {
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

      return this.#clone({ select }) as Query<source, columnTypes, any, loaded, QueryAllPhase<phase>>
    }

    let columns = input as (keyof row & string)[]

    return this.#clone({
      select: columns.map((column) => ({ column, alias: column })),
    }) as Query<source, columnTypes, any, loaded, QueryAllPhase<phase>>
  }

  distinct(
    this: Query<source, columnTypes, row, loaded, QueryAllPhase<phase>>,
    value = true,
  ): Query<source, columnTypes, row, loaded, QueryAllPhase<phase>> {
    return this.#clone({ distinct: value })
  }

  where(
    this: Query<source, columnTypes, row, loaded, QueryAllPhase<phase>>,
    input: WhereInput<QueryColumns<columnTypes>>,
  ): Query<source, columnTypes, row, loaded, QueryAllPhase<phase>> {
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
    this: Query<source, columnTypes, row, loaded, QueryAllPhase<phase>>,
    input: WhereInput<QueryColumns<columnTypes>>,
  ): Query<source, columnTypes, row, loaded, QueryAllPhase<phase>> {
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
    this: Query<source, columnTypes, row, loaded, QueryAllPhase<phase>>,
    target: target,
    on: Predicate<QueryColumns<columnTypes> | QueryColumnName<target>>,
    type: JoinType = 'inner',
  ): Query<
    source,
    MergeColumnTypeMaps<columnTypes, QueryColumnTypeMap<target>>,
    row,
    loaded,
    QueryAllPhase<phase>
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
      source,
      MergeColumnTypeMaps<columnTypes, QueryColumnTypeMap<target>>,
      row,
      loaded,
      QueryAllPhase<phase>
    >
  }

  leftJoin<target extends AnyTable>(
    this: Query<source, columnTypes, row, loaded, QueryAllPhase<phase>>,
    target: target,
    on: Predicate<QueryColumns<columnTypes> | QueryColumnName<target>>,
  ): Query<
    source,
    MergeColumnTypeMaps<columnTypes, QueryColumnTypeMap<target>>,
    row,
    loaded,
    QueryAllPhase<phase>
  > {
    return this.join(target, on, 'left')
  }

  rightJoin<target extends AnyTable>(
    this: Query<source, columnTypes, row, loaded, QueryAllPhase<phase>>,
    target: target,
    on: Predicate<QueryColumns<columnTypes> | QueryColumnName<target>>,
  ): Query<
    source,
    MergeColumnTypeMaps<columnTypes, QueryColumnTypeMap<target>>,
    row,
    loaded,
    QueryAllPhase<phase>
  > {
    return this.join(target, on, 'right')
  }

  orderBy(
    this: Query<source, columnTypes, row, loaded, QueryAllPhase<phase>>,
    column: QueryColumnInput<columnTypes>,
    direction: 'asc' | 'desc' = 'asc',
  ): Query<source, columnTypes, row, loaded, QueryAllPhase<phase>> {
    return this.#clone({
      orderBy: [...this.#state.orderBy, { column: normalizeColumnInput(column), direction }],
    })
  }

  groupBy(
    this: Query<source, columnTypes, row, loaded, QueryAllPhase<phase>>,
    ...columns: QueryColumnInput<columnTypes>[]
  ): Query<source, columnTypes, row, loaded, QueryAllPhase<phase>> {
    return this.#clone({
      groupBy: [...this.#state.groupBy, ...columns.map((column) => normalizeColumnInput(column))],
    })
  }

  limit(
    this: Query<source, columnTypes, row, loaded, QueryAllPhase<phase>>,
    value: number,
  ): Query<source, columnTypes, row, loaded, QueryAllPhase<phase>> {
    return this.#clone({ limit: value })
  }

  offset(
    this: Query<source, columnTypes, row, loaded, QueryAllPhase<phase>>,
    value: number,
  ): Query<source, columnTypes, row, loaded, QueryAllPhase<phase>> {
    return this.#clone({ offset: value })
  }

  with<relations extends RelationMapForSourceName<QuerySourceTableName<source>>>(
    this: Query<source, columnTypes, row, loaded, QueryAllPhase<phase>>,
    relations: relations,
  ): Query<
    source,
    columnTypes,
    row,
    loaded & LoadedRelationMap<relations>,
    QueryAllPhase<phase>
  > {
    return this.#clone({
      with: {
        ...this.#state.with,
        ...relations,
      },
    }) as Query<
      source,
      columnTypes,
      row,
      loaded & LoadedRelationMap<relations>,
      QueryAllPhase<phase>
    >
  }

  all(
    this: Query<source, columnTypes, row, loaded, BoundQueryPhase<'all'>>,
  ): Promise<Array<row & loaded>> {
    return this.#boundRuntime().exec(this) as Promise<Array<row & loaded>>
  }

  first(
    this: Query<source, columnTypes, row, loaded, QueryAllPhase<phase>>,
  ): QueryTerminalResult<
    Query<source, columnTypes, row, loaded, QueryAllPhase<phase>>,
    'first',
    (row & loaded) | null
  > {
    return this.#resolveTerminal({ kind: 'first' })
  }

  find(
    this: Query<source, columnTypes, row, loaded, QueryAllPhase<phase>>,
    value: PrimaryKeyInputForRow<row, QuerySourcePrimaryKey<source>>,
  ): QueryTerminalResult<
    Query<source, columnTypes, row, loaded, QueryAllPhase<phase>>,
    'find',
    (row & loaded) | null
  > {
    return this.#resolveTerminal({ kind: 'find', value })
  }

  count(
    this: Query<source, columnTypes, row, loaded, QueryAllPhase<phase>>,
  ): QueryTerminalResult<
    Query<source, columnTypes, row, loaded, QueryAllPhase<phase>>,
    'count',
    number
  > {
    return this.#resolveTerminal({ kind: 'count' })
  }

  exists(
    this: Query<source, columnTypes, row, loaded, QueryAllPhase<phase>>,
  ): QueryTerminalResult<
    Query<source, columnTypes, row, loaded, QueryAllPhase<phase>>,
    'exists',
    boolean
  > {
    return this.#resolveTerminal({ kind: 'exists' })
  }

  insert(
    this: Query<source, columnTypes, row, loaded, QueryAllPhase<phase>>,
    values: Partial<row>,
    options?: InsertQueryOptions<row>,
  ): QueryTerminalResult<
    Query<source, columnTypes, row, loaded, QueryAllPhase<phase>>,
    'insert',
    WriteResult | WriteRowResult<row>
  > {
    assertWriteState(this.#state, 'insert', {
      where: false,
      orderBy: false,
      limit: false,
      offset: false,
    })

    return this.#resolveTerminal({ kind: 'insert', values, options })
  }

  insertMany(
    this: Query<source, columnTypes, row, loaded, QueryAllPhase<phase>>,
    values: Partial<row>[],
    options?: InsertQueryOptions<row>,
  ): QueryTerminalResult<
    Query<source, columnTypes, row, loaded, QueryAllPhase<phase>>,
    'insertMany',
    WriteResult | WriteRowsResult<row>
  > {
    assertWriteState(this.#state, 'insertMany', {
      where: false,
      orderBy: false,
      limit: false,
      offset: false,
    })

    return this.#resolveTerminal({ kind: 'insertMany', values, options })
  }

  update(
    this: Query<source, columnTypes, row, loaded, QueryAllPhase<phase>>,
    changes: Partial<row>,
    options?: InsertQueryOptions<row>,
  ): QueryTerminalResult<
    Query<source, columnTypes, row, loaded, QueryAllPhase<phase>>,
    'update',
    WriteResult | WriteRowsResult<row>
  > {
    assertWriteState(this.#state, 'update', {
      where: true,
      orderBy: true,
      limit: true,
      offset: true,
    })

    return this.#resolveTerminal({ kind: 'update', changes, options })
  }

  delete(
    this: Query<source, columnTypes, row, loaded, QueryAllPhase<phase>>,
    options?: DeleteQueryOptions<row>,
  ): QueryTerminalResult<
    Query<source, columnTypes, row, loaded, QueryAllPhase<phase>>,
    'delete',
    WriteResult | WriteRowsResult<row>
  > {
    assertWriteState(this.#state, 'delete', {
      where: true,
      orderBy: true,
      limit: true,
      offset: true,
    })

    return this.#resolveTerminal({ kind: 'delete', options })
  }

  upsert(
    this: Query<source, columnTypes, row, loaded, QueryAllPhase<phase>>,
    values: Partial<row>,
    options?: UpsertQueryOptions<row>,
  ): QueryTerminalResult<
    Query<source, columnTypes, row, loaded, QueryAllPhase<phase>>,
    'upsert',
    WriteResult | WriteRowResult<row>
  > {
    assertWriteState(this.#state, 'upsert', {
      where: false,
      orderBy: false,
      limit: false,
      offset: false,
    })

    return this.#resolveTerminal({ kind: 'upsert', values, options })
  }

  [querySnapshot](): QuerySnapshot<source, row, QueryPhaseMode<phase>> {
    return this.#snapshot()
  }

  #resolveTerminal<nextMode extends QueryExecutionMode, result>(
    plan: QueryPlan<row, QuerySourcePrimaryKey<source>, nextMode>,
  ): QueryTerminalResult<
    Query<source, columnTypes, row, loaded, QueryAllPhase<phase>>,
    nextMode,
    result
  > {
    let next = this.#withPlan(plan)
    return (this.#runtime ? this.#runtime.exec(next) : next) as QueryTerminalResult<
      Query<source, columnTypes, row, loaded, QueryAllPhase<phase>>,
      nextMode,
      result
    >
  }

  [bindQueryRuntime](
    runtime: QueryRuntime,
  ): Query<source, columnTypes, row, loaded, BoundQueryPhase<QueryPhaseMode<phase>>> {
    return Query.#createInternal<
      source,
      columnTypes,
      row,
      loaded,
      BoundQueryPhase<QueryPhaseMode<phase>>
    >(
      this.#table,
      this.#state,
      this.#plan as QueryPlan<row, QuerySourcePrimaryKey<source>, QueryPhaseMode<phase>>,
      runtime,
    )
  }

  #clone(
    patch: Partial<QueryState>,
  ): Query<source, columnTypes, row, loaded, phase> {
    return Query.#createInternal<source, columnTypes, row, loaded, phase>(
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
      this.#plan as QueryPlan<row, QuerySourcePrimaryKey<source>, QueryPhaseMode<phase>>,
      this.#runtime,
    )
  }

  #withPlan<nextMode extends QueryExecutionMode>(
    plan: QueryPlan<row, QuerySourcePrimaryKey<source>, nextMode>,
  ): Query<source, columnTypes, row, loaded, QueryNextPhase<phase, nextMode>> {
    return Query.#createInternal<
      source,
      columnTypes,
      row,
      loaded,
      QueryNextPhase<phase, nextMode>
    >(this.#table, this.#state, plan, this.#runtime)
  }

  #snapshot(): QuerySnapshot<source, row, QueryPhaseMode<phase>> {
    return {
      table: this.#table,
      state: cloneQueryState(this.#state),
      plan: cloneQueryPlan(
        this.#plan as QueryPlan<row, QuerySourcePrimaryKey<source>>,
      ) as QueryPlan<row, QuerySourcePrimaryKey<source>, QueryPhaseMode<phase>>,
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
  QueryTableInput<tableName, row, primaryKey>,
  QueryColumnTypeMapFromRow<tableName, row>,
  row,
  {},
  UnboundQueryPhase<'all'>
> {
  return new Query(table) as Query<
    QueryTableInput<tableName, row, primaryKey>,
    QueryColumnTypeMapFromRow<tableName, row>,
    row,
    {},
    UnboundQueryPhase<'all'>
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
