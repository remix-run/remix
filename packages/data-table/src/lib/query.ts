import type { JoinType } from './adapter.ts'
import { DataTableQueryError } from './errors.ts'
import type {
  AnyQuerySource,
  BoundQueryPhase,
  MergeColumnTypeMaps,
  PrimaryKeyInputForRow,
  QueryColumnInput,
  QueryColumnName,
  QueryColumnTypeMap,
  QueryColumns,
  QueryPhase,
  QueryResultMap,
  QuerySourceColumnTypes,
  QuerySourcePrimaryKey,
  QuerySourceRow,
  QuerySourceTableName,
  RelationMapForSourceName,
  SelectedAliasRow,
  UnboundQueryPhase,
} from './query/types.ts'
import type { WriteResult, WriteRowResult, WriteRowsResult } from './database.ts'
import type { Predicate, WhereInput } from './operators.ts'
import { normalizeColumnInput } from './references.ts'
import type { LoadedRelationMap } from './table-relations.ts'
import type { AnyTable } from './table.ts'
import {
  assertWriteState,
  createPredicateColumnResolver,
  normalizePredicateValues,
  normalizeQueryWhereInput,
} from './query/predicate.ts'
import type {
  DeleteQueryOptions,
  InsertQueryOptions,
  QueryConfig,
  QueryConfigPatch,
  QueryExecutionMode,
  UpsertQueryOptions,
} from './query/config.ts'
import { cloneQueryConfig, createInitialQueryConfig, mergeQueryConfig } from './query/config.ts'
import { normalizeSelection } from './query/selection.ts'

export type AnyQuery = Query<any, any, any, any, any>

type QuerySource<input extends AnyQuery> =
  input extends Query<infer source, any, any, any, any> ? source : never

type QueryColumnTypes<input extends AnyQuery> =
  input extends Query<any, infer columnTypes, any, any, any> ? columnTypes : never

type QueryRow<input extends AnyQuery> =
  input extends Query<any, any, infer row, any, any> ? row : never

type QueryLoaded<input extends AnyQuery> =
  input extends Query<any, any, any, infer loaded, any> ? loaded : never

type QueryPhaseOf<input extends AnyQuery> =
  input extends Query<any, any, any, any, infer phase> ? phase : never

type QueryBinding<input extends AnyQuery> = QueryPhaseOf<input>['binding']

type QueryMode<input extends AnyQuery> = QueryPhaseOf<input>['mode']

type QueryPhaseBinding<phase extends QueryPhase> = phase['binding']

type QueryPhaseMode<phase extends QueryPhase> = phase['mode']

type QueryAllPhase<phase extends QueryPhase> = QueryPhase<QueryPhaseBinding<phase>, 'all'>

type QueryNextPhase<phase extends QueryPhase, mode extends QueryExecutionMode> = QueryPhase<
  QueryPhaseBinding<phase>,
  mode
>

type QueryTerminalResult<input extends AnyQuery, mode extends QueryExecutionMode, result> =
  QueryBinding<input> extends 'bound'
    ? Promise<result>
    : Query<
        QuerySource<input>,
        QueryColumnTypes<input>,
        QueryRow<input>,
        {},
        UnboundQueryPhase<mode>
      >

export type QueryExecutionResult<input> = input extends AnyQuery
  ? QueryResultMap<QueryRow<input>, QueryLoaded<input>>[Extract<
      QueryMode<input>,
      QueryExecutionMode
    >]
  : never

export type QueryRuntime = {
  exec<input extends AnyQuery>(input: input): Promise<QueryExecutionResult<input>>
}

export const querySnapshot = Symbol('querySnapshot')

export type QuerySnapshot<
  source extends AnyQuerySource = AnyQuerySource,
  row extends Record<string, unknown> = Record<string, unknown>,
  mode extends QueryExecutionMode = QueryExecutionMode,
> = {
  table: source
  config: QueryConfig<row, QuerySourcePrimaryKey<source>, mode>
}

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
  #config: QueryConfig<row, QuerySourcePrimaryKey<source>, QueryPhaseMode<phase>>
  #runtime?: QueryRuntime

  constructor(table: source, runtime?: QueryRuntime) {
    this.#table = table
    this.#config = createInitialQueryConfig() as QueryConfig<
      row,
      QuerySourcePrimaryKey<source>,
      QueryPhaseMode<phase>
    >
    this.#runtime = runtime
  }

  static #createInternal<
    source extends AnyQuerySource,
    columnTypes extends Record<string, unknown>,
    row extends Record<string, unknown>,
    loaded extends Record<string, unknown>,
    phase extends QueryPhase,
  >(
    table: source,
    config: QueryConfig<row, QuerySourcePrimaryKey<source>, QueryPhaseMode<phase>>,
    runtime?: QueryRuntime,
  ): Query<source, columnTypes, row, loaded, phase> {
    let output = new Query<source, columnTypes, row, loaded, phase>(table, runtime)

    output.#config = cloneQueryConfig(config)

    return output
  }

  select<selection extends (keyof row & string)[]>(
    this: Query<source, columnTypes, row, loaded, QueryAllPhase<phase>>,
    ...columns: selection
  ): Query<source, columnTypes, Pick<row, selection[number]>, loaded, QueryAllPhase<phase>>
  select<selection extends Record<string, QueryColumnInput<columnTypes>>>(
    this: Query<source, columnTypes, row, loaded, QueryAllPhase<phase>>,
    selection: selection,
  ): Query<
    source,
    columnTypes,
    SelectedAliasRow<columnTypes, selection>,
    loaded,
    QueryAllPhase<phase>
  >
  select(
    this: Query<source, columnTypes, row, loaded, QueryAllPhase<phase>>,
    ...input: [Record<string, QueryColumnInput<columnTypes>>] | (keyof row & string)[]
  ): Query<source, columnTypes, any, loaded, QueryAllPhase<phase>> {
    return this.#clone({ select: normalizeSelection<row, columnTypes>(input) }) as Query<
      source,
      columnTypes,
      any,
      loaded,
      QueryAllPhase<phase>
    >
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
    return this.#clone({
      where: [...this.#config.where, normalizeQueryWhereInput(input, this.#predicateTables())],
    })
  }

  having(
    this: Query<source, columnTypes, row, loaded, QueryAllPhase<phase>>,
    input: WhereInput<QueryColumns<columnTypes>>,
  ): Query<source, columnTypes, row, loaded, QueryAllPhase<phase>> {
    return this.#clone({
      having: [...this.#config.having, normalizeQueryWhereInput(input, this.#predicateTables())],
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
      createPredicateColumnResolver([...this.#predicateTables(), target]),
    )

    return this.#clone({
      joins: [...this.#config.joins, { type, table: target, on: normalizedOn }],
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
      orderBy: [...this.#config.orderBy, { column: normalizeColumnInput(column), direction }],
    })
  }

  groupBy(
    this: Query<source, columnTypes, row, loaded, QueryAllPhase<phase>>,
    ...columns: QueryColumnInput<columnTypes>[]
  ): Query<source, columnTypes, row, loaded, QueryAllPhase<phase>> {
    return this.#clone({
      groupBy: [...this.#config.groupBy, ...columns.map((column) => normalizeColumnInput(column))],
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
  ): Query<source, columnTypes, row, loaded & LoadedRelationMap<relations>, QueryAllPhase<phase>> {
    return this.#clone({
      with: {
        ...this.#config.with,
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
    return this.#boundRuntime().exec(this)
  }

  first(
    this: Query<source, columnTypes, row, loaded, QueryAllPhase<phase>>,
  ): QueryTerminalResult<
    Query<source, columnTypes, row, loaded, QueryAllPhase<phase>>,
    'first',
    (row & loaded) | null
  > {
    return this.#resolveTerminal({ ...this.#config, kind: 'first' })
  }

  find(
    this: Query<source, columnTypes, row, loaded, QueryAllPhase<phase>>,
    value: PrimaryKeyInputForRow<row, QuerySourcePrimaryKey<source>>,
  ): QueryTerminalResult<
    Query<source, columnTypes, row, loaded, QueryAllPhase<phase>>,
    'find',
    (row & loaded) | null
  > {
    return this.#resolveTerminal({ ...this.#config, kind: 'find', value })
  }

  count(
    this: Query<source, columnTypes, row, loaded, QueryAllPhase<phase>>,
  ): QueryTerminalResult<
    Query<source, columnTypes, row, loaded, QueryAllPhase<phase>>,
    'count',
    number
  > {
    return this.#resolveTerminal({ ...this.#config, kind: 'count' })
  }

  exists(
    this: Query<source, columnTypes, row, loaded, QueryAllPhase<phase>>,
  ): QueryTerminalResult<
    Query<source, columnTypes, row, loaded, QueryAllPhase<phase>>,
    'exists',
    boolean
  > {
    return this.#resolveTerminal({ ...this.#config, kind: 'exists' })
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
    assertWriteState(this.#config, 'insert', {
      where: false,
      orderBy: false,
      limit: false,
      offset: false,
    })

    return this.#resolveTerminal({ ...this.#config, kind: 'insert', values, options })
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
    assertWriteState(this.#config, 'insertMany', {
      where: false,
      orderBy: false,
      limit: false,
      offset: false,
    })

    return this.#resolveTerminal({ ...this.#config, kind: 'insertMany', values, options })
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
    assertWriteState(this.#config, 'update', {
      where: true,
      orderBy: true,
      limit: true,
      offset: true,
    })

    return this.#resolveTerminal({ ...this.#config, kind: 'update', changes, options })
  }

  delete(
    this: Query<source, columnTypes, row, loaded, QueryAllPhase<phase>>,
    options?: DeleteQueryOptions<row>,
  ): QueryTerminalResult<
    Query<source, columnTypes, row, loaded, QueryAllPhase<phase>>,
    'delete',
    WriteResult | WriteRowsResult<row>
  > {
    assertWriteState(this.#config, 'delete', {
      where: true,
      orderBy: true,
      limit: true,
      offset: true,
    })

    return this.#resolveTerminal({ ...this.#config, kind: 'delete', options })
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
    assertWriteState(this.#config, 'upsert', {
      where: false,
      orderBy: false,
      limit: false,
      offset: false,
    })

    return this.#resolveTerminal({ ...this.#config, kind: 'upsert', values, options })
  }

  [querySnapshot](): QuerySnapshot<source, row, QueryPhaseMode<phase>> {
    return {
      table: this.#table,
      config: cloneQueryConfig(this.#config),
    }
  }

  #resolveTerminal<nextMode extends QueryExecutionMode, result>(
    config: QueryConfig<row, QuerySourcePrimaryKey<source>, nextMode>,
  ): QueryTerminalResult<
    Query<source, columnTypes, row, loaded, QueryAllPhase<phase>>,
    nextMode,
    result
  > {
    let next = this.#withConfig(config)
    return (this.#runtime ? this.#runtime.exec(next) : next) as QueryTerminalResult<
      Query<source, columnTypes, row, loaded, QueryAllPhase<phase>>,
      nextMode,
      result
    >
  }

  #clone(patch: QueryConfigPatch): Query<source, columnTypes, row, loaded, phase> {
    return Query.#createInternal<source, columnTypes, row, loaded, phase>(
      this.#table,
      mergeQueryConfig(this.#config, patch),
      this.#runtime,
    )
  }

  #withConfig<nextMode extends QueryExecutionMode>(
    config: QueryConfig<row, QuerySourcePrimaryKey<source>, nextMode>,
  ): Query<source, columnTypes, row, loaded, QueryNextPhase<phase, nextMode>> {
    return Query.#createInternal<source, columnTypes, row, loaded, QueryNextPhase<phase, nextMode>>(
      this.#table,
      config,
      this.#runtime,
    )
  }

  #boundRuntime(): QueryRuntime {
    if (!this.#runtime) {
      throw new DataTableQueryError('Use db.exec(query) to execute an unbound Query')
    }

    return this.#runtime
  }

  #predicateTables(): AnyTable[] {
    return [this.#table, ...this.#config.joins.map((join: { table: AnyTable }) => join.table)]
  }
}

export function query<table extends AnyQuerySource>(
  table: table,
): Query<table, QuerySourceColumnTypes<table>, QuerySourceRow<table>, {}, UnboundQueryPhase<'all'>>
export function query<table extends AnyQuerySource>(
  table: table,
  runtime: QueryRuntime,
): Query<table, QuerySourceColumnTypes<table>, QuerySourceRow<table>, {}, BoundQueryPhase<'all'>>
export function query<table extends AnyQuerySource>(
  table: table,
  runtime?: QueryRuntime,
): Query<
  table,
  QuerySourceColumnTypes<table>,
  QuerySourceRow<table>,
  {},
  QueryPhase<'bound' | 'unbound', 'all'>
> {
  if (runtime) {
    return new Query<
      table,
      QuerySourceColumnTypes<table>,
      QuerySourceRow<table>,
      {},
      BoundQueryPhase<'all'>
    >(table, runtime)
  }

  return new Query<
    table,
    QuerySourceColumnTypes<table>,
    QuerySourceRow<table>,
    {},
    UnboundQueryPhase<'all'>
  >(table)
}

export type {
  BoundQueryPhase,
  CreateManyOptions,
  CreateOptions,
  DeleteOptions,
  FindManyOptions,
  FindOneOptions,
  MergeColumnTypeMaps,
  PrimaryKeyInputForRow,
  QueryColumnInput,
  QueryColumnName,
  QueryColumnTypeMap,
  QueryColumnTypeMapFromRow,
  QueryColumns,
  OrderByInput,
  OrderByTuple,
  QueryColumnTypesForTable,
  QueryTableInput,
  RelationMapForSourceName,
  SelectedAliasRow,
  ReturningInput,
  SingleTableColumn,
  SingleTableWhere,
  UnboundQueryPhase,
  UpdateManyOptions,
  UpdateOptions,
} from './query/types.ts'
export type { QueryConfig, QueryConfigPatch, QueryConfigState } from './query/config.ts'
export { cloneQueryConfig } from './query/config.ts'
