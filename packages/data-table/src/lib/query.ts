import type { JoinType } from './adapter.ts'
import type {
  AnyQuerySource,
  MergeColumnTypeMaps,
  PrimaryKeyInputForRow,
  QueryColumnInput,
  QueryColumnName,
  QueryColumnTypeMap,
  QueryTableInput,
  QueryColumns,
  QueryResultMap,
  QuerySourceColumnTypes,
  QuerySourcePrimaryKey,
  QuerySourceRow,
  QuerySourceTableName,
  RelationMapForSourceName,
  SelectedAliasRow,
} from './query/types.ts'
import type { WriteResult, WriteRowResult, WriteRowsResult } from './database.ts'
import type { Predicate, WhereInput } from './operators.ts'
import { normalizeColumnInput } from './references.ts'
import type { LoadedRelationMap } from './table-relations.ts'
import type { AnyTable, TableName, TablePrimaryKey, TableRow } from './table.ts'
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

type QueryMode<input extends AnyQuery> =
  input extends Query<any, any, any, any, infer mode> ? mode : never

type QueryTerminalResult<input extends AnyQuery, mode extends QueryExecutionMode, result> =
  Query<QuerySource<input>, QueryColumnTypes<input>, QueryRow<input>, QueryLoaded<input>, mode>

export type QueryExecutionResult<input> = input extends AnyQuery
  ? QueryResultMap<QueryRow<input>, QueryLoaded<input>>[Extract<
      QueryMode<input>,
      QueryExecutionMode
    >]
  : never

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
  mode extends QueryExecutionMode = 'all',
> {
  declare readonly [queryTypeBrand]: {
    mode: mode
  }

  #table: source
  #config: QueryConfig<row, QuerySourcePrimaryKey<source>, mode>

  constructor(table: source) {
    this.#table = table
    this.#config = createInitialQueryConfig() as QueryConfig<row, QuerySourcePrimaryKey<source>, mode>
  }

  static #createInternal<
    source extends AnyQuerySource,
    columnTypes extends Record<string, unknown>,
    row extends Record<string, unknown>,
    loaded extends Record<string, unknown>,
    mode extends QueryExecutionMode,
  >(
    table: source,
    config: QueryConfig<row, QuerySourcePrimaryKey<source>, mode>,
  ): Query<source, columnTypes, row, loaded, mode> {
    let output = new Query<source, columnTypes, row, loaded, mode>(table)

    output.#config = cloneQueryConfig(config)

    return output
  }

  select<selection extends (keyof row & string)[]>(
    this: Query<source, columnTypes, row, loaded, 'all'>,
    ...columns: selection
  ): Query<source, columnTypes, Pick<row, selection[number]>, loaded, 'all'>
  select<selection extends Record<string, QueryColumnInput<columnTypes>>>(
    this: Query<source, columnTypes, row, loaded, 'all'>,
    selection: selection,
  ): Query<
    source,
    columnTypes,
    SelectedAliasRow<columnTypes, selection>,
    loaded,
    'all'
  >
  select(
    this: Query<source, columnTypes, row, loaded, 'all'>,
    ...input: [Record<string, QueryColumnInput<columnTypes>>] | (keyof row & string)[]
  ): Query<source, columnTypes, any, loaded, 'all'> {
    return this.#clone({ select: normalizeSelection<row, columnTypes>(input) }) as Query<
      source,
      columnTypes,
      any,
      loaded,
      'all'
    >
  }

  distinct(
    this: Query<source, columnTypes, row, loaded, 'all'>,
    value = true,
  ): Query<source, columnTypes, row, loaded, 'all'> {
    return this.#clone({ distinct: value })
  }

  where(
    this: Query<source, columnTypes, row, loaded, 'all'>,
    input: WhereInput<QueryColumns<columnTypes>>,
  ): Query<source, columnTypes, row, loaded, 'all'> {
    return this.#clone({
      where: [...this.#config.where, normalizeQueryWhereInput(input, this.#predicateTables())],
    })
  }

  having(
    this: Query<source, columnTypes, row, loaded, 'all'>,
    input: WhereInput<QueryColumns<columnTypes>>,
  ): Query<source, columnTypes, row, loaded, 'all'> {
    return this.#clone({
      having: [...this.#config.having, normalizeQueryWhereInput(input, this.#predicateTables())],
    })
  }

  join<target extends AnyTable>(
    this: Query<source, columnTypes, row, loaded, 'all'>,
    target: target,
    on: Predicate<QueryColumns<columnTypes> | QueryColumnName<target>>,
    type: JoinType = 'inner',
  ): Query<
    source,
    MergeColumnTypeMaps<columnTypes, QueryColumnTypeMap<target>>,
    row,
    loaded,
    'all'
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
      'all'
    >
  }

  leftJoin<target extends AnyTable>(
    this: Query<source, columnTypes, row, loaded, 'all'>,
    target: target,
    on: Predicate<QueryColumns<columnTypes> | QueryColumnName<target>>,
  ): Query<
    source,
    MergeColumnTypeMaps<columnTypes, QueryColumnTypeMap<target>>,
    row,
    loaded,
    'all'
  > {
    return this.join(target, on, 'left')
  }

  rightJoin<target extends AnyTable>(
    this: Query<source, columnTypes, row, loaded, 'all'>,
    target: target,
    on: Predicate<QueryColumns<columnTypes> | QueryColumnName<target>>,
  ): Query<
    source,
    MergeColumnTypeMaps<columnTypes, QueryColumnTypeMap<target>>,
    row,
    loaded,
    'all'
  > {
    return this.join(target, on, 'right')
  }

  orderBy(
    this: Query<source, columnTypes, row, loaded, 'all'>,
    column: QueryColumnInput<columnTypes>,
    direction: 'asc' | 'desc' = 'asc',
  ): Query<source, columnTypes, row, loaded, 'all'> {
    return this.#clone({
      orderBy: [...this.#config.orderBy, { column: normalizeColumnInput(column), direction }],
    })
  }

  groupBy(
    this: Query<source, columnTypes, row, loaded, 'all'>,
    ...columns: QueryColumnInput<columnTypes>[]
  ): Query<source, columnTypes, row, loaded, 'all'> {
    return this.#clone({
      groupBy: [...this.#config.groupBy, ...columns.map((column) => normalizeColumnInput(column))],
    })
  }

  limit(
    this: Query<source, columnTypes, row, loaded, 'all'>,
    value: number,
  ): Query<source, columnTypes, row, loaded, 'all'> {
    return this.#clone({ limit: value })
  }

  offset(
    this: Query<source, columnTypes, row, loaded, 'all'>,
    value: number,
  ): Query<source, columnTypes, row, loaded, 'all'> {
    return this.#clone({ offset: value })
  }

  with<relations extends RelationMapForSourceName<QuerySourceTableName<source>>>(
    this: Query<source, columnTypes, row, loaded, 'all'>,
    relations: relations,
  ): Query<source, columnTypes, row, loaded & LoadedRelationMap<relations>, 'all'> {
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
      'all'
    >
  }

  all(
    this: Query<source, columnTypes, row, loaded, 'all'>,
  ): Query<source, columnTypes, row, loaded, 'all'> {
    return this.#withConfig({ ...this.#config, kind: 'all' })
  }

  first(
    this: Query<source, columnTypes, row, loaded, 'all'>,
  ): QueryTerminalResult<
    Query<source, columnTypes, row, loaded, 'all'>,
    'first',
    (row & loaded) | null
  > {
    return this.#resolveTerminal({ ...this.#config, kind: 'first' })
  }

  find(
    this: Query<source, columnTypes, row, loaded, 'all'>,
    value: PrimaryKeyInputForRow<row, QuerySourcePrimaryKey<source>>,
  ): QueryTerminalResult<
    Query<source, columnTypes, row, loaded, 'all'>,
    'find',
    (row & loaded) | null
  > {
    return this.#resolveTerminal({ ...this.#config, kind: 'find', value })
  }

  count(
    this: Query<source, columnTypes, row, loaded, 'all'>,
  ): QueryTerminalResult<
    Query<source, columnTypes, row, loaded, 'all'>,
    'count',
    number
  > {
    return this.#resolveTerminal({ ...this.#config, kind: 'count' })
  }

  exists(
    this: Query<source, columnTypes, row, loaded, 'all'>,
  ): QueryTerminalResult<
    Query<source, columnTypes, row, loaded, 'all'>,
    'exists',
    boolean
  > {
    return this.#resolveTerminal({ ...this.#config, kind: 'exists' })
  }

  insert(
    this: Query<source, columnTypes, row, loaded, 'all'>,
    values: Partial<row>,
    options?: InsertQueryOptions<row>,
  ): QueryTerminalResult<
    Query<source, columnTypes, row, loaded, 'all'>,
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
    this: Query<source, columnTypes, row, loaded, 'all'>,
    values: Partial<row>[],
    options?: InsertQueryOptions<row>,
  ): QueryTerminalResult<
    Query<source, columnTypes, row, loaded, 'all'>,
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
    this: Query<source, columnTypes, row, loaded, 'all'>,
    changes: Partial<row>,
    options?: InsertQueryOptions<row>,
  ): QueryTerminalResult<
    Query<source, columnTypes, row, loaded, 'all'>,
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
    this: Query<source, columnTypes, row, loaded, 'all'>,
    options?: DeleteQueryOptions<row>,
  ): QueryTerminalResult<
    Query<source, columnTypes, row, loaded, 'all'>,
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
    this: Query<source, columnTypes, row, loaded, 'all'>,
    values: Partial<row>,
    options?: UpsertQueryOptions<row>,
  ): QueryTerminalResult<
    Query<source, columnTypes, row, loaded, 'all'>,
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

  [querySnapshot](): QuerySnapshot<source, row, mode> {
    return {
      table: this.#table,
      config: cloneQueryConfig(this.#config),
    }
  }

  #resolveTerminal<nextMode extends QueryExecutionMode, result>(
    config: QueryConfig<row, QuerySourcePrimaryKey<source>, nextMode>,
  ): QueryTerminalResult<
    Query<source, columnTypes, row, loaded, 'all'>,
    nextMode,
    result
  > {
    return this.#withConfig(config) as QueryTerminalResult<
      Query<source, columnTypes, row, loaded, 'all'>,
      nextMode,
      result
    >
  }

  #clone(patch: QueryConfigPatch): Query<source, columnTypes, row, loaded, mode> {
    return Query.#createInternal<source, columnTypes, row, loaded, mode>(
      this.#table,
      mergeQueryConfig(this.#config, patch),
    )
  }

  #withConfig<nextMode extends QueryExecutionMode>(
    config: QueryConfig<row, QuerySourcePrimaryKey<source>, nextMode>,
  ): Query<source, columnTypes, row, loaded, nextMode> {
    return Query.#createInternal<source, columnTypes, row, loaded, nextMode>(
      this.#table,
      config,
    )
  }

  #predicateTables(): AnyTable[] {
    return [this.#table, ...this.#config.joins.map((join: { table: AnyTable }) => join.table)]
  }
}

export function query<table extends AnyTable>(
  table: table,
): Query<
  QueryTableInput<TableName<table>, TableRow<table>, TablePrimaryKey<table>>,
  QueryColumnTypeMap<table>,
  TableRow<table>,
  {},
  'all'
>
export function query<table extends AnyQuerySource>(
  table: table,
): Query<table, QuerySourceColumnTypes<table>, QuerySourceRow<table>, {}, 'all'> {
  return new Query<table, QuerySourceColumnTypes<table>, QuerySourceRow<table>, {}, 'all'>(table)
}

export type {
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
  UpdateManyOptions,
  UpdateOptions,
} from './query/types.ts'
export type { QueryConfig, QueryConfigPatch, QueryConfigState } from './query/config.ts'
export { cloneQueryConfig } from './query/config.ts'
