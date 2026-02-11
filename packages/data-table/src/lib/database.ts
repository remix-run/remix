import { parseSafe } from '@remix-run/data-schema'

import type {
  AdapterResult,
  CountStatement,
  DatabaseAdapter,
  DeleteStatement,
  ExistsStatement,
  InsertManyStatement,
  InsertStatement,
  JoinClause,
  JoinType,
  ReturningSelection,
  SelectColumn,
  SelectStatement,
  TransactionOptions,
  TransactionToken,
  UpdateStatement,
  UpsertStatement,
} from './adapter.ts'
import { DataTableAdapterError, DataTableQueryError, DataTableValidationError } from './errors.ts'
import type {
  AnyRelation,
  AnyTable,
  LoadedRelationMap,
  OrderByClause,
  OrderDirection,
  PrimaryKeyInput,
  Relation,
  RelationMapForTable,
  Table,
  TableRow,
} from './model.ts'
import { getCompositeKey, getPrimaryKeyObject } from './model.ts'
import type { Predicate, WhereInput } from './operators.ts'
import { and, eq, inList, normalizeWhereInput, or } from './operators.ts'
import type { SqlStatement } from './sql.ts'
import { rawSql, isSqlStatement } from './sql.ts'
import type { AdapterStatement } from './adapter.ts'

type QueryState<table extends AnyTable> = {
  select: '*' | SelectColumn[]
  distinct: boolean
  joins: JoinClause[]
  where: Predicate<string>[]
  groupBy: string[]
  having: Predicate<string>[]
  orderBy: OrderByClause[]
  limit?: number
  offset?: number
  with: RelationMapForTable<table>
}

type TableColumnName<table extends AnyTable> = keyof TableRow<table> & string
type QualifiedTableColumnName<table extends AnyTable> = `${table['name']}.${TableColumnName<table>}`
type QueryColumnName<table extends AnyTable> =
  | TableColumnName<table>
  | QualifiedTableColumnName<table>

type QueryColumnTypeMap<table extends AnyTable> = {
  [column in QueryColumnName<table>]: column extends TableColumnName<table>
    ? TableRow<table>[column]
    : column extends `${table['name']}.${infer name extends TableColumnName<table>}`
      ? TableRow<table>[name]
      : never
}

type MergeColumnTypeMaps<
  left extends Record<string, unknown>,
  right extends Record<string, unknown>,
> = {
  [column in Extract<keyof left | keyof right, string>]: column extends keyof right
    ? column extends keyof left
      ? left[column] | right[column]
      : right[column]
    : column extends keyof left
      ? left[column]
      : never
}

type QueryColumns<columnTypes extends Record<string, unknown>> = Extract<keyof columnTypes, string>

type SelectedAliasRow<
  columnTypes extends Record<string, unknown>,
  selection extends Record<string, QueryColumns<columnTypes>>,
> = {
  [alias in keyof selection]: selection[alias] extends keyof columnTypes
    ? columnTypes[selection[alias]]
    : never
}

type SavepointCounter = {
  value: number
}

type ReturningInput<table extends AnyTable> = '*' | (keyof TableRow<table> & string)[]

export type WriteResult = {
  affectedRows: number
  insertId?: unknown
}

export type WriteRowsResult<row> = WriteResult & {
  rows: row[]
}

export type WriteRowResult<row> = WriteResult & {
  row: row | null
}

export type Database = {
  adapter: DatabaseAdapter
  now(): unknown
  query<table extends AnyTable>(
    table: table,
  ): QueryBuilder<table, {}, QueryColumnTypeMap<table>, TableRow<table>>
  exec(statement: string | SqlStatement, values?: unknown[]): Promise<AdapterResult>
  transaction<result>(
    callback: (database: Database) => Promise<result>,
    options?: TransactionOptions,
  ): Promise<result>
}

class DatabaseRuntime implements Database {
  #adapter: DatabaseAdapter
  #token?: TransactionToken
  #now: () => unknown
  #savepointCounter: SavepointCounter

  constructor(options: {
    adapter: DatabaseAdapter
    token?: TransactionToken
    now: () => unknown
    savepointCounter: SavepointCounter
  }) {
    this.#adapter = options.adapter
    this.#token = options.token
    this.#now = options.now
    this.#savepointCounter = options.savepointCounter
  }

  get adapter(): DatabaseAdapter {
    return this.#adapter
  }

  now(): unknown {
    return this.#now()
  }

  query<table extends AnyTable>(
    table: table,
  ): QueryBuilder<table, {}, QueryColumnTypeMap<table>, TableRow<table>> {
    return new QueryBuilder(this, table, createInitialQueryState())
  }

  async exec(statement: string | SqlStatement, values: unknown[] = []): Promise<AdapterResult> {
    let sqlStatement = isSqlStatement(statement) ? statement : rawSql(statement, values)

    return this.execute({
      kind: 'raw',
      sql: sqlStatement,
    })
  }

  async transaction<result>(
    callback: (database: Database) => Promise<result>,
    options?: TransactionOptions,
  ): Promise<result> {
    if (!this.#token) {
      let token = await this.#adapter.beginTransaction(options)
      let transactionDatabase = new DatabaseRuntime({
        adapter: this.#adapter,
        token,
        now: this.#now,
        savepointCounter: this.#savepointCounter,
      })

      try {
        let result = await callback(transactionDatabase)
        await this.#adapter.commitTransaction(token)
        return result
      } catch (error) {
        await this.#adapter.rollbackTransaction(token)
        throw error
      }
    }

    if (!this.#adapter.capabilities.savepoints) {
      throw new DataTableQueryError('Nested transactions require adapter savepoint support')
    }

    let savepointName = 'sp_' + String(this.#savepointCounter.value)
    this.#savepointCounter.value += 1

    await this.#adapter.createSavepoint(this.#token, savepointName)

    try {
      let result = await callback(this)
      await this.#adapter.releaseSavepoint(this.#token, savepointName)
      return result
    } catch (error) {
      await this.#adapter.rollbackToSavepoint(this.#token, savepointName)
      await this.#adapter.releaseSavepoint(this.#token, savepointName)
      throw error
    }
  }

  async execute(statement: AdapterStatement): Promise<AdapterResult> {
    try {
      return await this.#adapter.execute({
        statement,
        transaction: this.#token,
      })
    } catch (error) {
      throw new DataTableAdapterError('Adapter execution failed', {
        cause: error,
        metadata: {
          dialect: this.#adapter.dialect,
          statementKind: statement.kind,
        },
      })
    }
  }
}

export function createDatabase(
  adapter: DatabaseAdapter,
  options?: { now?: () => unknown },
): Database {
  let now = options?.now ?? defaultNow

  return new DatabaseRuntime({
    adapter,
    token: undefined,
    now,
    savepointCounter: { value: 0 },
  })
}

export class QueryBuilder<
  table extends AnyTable,
  loaded extends Record<string, unknown> = {},
  columnTypes extends Record<string, unknown> = QueryColumnTypeMap<table>,
  row extends Record<string, unknown> = TableRow<table>,
> {
  #database: DatabaseRuntime
  #table: table
  #state: QueryState<table>

  constructor(database: DatabaseRuntime, table: table, state: QueryState<table>) {
    this.#database = database
    this.#table = table
    this.#state = state
  }

  select<selection extends (keyof TableRow<table> & string)[]>(
    ...columns: selection
  ): QueryBuilder<table, loaded, columnTypes, Pick<TableRow<table>, selection[number]>>
  select<selection extends Record<string, QueryColumns<columnTypes>>>(
    selection: selection,
  ): QueryBuilder<table, loaded, columnTypes, SelectedAliasRow<columnTypes, selection>>
  select(
    ...input: [Record<string, QueryColumns<columnTypes>>] | (keyof TableRow<table> & string)[]
  ): QueryBuilder<table, loaded, columnTypes, any> {
    if (
      input.length === 1 &&
      typeof input[0] === 'object' &&
      input[0] !== null &&
      !Array.isArray(input[0])
    ) {
      let selection = input[0] as Record<string, QueryColumns<columnTypes>>
      let aliases = Object.keys(selection)
      let select = aliases.map((alias) => ({
        column: selection[alias],
        alias,
      }))

      return this.#clone({ select }) as QueryBuilder<table, loaded, columnTypes, any>
    }

    let columns = input as (keyof TableRow<table> & string)[]

    return this.#clone({
      select: columns.map((column) => ({ column, alias: column })),
    }) as QueryBuilder<table, loaded, columnTypes, any>
  }

  distinct(value = true): QueryBuilder<table, loaded, columnTypes, row> {
    return this.#clone({ distinct: value })
  }

  where(input: WhereInput<QueryColumns<columnTypes>>): QueryBuilder<table, loaded, columnTypes, row> {
    let predicate = normalizeWhereInput(input)
    let normalizedPredicate = normalizePredicateValues(
      predicate,
      createPredicateColumnResolver([this.#table, ...this.#state.joins.map((join) => join.table)]),
    )

    return this.#clone({
      where: [...this.#state.where, normalizedPredicate],
    })
  }

  having(input: WhereInput<QueryColumns<columnTypes>>): QueryBuilder<table, loaded, columnTypes, row> {
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
    target: target,
    on: Predicate<QueryColumns<columnTypes> | QueryColumnName<target>>,
    type: JoinType = 'inner',
  ): QueryBuilder<
    table,
    loaded,
    MergeColumnTypeMaps<columnTypes, QueryColumnTypeMap<target>>,
    row
  > {
    let normalizedOn = normalizePredicateValues(
      on,
      createPredicateColumnResolver([
        this.#table,
        ...this.#state.joins.map((join) => join.table),
        target,
      ]),
    ) as Predicate<QueryColumns<columnTypes> | QueryColumnName<target>>

    return new QueryBuilder(this.#database, this.#table, {
      select: cloneSelection(this.#state.select),
      distinct: this.#state.distinct,
      joins: [...this.#state.joins, { type, table: target, on: normalizedOn }],
      where: [...this.#state.where],
      groupBy: [...this.#state.groupBy],
      having: [...this.#state.having],
      orderBy: [...this.#state.orderBy],
      limit: this.#state.limit,
      offset: this.#state.offset,
      with: { ...this.#state.with },
    }) as QueryBuilder<
      table,
      loaded,
      MergeColumnTypeMaps<columnTypes, QueryColumnTypeMap<target>>,
      row
    >
  }

  leftJoin<target extends AnyTable>(
    target: target,
    on: Predicate<QueryColumns<columnTypes> | QueryColumnName<target>>,
  ): QueryBuilder<
    table,
    loaded,
    MergeColumnTypeMaps<columnTypes, QueryColumnTypeMap<target>>,
    row
  > {
    return this.join(target, on, 'left')
  }

  rightJoin<target extends AnyTable>(
    target: target,
    on: Predicate<QueryColumns<columnTypes> | QueryColumnName<target>>,
  ): QueryBuilder<
    table,
    loaded,
    MergeColumnTypeMaps<columnTypes, QueryColumnTypeMap<target>>,
    row
  > {
    return this.join(target, on, 'right')
  }

  orderBy(
    column: QueryColumns<columnTypes>,
    direction: OrderDirection = 'asc',
  ): QueryBuilder<table, loaded, columnTypes, row> {
    return this.#clone({
      orderBy: [...this.#state.orderBy, { column, direction }],
    })
  }

  groupBy(...columns: QueryColumns<columnTypes>[]): QueryBuilder<table, loaded, columnTypes, row> {
    return this.#clone({
      groupBy: [...this.#state.groupBy, ...columns],
    })
  }

  limit(value: number): QueryBuilder<table, loaded, columnTypes, row> {
    return this.#clone({ limit: value })
  }

  offset(value: number): QueryBuilder<table, loaded, columnTypes, row> {
    return this.#clone({ offset: value })
  }

  with<relations extends RelationMapForTable<table>>(
    relations: relations,
  ): QueryBuilder<table, loaded & LoadedRelationMap<relations>, columnTypes, row> {
    return this.#clone({
      with: {
        ...this.#state.with,
        ...relations,
      },
    }) as QueryBuilder<table, loaded & LoadedRelationMap<relations>, columnTypes, row>
  }

  async all(): Promise<Array<row & loaded>> {
    let statement = this.#toSelectStatement()
    let result = await this.#database.execute(statement)
    let rows = normalizeRows(result.rows)

    if (Object.keys(this.#state.with).length === 0) {
      return rows as Array<row & loaded>
    }

    let rowsWithRelations = await loadRelationsForRows(
      this.#database,
      this.#table,
      rows,
      this.#state.with,
    )
    return rowsWithRelations as Array<row & loaded>
  }

  async first(): Promise<(row & loaded) | null> {
    let rows = await this.limit(1).all()
    return rows[0] ?? null
  }

  async find(value: PrimaryKeyInput<table>): Promise<(row & loaded) | null> {
    let where = getPrimaryKeyObject(this.#table, value)
    return this.where(where).first()
  }

  async count(): Promise<number> {
    let statement: CountStatement<table> = {
      kind: 'count',
      table: this.#table,
      joins: [...this.#state.joins],
      where: [...this.#state.where],
      groupBy: [...this.#state.groupBy],
      having: [...this.#state.having],
    }

    let result = await this.#database.execute(statement)

    if (result.rows && result.rows[0] && typeof result.rows[0].count === 'number') {
      return result.rows[0].count as number
    }

    if (result.rows) {
      return result.rows.length
    }

    return 0
  }

  async exists(): Promise<boolean> {
    let statement: ExistsStatement<table> = {
      kind: 'exists',
      table: this.#table,
      joins: [...this.#state.joins],
      where: [...this.#state.where],
      groupBy: [...this.#state.groupBy],
      having: [...this.#state.having],
    }

    let result = await this.#database.execute(statement)

    if (result.rows && result.rows[0] && typeof result.rows[0].exists === 'boolean') {
      return result.rows[0].exists as boolean
    }

    if (result.rows && result.rows[0] && typeof result.rows[0].count === 'number') {
      return Number(result.rows[0].count) > 0
    }

    return Boolean(result.rows && result.rows.length > 0)
  }

  async insert(
    values: Partial<TableRow<table>>,
    options?: { returning?: ReturningInput<table>; touch?: boolean },
  ): Promise<WriteResult | WriteRowResult<TableRow<table>>> {
    assertWriteState(
      this.#state,
      'insert',
      {
        where: false,
        orderBy: false,
        limit: false,
        offset: false,
      },
    )

    let preparedValues = prepareInsertValues(
      this.#table,
      values,
      this.#database.now(),
      options?.touch ?? true,
    )
    let returning = options?.returning

    if (returning && this.#database.adapter.capabilities.returning) {
      let statement: InsertStatement<table> = {
        kind: 'insert',
        table: this.#table,
        values: preparedValues,
        returning: normalizeReturningSelection(returning),
      }

      let result = await this.#database.execute(statement)
      let row = (normalizeRows(result.rows)[0] ?? null) as TableRow<table> | null

      return {
        affectedRows: result.affectedRows ?? 0,
        insertId: result.insertId,
        row,
      }
    }

    let statement: InsertStatement<table> = {
      kind: 'insert',
      table: this.#table,
      values: preparedValues,
    }

    let result = await this.#database.execute(statement)
    let metadata: WriteResult = {
      affectedRows: result.affectedRows ?? 0,
      insertId: result.insertId,
    }

    if (!returning) {
      return metadata
    }

    let row = await this.#loadInsertedRow(preparedValues, result.insertId, returning)

    return {
      ...metadata,
      row,
    }
  }

  async insertMany(
    values: Partial<TableRow<table>>[],
    options?: { returning?: ReturningInput<table>; touch?: boolean },
  ): Promise<WriteResult | WriteRowsResult<TableRow<table>>> {
    assertWriteState(
      this.#state,
      'insertMany',
      {
        where: false,
        orderBy: false,
        limit: false,
        offset: false,
      },
    )

    let preparedValues = values.map((value) =>
      prepareInsertValues(this.#table, value, this.#database.now(), options?.touch ?? true),
    )
    let returning = options?.returning

    if (returning && this.#database.adapter.capabilities.returning) {
      let statement: InsertManyStatement<table> = {
        kind: 'insertMany',
        table: this.#table,
        values: preparedValues,
        returning: normalizeReturningSelection(returning),
      }

      let result = await this.#database.execute(statement)

      return {
        affectedRows: result.affectedRows ?? 0,
        insertId: result.insertId,
        rows: normalizeRows(result.rows) as TableRow<table>[],
      }
    }

    let statement: InsertManyStatement<table> = {
      kind: 'insertMany',
      table: this.#table,
      values: preparedValues,
    }

    let result = await this.#database.execute(statement)
    let metadata: WriteResult = {
      affectedRows: result.affectedRows ?? 0,
      insertId: result.insertId,
    }

    if (!returning) {
      return metadata
    }

    let rows = await this.#loadInsertedRows(preparedValues, returning)

    return {
      ...metadata,
      rows,
    }
  }

  async update(
    changes: Partial<TableRow<table>>,
    options?: { returning?: ReturningInput<table>; touch?: boolean },
  ): Promise<WriteResult | WriteRowsResult<TableRow<table>>> {
    assertWriteState(
      this.#state,
      'update',
      {
        where: true,
        orderBy: true,
        limit: true,
        offset: true,
      },
    )

    let preparedChanges = prepareUpdateValues(
      this.#table,
      changes,
      this.#database.now(),
      options?.touch ?? true,
    )
    let returning = options?.returning

    if (Object.keys(preparedChanges).length === 0) {
      throw new DataTableQueryError('update() requires at least one change')
    }

    if (hasScopedWriteModifiers(this.#state)) {
      let table = this.#table
      let queryState = this.#state

      return this.#database.transaction(async (transactionDatabase: Database) => {
        let primaryKeys = await loadPrimaryKeyRowsForScope(transactionDatabase, table, queryState)
        let primaryKeyPredicate = buildPrimaryKeyPredicate(table, primaryKeys)

        if (!primaryKeyPredicate) {
          if (!returning) {
            return {
              affectedRows: 0,
              insertId: undefined,
            }
          }

          return {
            affectedRows: 0,
            insertId: undefined,
            rows: [],
          }
        }

        return transactionDatabase.query(table).where(primaryKeyPredicate).update(changes, options)
      })
    }

    if (returning && !this.#database.adapter.capabilities.returning) {
      let primaryKeys = await this.#loadCurrentPrimaryKeyRows()
      let statement: UpdateStatement<table> = {
        kind: 'update',
        table: this.#table,
        changes: preparedChanges,
        where: [...this.#state.where],
      }

      let result = await this.#database.execute(statement)
      let rows = await this.#loadRowsByPrimaryKeys(primaryKeys, returning)

      return {
        affectedRows: result.affectedRows ?? 0,
        insertId: result.insertId,
        rows,
      }
    }

    let statement: UpdateStatement<table> = {
      kind: 'update',
      table: this.#table,
      changes: preparedChanges,
      where: [...this.#state.where],
      returning: returning ? normalizeReturningSelection(returning) : undefined,
    }

    let result = await this.#database.execute(statement)

    if (!returning) {
      return {
        affectedRows: result.affectedRows ?? 0,
        insertId: result.insertId,
      }
    }

    return {
      affectedRows: result.affectedRows ?? 0,
      insertId: result.insertId,
      rows: normalizeRows(result.rows) as TableRow<table>[],
    }
  }

  async delete(options?: {
    returning?: ReturningInput<table>
  }): Promise<WriteResult | WriteRowsResult<TableRow<table>>> {
    assertWriteState(
      this.#state,
      'delete',
      {
        where: true,
        orderBy: true,
        limit: true,
        offset: true,
      },
    )

    let returning = options?.returning

    if (hasScopedWriteModifiers(this.#state)) {
      let table = this.#table
      let queryState = this.#state

      return this.#database.transaction(async (transactionDatabase: Database) => {
        let primaryKeys = await loadPrimaryKeyRowsForScope(transactionDatabase, table, queryState)
        let primaryKeyPredicate = buildPrimaryKeyPredicate(table, primaryKeys)

        if (!primaryKeyPredicate) {
          if (!returning) {
            return {
              affectedRows: 0,
              insertId: undefined,
            }
          }

          return {
            affectedRows: 0,
            insertId: undefined,
            rows: [],
          }
        }

        return transactionDatabase.query(table).where(primaryKeyPredicate).delete(options)
      })
    }

    if (returning && !this.#database.adapter.capabilities.returning) {
      let rowsBeforeDelete = await this.#selectCurrentRows(returning)
      let statement: DeleteStatement<table> = {
        kind: 'delete',
        table: this.#table,
        where: [...this.#state.where],
      }

      let result = await this.#database.execute(statement)

      return {
        affectedRows: result.affectedRows ?? 0,
        insertId: result.insertId,
        rows: rowsBeforeDelete,
      }
    }

    let statement: DeleteStatement<table> = {
      kind: 'delete',
      table: this.#table,
      where: [...this.#state.where],
      returning: returning ? normalizeReturningSelection(returning) : undefined,
    }

    let result = await this.#database.execute(statement)

    if (!returning) {
      return {
        affectedRows: result.affectedRows ?? 0,
        insertId: result.insertId,
      }
    }

    return {
      affectedRows: result.affectedRows ?? 0,
      insertId: result.insertId,
      rows: normalizeRows(result.rows) as TableRow<table>[],
    }
  }

  async upsert(
    values: Partial<TableRow<table>>,
    options?: {
      returning?: ReturningInput<table>
      touch?: boolean
      conflictTarget?: (keyof TableRow<table> & string)[]
      update?: Partial<TableRow<table>>
    },
  ): Promise<WriteResult | WriteRowResult<TableRow<table>>> {
    assertWriteState(
      this.#state,
      'upsert',
      {
        where: false,
        orderBy: false,
        limit: false,
        offset: false,
      },
    )

    if (!this.#database.adapter.capabilities.upsert) {
      throw new DataTableQueryError('Adapter does not support upsert')
    }

    let preparedValues = prepareInsertValues(
      this.#table,
      values,
      this.#database.now(),
      options?.touch ?? true,
    )
    let updateChanges = options?.update
      ? prepareUpdateValues(
          this.#table,
          options.update,
          this.#database.now(),
          options?.touch ?? true,
        )
      : undefined
    let returning = options?.returning

    if (returning && this.#database.adapter.capabilities.returning) {
      let statement: UpsertStatement<table> = {
        kind: 'upsert',
        table: this.#table,
        values: preparedValues,
        conflictTarget: options?.conflictTarget ? [...options.conflictTarget] : undefined,
        update: updateChanges,
        returning: normalizeReturningSelection(returning),
      }

      let result = await this.#database.execute(statement)
      let row = (normalizeRows(result.rows)[0] ?? null) as TableRow<table> | null

      return {
        affectedRows: result.affectedRows ?? 0,
        insertId: result.insertId,
        row,
      }
    }

    let statement: UpsertStatement<table> = {
      kind: 'upsert',
      table: this.#table,
      values: preparedValues,
      conflictTarget: options?.conflictTarget ? [...options.conflictTarget] : undefined,
      update: updateChanges,
    }

    let result = await this.#database.execute(statement)
    let metadata: WriteResult = {
      affectedRows: result.affectedRows ?? 0,
      insertId: result.insertId,
    }

    if (!returning) {
      return metadata
    }

    let row = await this.#loadInsertedRow(preparedValues, result.insertId, returning)

    return {
      ...metadata,
      row,
    }
  }

  #toSelectStatement(): SelectStatement<table> {
    return {
      kind: 'select',
      table: this.#table,
      select: cloneSelection(this.#state.select),
      distinct: this.#state.distinct,
      joins: [...this.#state.joins],
      where: [...this.#state.where],
      groupBy: [...this.#state.groupBy],
      having: [...this.#state.having],
      orderBy: [...this.#state.orderBy],
      limit: this.#state.limit,
      offset: this.#state.offset,
    }
  }

  #clone(patch: Partial<QueryState<table>>): QueryBuilder<table, loaded, columnTypes, row> {
    return new QueryBuilder(this.#database, this.#table, {
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
    })
  }

  async #loadInsertedRow(
    values: Record<string, unknown>,
    insertId: unknown,
    returning: ReturningInput<table>,
  ): Promise<TableRow<table> | null> {
    let keyObject = getInsertPrimaryKeyObject(this.#table, values, insertId)

    if (!keyObject) {
      throw new DataTableQueryError(
        'Cannot load returning row without adapter RETURNING support unless primary key values are available',
      )
    }

    let rows = await this.#loadRowsByPrimaryKeys([keyObject], returning)
    return rows[0] ?? null
  }

  async #loadInsertedRows(
    values: Record<string, unknown>[],
    returning: ReturningInput<table>,
  ): Promise<TableRow<table>[]> {
    let keyObjects: Record<string, unknown>[] = []

    for (let row of values) {
      let keyObject = getInsertPrimaryKeyObject(this.#table, row, undefined)

      if (!keyObject) {
        throw new DataTableQueryError(
          'insertMany returning fallback requires explicit primary key values when adapter RETURNING is unavailable',
        )
      }

      keyObjects.push(keyObject)
    }

    return this.#loadRowsByPrimaryKeys(keyObjects, returning)
  }

  async #loadRowsByPrimaryKeys(
    keyObjects: Record<string, unknown>[],
    returning: ReturningInput<table>,
  ): Promise<TableRow<table>[]> {
    if (keyObjects.length === 0) {
      return []
    }

    let query: QueryBuilder<table, {}, QueryColumnTypeMap<table>, any> = this.#database.query(
      this.#table,
    )
    let predicate = buildPrimaryKeyPredicate(this.#table, keyObjects)

    if (predicate) {
      query = query.where(predicate)
    }

    query = applyReturningSelection(query, returning)
    let rows = await query.all()

    return rows as TableRow<table>[]
  }

  async #selectCurrentRows(returning: ReturningInput<table>): Promise<TableRow<table>[]> {
    let query: QueryBuilder<table, {}, QueryColumnTypeMap<table>, any> = this.#database.query(
      this.#table,
    )

    for (let predicate of this.#state.where) {
      query = query.where(predicate as Predicate<QueryColumnName<table>>)
    }

    for (let clause of this.#state.orderBy) {
      query = query.orderBy(clause.column as QueryColumns<QueryColumnTypeMap<table>>, clause.direction)
    }

    if (this.#state.limit !== undefined) {
      query = query.limit(this.#state.limit)
    }

    if (this.#state.offset !== undefined) {
      query = query.offset(this.#state.offset)
    }

    query = applyReturningSelection(query, returning)

    let rows = await query.all()
    return rows as TableRow<table>[]
  }

  async #loadCurrentPrimaryKeyRows(): Promise<Record<string, unknown>[]> {
    let query: QueryBuilder<table, {}, QueryColumnTypeMap<table>, any> = this.#database.query(
      this.#table,
    )

    for (let predicate of this.#state.where) {
      query = query.where(predicate as Predicate<QueryColumnName<table>>)
    }

    for (let clause of this.#state.orderBy) {
      query = query.orderBy(clause.column as QueryColumns<QueryColumnTypeMap<table>>, clause.direction)
    }

    if (this.#state.limit !== undefined) {
      query = query.limit(this.#state.limit)
    }

    if (this.#state.offset !== undefined) {
      query = query.offset(this.#state.offset)
    }

    query = query.select(...(this.#table.primaryKey as (keyof TableRow<table> & string)[]))

    let rows = await query.all()
    let primaryKeys = this.#table.primaryKey as string[]

    return rows.map((row) => {
      let keyObject: Record<string, unknown> = {}

      for (let key of rowKeys(row as Record<string, unknown>, primaryKeys)) {
        keyObject[key] = (row as Record<string, unknown>)[key]
      }

      return keyObject
    })
  }
}

async function loadRelationsForRows(
  database: DatabaseRuntime,
  sourceTable: AnyTable,
  rows: Record<string, unknown>[],
  relationMap: RelationMapForTable<any>,
): Promise<Record<string, unknown>[]> {
  let output = rows.map((row) => ({ ...row }))

  let relationNames = Object.keys(relationMap)

  for (let relationName of relationNames) {
    let relation = relationMap[relationName]

    if (relation.sourceTable !== sourceTable) {
      throw new DataTableQueryError(
        'Relation "' +
          relationName +
          '" is not defined for source table "' +
          sourceTable.name +
          '"',
      )
    }

    let values = await resolveRelationValues(database, output, relation)
    let index = 0

    while (index < output.length) {
      output[index][relationName] = values[index]
      index += 1
    }
  }

  return output
}

async function resolveRelationValues(
  database: DatabaseRuntime,
  sourceRows: Record<string, unknown>[],
  relation: AnyRelation,
): Promise<unknown[]> {
  if (relation.relationKind === 'hasManyThrough') {
    return loadHasManyThroughValues(database, sourceRows, relation)
  }

  return loadDirectRelationValues(database, sourceRows, relation)
}

async function loadDirectRelationValues(
  database: DatabaseRuntime,
  sourceRows: Record<string, unknown>[],
  relation: AnyRelation,
): Promise<unknown[]> {
  if (sourceRows.length === 0) {
    return []
  }

  let sourceTuples = uniqueTuples(sourceRows, relation.sourceKey)

  if (sourceTuples.length === 0) {
    return sourceRows.map(() => relation.cardinality === 'many' ? [] : null)
  }

  let query = database.query(relation.targetTable)
  let linkPredicate = buildLinkPredicate(relation.targetKey, sourceTuples)

  if (linkPredicate) {
    query = query.where(linkPredicate as Predicate<QueryColumnName<typeof relation.targetTable>>)
  }

  query = applyRelationModifiers(query, relation, {
    includePagination: false,
  })

  let relatedRows = (await query.all()) as unknown as Record<string, unknown>[]
  let grouped = groupRowsByTuple(relatedRows, relation.targetKey)

  return sourceRows.map((sourceRow) => {
    let key = getCompositeKey(sourceRow, relation.sourceKey)
    let matches = grouped.get(key) ?? []
    let pagedMatches = applyPagination(matches, relation.modifiers.limit, relation.modifiers.offset)

    if (relation.cardinality === 'many') {
      return pagedMatches
    }

    return pagedMatches[0] ?? null
  })
}

async function loadHasManyThroughValues(
  database: DatabaseRuntime,
  sourceRows: Record<string, unknown>[],
  relation: AnyRelation,
): Promise<unknown[]> {
  if (!relation.through) {
    throw new DataTableQueryError('hasManyThrough relation is missing through metadata')
  }

  if (sourceRows.length === 0) {
    return []
  }

  let throughRelation = relation.through.relation
  let sourceTuples = uniqueTuples(sourceRows, throughRelation.sourceKey)

  if (sourceTuples.length === 0) {
    return sourceRows.map(() => [])
  }

  let throughQuery = database.query(throughRelation.targetTable)
  let throughPredicate = buildLinkPredicate(throughRelation.targetKey, sourceTuples)

  if (throughPredicate) {
    throughQuery = throughQuery.where(
      throughPredicate as Predicate<QueryColumnName<typeof throughRelation.targetTable>>,
    )
  }

  throughQuery = applyRelationModifiers(throughQuery, throughRelation, {
    includePagination: false,
  })

  let throughRows = (await throughQuery.all()) as unknown as Record<string, unknown>[]

  if (throughRows.length === 0) {
    return sourceRows.map(() => [])
  }

  let throughRowsBySource = groupRowsByTuple(throughRows, throughRelation.targetKey)
  let pagedThroughRowsBySource = new Map<string, Record<string, unknown>[]>()
  let pagedThroughRows: Record<string, unknown>[] = []

  for (let sourceRow of sourceRows) {
    let sourceKey = getCompositeKey(sourceRow, throughRelation.sourceKey)
    let matchedThroughRows = throughRowsBySource.get(sourceKey) ?? []
    let pagedMatchedRows = applyPagination(
      matchedThroughRows,
      throughRelation.modifiers.limit,
      throughRelation.modifiers.offset,
    )

    pagedThroughRowsBySource.set(sourceKey, pagedMatchedRows)
    pagedThroughRows.push(...pagedMatchedRows)
  }

  let throughTuples = uniqueTuples(pagedThroughRows, relation.through.throughSourceKey)

  if (throughTuples.length === 0) {
    return sourceRows.map(() => [])
  }

  let targetQuery = database.query(relation.targetTable)
  let targetPredicate = buildLinkPredicate(relation.through.throughTargetKey, throughTuples)

  if (targetPredicate) {
    targetQuery = targetQuery.where(
      targetPredicate as Predicate<QueryColumnName<typeof relation.targetTable>>,
    )
  }

  targetQuery = applyRelationModifiers(targetQuery, relation, {
    includePagination: false,
  })

  let relatedRows = (await targetQuery.all()) as unknown as Record<string, unknown>[]
  let targetRowsByThrough = groupRowsByTuple(relatedRows, relation.through.throughTargetKey)

  return sourceRows.map((sourceRow) => {
    let sourceKey = getCompositeKey(sourceRow, throughRelation.sourceKey)
    let matchedThroughRows = pagedThroughRowsBySource.get(sourceKey) ?? []
    let outputRows: Record<string, unknown>[] = []
    let seen = new Set<string>()

    for (let throughRow of matchedThroughRows) {
      let throughKey = getCompositeKey(throughRow, relation.through!.throughSourceKey)
      let rowsForThrough = targetRowsByThrough.get(throughKey) ?? []

      for (let row of rowsForThrough) {
        let rowIdentity = getCompositeKey(row, relation.targetTable.primaryKey)

        if (!seen.has(rowIdentity)) {
          seen.add(rowIdentity)
          outputRows.push(row)
        }
      }
    }

    return applyPagination(outputRows, relation.modifiers.limit, relation.modifiers.offset)
  })
}

function applyRelationModifiers<table extends AnyTable>(
  query: QueryBuilder<table, {}>,
  relation: Relation<any, table, any, any>,
  options: { includePagination: boolean },
): QueryBuilder<table, any> {
  let next = query

  for (let predicate of relation.modifiers.where) {
    next = next.where(predicate)
  }

  for (let clause of relation.modifiers.orderBy) {
    next = next.orderBy(clause.column as QueryColumns<QueryColumnTypeMap<table>>, clause.direction)
  }

  if (options.includePagination && relation.modifiers.limit !== undefined) {
    next = next.limit(relation.modifiers.limit)
  }

  if (options.includePagination && relation.modifiers.offset !== undefined) {
    next = next.offset(relation.modifiers.offset)
  }

  if (Object.keys(relation.modifiers.with).length > 0) {
    next = next.with(relation.modifiers.with)
  }

  return next
}

function applyPagination<row>(
  rows: row[],
  limit: number | undefined,
  offset: number | undefined,
): row[] {
  let offsetRows = offset === undefined ? rows : rows.slice(offset)
  return limit === undefined ? offsetRows : offsetRows.slice(0, limit)
}

function normalizeRows(rows: AdapterResult['rows']): Record<string, unknown>[] {
  if (!rows) {
    return []
  }

  return rows.map((row) => ({ ...row }))
}

function hasScopedWriteModifiers<table extends AnyTable>(state: QueryState<table>): boolean {
  return state.orderBy.length > 0 || state.limit !== undefined || state.offset !== undefined
}

type WriteStatePolicy = {
  where: boolean
  orderBy: boolean
  limit: boolean
  offset: boolean
}

function assertWriteState<table extends AnyTable>(
  state: QueryState<table>,
  operation: 'insert' | 'insertMany' | 'update' | 'delete' | 'upsert',
  policy: WriteStatePolicy,
): void {
  let unsupported: string[] = []

  if (state.select !== '*') {
    unsupported.push('select()')
  }

  if (state.distinct) {
    unsupported.push('distinct()')
  }

  if (state.joins.length > 0) {
    unsupported.push('join()')
  }

  if (state.groupBy.length > 0) {
    unsupported.push('groupBy()')
  }

  if (state.having.length > 0) {
    unsupported.push('having()')
  }

  if (Object.keys(state.with).length > 0) {
    unsupported.push('with()')
  }

  if (!policy.where && state.where.length > 0) {
    unsupported.push('where()')
  }

  if (!policy.orderBy && state.orderBy.length > 0) {
    unsupported.push('orderBy()')
  }

  if (!policy.limit && state.limit !== undefined) {
    unsupported.push('limit()')
  }

  if (!policy.offset && state.offset !== undefined) {
    unsupported.push('offset()')
  }

  if (unsupported.length > 0) {
    throw new DataTableQueryError(
      operation + '() does not support these query modifiers: ' + unsupported.join(', '),
    )
  }
}

async function loadPrimaryKeyRowsForScope<table extends AnyTable>(
  database: Database,
  table: table,
  state: QueryState<table>,
): Promise<Record<string, unknown>[]> {
  let query: QueryBuilder<table, {}, QueryColumnTypeMap<table>, any> = database.query(table)

  for (let predicate of state.where) {
    query = query.where(predicate as Predicate<QueryColumnName<table>>)
  }

  for (let clause of state.orderBy) {
    query = query.orderBy(clause.column as QueryColumns<QueryColumnTypeMap<table>>, clause.direction)
  }

  if (state.limit !== undefined) {
    query = query.limit(state.limit)
  }

  if (state.offset !== undefined) {
    query = query.offset(state.offset)
  }

  query = query.select(...(table.primaryKey as (keyof TableRow<table> & string)[]))

  let rows = await query.all()
  let primaryKeys = table.primaryKey as string[]

  return rows.map((row) => {
    let keyObject: Record<string, unknown> = {}

    for (let key of rowKeys(row as Record<string, unknown>, primaryKeys)) {
      keyObject[key] = (row as Record<string, unknown>)[key]
    }

    return keyObject
  })
}

function createInitialQueryState<table extends AnyTable>(): QueryState<table> {
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

function cloneSelection(selection: '*' | SelectColumn[]): '*' | SelectColumn[] {
  if (selection === '*') {
    return '*'
  }

  return selection.map((column) => ({ ...column }))
}

function defaultNow(): Date {
  return new Date()
}

function prepareInsertValues<table extends AnyTable>(
  table: table,
  values: Partial<TableRow<table>>,
  now: unknown,
  touch: boolean,
): Record<string, unknown> {
  let output = validatePartialRow(table, values)

  if (touch && table.timestamps) {
    let createdAt = table.timestamps.createdAt
    let updatedAt = table.timestamps.updatedAt

    if (
      Object.prototype.hasOwnProperty.call(table.columns, createdAt) &&
      output[createdAt] === undefined
    ) {
      output[createdAt] = now
    }

    if (
      Object.prototype.hasOwnProperty.call(table.columns, updatedAt) &&
      output[updatedAt] === undefined
    ) {
      output[updatedAt] = now
    }
  }

  return output
}

function prepareUpdateValues<table extends AnyTable>(
  table: table,
  values: Partial<TableRow<table>>,
  now: unknown,
  touch: boolean,
): Record<string, unknown> {
  let output = validatePartialRow(table, values)

  if (touch && table.timestamps) {
    let updatedAt = table.timestamps.updatedAt

    if (
      Object.prototype.hasOwnProperty.call(table.columns, updatedAt) &&
      output[updatedAt] === undefined
    ) {
      output[updatedAt] = now
    }
  }

  return output
}

function validatePartialRow<table extends AnyTable>(
  table: table,
  values: Partial<TableRow<table>>,
): Record<string, unknown> {
  let output: Record<string, unknown> = {}

  for (let key in values as Record<string, unknown>) {
    if (!Object.prototype.hasOwnProperty.call(values, key)) {
      continue
    }

    if (!Object.prototype.hasOwnProperty.call(table.columns, key)) {
      throw new DataTableValidationError(
        'Unknown column "' + key + '" for table "' + table.name + '"',
        [],
      )
    }

    let schema = table.columns[key]
    let inputValue = (values as Record<string, unknown>)[key]
    let result = parseSafe(schema as any, inputValue) as
      | { success: true; value: unknown }
      | { success: false; issues: ReadonlyArray<unknown> }

    if (!result.success) {
      throw new DataTableValidationError(
        'Invalid value for column "' + key + '" in table "' + table.name + '"',
        result.issues,
        {
          metadata: {
            table: table.name,
            column: key,
          },
        },
      )
    }

    output[key] = result.value
  }

  return output
}

type ResolvedPredicateColumn = {
  tableName: string
  columnName: string
  schema: unknown
}

function createPredicateColumnResolver(
  tables: AnyTable[],
): (column: string) => ResolvedPredicateColumn {
  let qualifiedColumns = new Map<string, ResolvedPredicateColumn>()
  let unqualifiedColumns = new Map<string, ResolvedPredicateColumn>()
  let ambiguousColumns = new Set<string>()

  for (let table of tables) {
    for (let columnName in table.columns) {
      if (!Object.prototype.hasOwnProperty.call(table.columns, columnName)) {
        continue
      }

      let resolvedColumn: ResolvedPredicateColumn = {
        tableName: table.name,
        columnName,
        schema: table.columns[columnName],
      }

      qualifiedColumns.set(table.name + '.' + columnName, resolvedColumn)

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

    if (qualified) {
      return qualified
    }

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

    if (
      (predicate.operator === 'eq' || predicate.operator === 'ne') &&
      (predicate.value === null || predicate.value === undefined)
    ) {
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

      let parsedValues = predicate.value.map((value) => parsePredicateValue(column, value))

      return {
        ...predicate,
        value: parsedValues,
      }
    }

    return {
      ...predicate,
      value: parsePredicateValue(column, predicate.value),
    }
  }

  if (predicate.type === 'between') {
    let column = resolveColumn(predicate.column)

    return {
      ...predicate,
      lower: parsePredicateValue(column, predicate.lower),
      upper: parsePredicateValue(column, predicate.upper),
    }
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

function parsePredicateValue(column: ResolvedPredicateColumn, value: unknown): unknown {
  let result = parseSafe(column.schema as any, value) as
    | { success: true; value: unknown }
    | { success: false; issues: ReadonlyArray<unknown> }

  if (!result.success) {
    throw new DataTableValidationError(
      'Invalid filter value for column "' + column.columnName + '" in table "' + column.tableName + '"',
      result.issues,
      {
        metadata: {
          table: column.tableName,
          column: column.columnName,
        },
      },
    )
  }

  return result.value
}

function uniqueTuples(rows: Record<string, unknown>[], columns: string[]): unknown[][] {
  let output: unknown[][] = []
  let seen = new Set<string>()

  for (let row of rows) {
    let tuple = columns.map((column) => row[column])
    let key = tuple.map(stringifyForKey).join('::')

    if (!seen.has(key)) {
      seen.add(key)
      output.push(tuple)
    }
  }

  return output
}

function buildLinkPredicate(targetColumns: string[], tuples: unknown[][]): Predicate | undefined {
  if (tuples.length === 0) {
    return undefined
  }

  if (targetColumns.length === 1) {
    return inList(
      targetColumns[0],
      tuples.map((tuple) => tuple[0]),
    )
  }

  let tuplePredicates = tuples.map((tuple) => {
    let comparisons = targetColumns.map((column, index) => eq(column, tuple[index]))

    return and(...comparisons)
  })

  return or(...tuplePredicates)
}

function groupRowsByTuple(
  rows: Record<string, unknown>[],
  columns: string[],
): Map<string, Record<string, unknown>[]> {
  let output = new Map<string, Record<string, unknown>[]>()

  for (let row of rows) {
    let key = getCompositeKey(row, columns)
    let group = output.get(key)

    if (group) {
      group.push(row)
      continue
    }

    output.set(key, [row])
  }

  return output
}

function stringifyForKey(value: unknown): string {
  if (value === null) {
    return 'null'
  }

  if (value === undefined) {
    return 'undefined'
  }

  if (value instanceof Date) {
    return 'date:' + value.toISOString()
  }

  if (typeof value === 'string') {
    return JSON.stringify(value)
  }

  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value)
  }

  return JSON.stringify(value)
}

function normalizeReturningSelection<table extends AnyTable>(
  returning: ReturningInput<table>,
): ReturningSelection {
  if (returning === '*') {
    return '*'
  }

  return [...returning]
}

function getInsertPrimaryKeyObject(
  table: AnyTable,
  values: Record<string, unknown>,
  insertId: unknown,
): Record<string, unknown> | null {
  let keyObject: Record<string, unknown> = {}

  for (let key of table.primaryKey) {
    if (Object.prototype.hasOwnProperty.call(values, key)) {
      keyObject[key] = values[key]
      continue
    }

    if (table.primaryKey.length === 1 && insertId !== undefined) {
      keyObject[key] = insertId
      continue
    }

    return null
  }

  return keyObject
}

function buildPrimaryKeyPredicate<table extends AnyTable>(
  table: table,
  keyObjects: Record<string, unknown>[],
): Predicate<TableColumnName<table>> | undefined {
  if (keyObjects.length === 0) {
    return undefined
  }

  if (table.primaryKey.length === 1) {
    let key = table.primaryKey[0] as TableColumnName<table>
    return inList(
      key,
      keyObjects.map((objectValue) => objectValue[key]),
    )
  }

  let predicates = keyObjects.map((objectValue) => {
    let comparisons = table.primaryKey.map((key) => {
      let typedKey = key as TableColumnName<table>
      return eq(typedKey, objectValue[typedKey])
    })

    return and(...comparisons)
  })

  return or(...predicates)
}

function applyReturningSelection<table extends AnyTable, selection extends ReturningInput<table>>(
  query: QueryBuilder<table, {}, QueryColumnTypeMap<table>, TableRow<table>>,
  returning: selection,
): QueryBuilder<
  table,
  {},
  QueryColumnTypeMap<table>,
  selection extends '*' ? TableRow<table> : Pick<TableRow<table>, selection[number]>
> {
  if (returning === '*') {
    return query as QueryBuilder<
      table,
      {},
      QueryColumnTypeMap<table>,
      selection extends '*' ? TableRow<table> : Pick<TableRow<table>, selection[number]>
    >
  }

  return query.select(...returning) as QueryBuilder<
    table,
    {},
    QueryColumnTypeMap<table>,
    selection extends '*' ? TableRow<table> : Pick<TableRow<table>, selection[number]>
  >
}

function rowKeys(row: Record<string, unknown>, keys: string[]): string[] {
  let output: string[] = []

  for (let key of keys) {
    if (Object.prototype.hasOwnProperty.call(row, key)) {
      output.push(key)
    }
  }

  return output
}
