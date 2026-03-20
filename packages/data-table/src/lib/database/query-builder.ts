import type {
  CountOperation,
  DataManipulationResult,
  DeleteOperation,
  ExistsOperation,
  InsertManyOperation,
  InsertOperation,
  JoinType,
  SelectColumn,
  SelectOperation,
  UpdateOperation,
  UpsertOperation,
} from '../adapter.ts'
import { DataTableQueryError, DataTableValidationError } from '../errors.ts'
import type {
  MergeColumnTypeMaps,
  PrimaryKeyInputForRow,
  QueryColumnInput,
  QueryColumnName,
  QueryColumnTypeMap,
  QueryColumns,
  RelationMapForSourceName,
  ReturningInput,
  SelectedAliasRow,
  WriteResult,
  WriteRowResult,
  WriteRowsResult,
} from '../database.ts'
import type { Predicate, WhereInput } from '../operators.ts'
import { normalizeWhereInput } from '../operators.ts'
import type { QueryState } from '../query.ts'
import { normalizeColumnInput } from '../references.ts'
import type { AnyTable, LoadedRelationMap } from '../table.ts'
import { getPrimaryKeyObject, getTableColumns, getTableName } from '../table.ts'

import {
  executeOperation,
  loadRowsWithRelations,
  type QueryExecutionContext,
} from './execution-context.ts'
import {
  buildPrimaryKeyPredicate,
  hasScopedWriteModifiers,
  loadPrimaryKeyRowsForScope,
} from './helpers.ts'
import { loadRelationsForRows } from './relations.ts'
import {
  applyAfterReadHooksToLoadedRows,
  applyAfterReadHooksToRows,
  assertReturningCapability,
  normalizeReturningSelection,
  prepareInsertValues,
  prepareUpdateValues,
  runAfterDeleteHook,
  runAfterWriteHook,
  runBeforeDeleteHook,
} from './write-lifecycle.ts'

/**
 * Immutable query builder used by `db.query(table)`.
 */
export class QueryBuilder<
  columnTypes extends Record<string, unknown>,
  row extends Record<string, unknown>,
  loaded extends Record<string, unknown> = {},
  tableName extends string = string,
  primaryKey extends readonly string[] = readonly string[],
> {
  #database: QueryExecutionContext
  #table: AnyTable
  #state: QueryState

  constructor(database: QueryExecutionContext, table: AnyTable, state: QueryState) {
    this.#database = database
    this.#table = table
    this.#state = state
  }

  /**
   * Narrows selected columns, optionally with aliases.
   */
  select<selection extends (keyof row & string)[]>(
    ...columns: selection
  ): QueryBuilder<columnTypes, Pick<row, selection[number]>, loaded, tableName, primaryKey>
  select<selection extends Record<string, QueryColumnInput<columnTypes>>>(
    selection: selection,
  ): QueryBuilder<
    columnTypes,
    SelectedAliasRow<columnTypes, selection>,
    loaded,
    tableName,
    primaryKey
  >
  select(
    ...input: [Record<string, QueryColumnInput<columnTypes>>] | (keyof row & string)[]
  ): QueryBuilder<columnTypes, any, loaded, tableName, primaryKey> {
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

      return this.#clone({ select }) as QueryBuilder<
        columnTypes,
        any,
        loaded,
        tableName,
        primaryKey
      >
    }

    let columns = input as (keyof row & string)[]

    return this.#clone({
      select: columns.map((column) => ({ column, alias: column })),
    }) as QueryBuilder<columnTypes, any, loaded, tableName, primaryKey>
  }

  /**
   * Toggles `distinct` selection.
   * @param value When `true`, eliminates duplicate rows.
   * @returns A cloned query builder with updated distinct state.
   */
  distinct(value = true): QueryBuilder<columnTypes, row, loaded, tableName, primaryKey> {
    return this.#clone({ distinct: value })
  }

  /**
   * Adds a where predicate.
   * @param input Predicate expression or column-value shorthand.
   * @returns A cloned query builder with the appended where predicate.
   */
  where(
    input: WhereInput<QueryColumns<columnTypes>>,
  ): QueryBuilder<columnTypes, row, loaded, tableName, primaryKey> {
    let predicate = normalizeWhereInput(input)
    let normalizedPredicate = normalizePredicateValues(
      predicate,
      createPredicateColumnResolver([this.#table, ...this.#state.joins.map((join) => join.table)]),
    )

    return this.#clone({
      where: [...this.#state.where, normalizedPredicate],
    })
  }

  /**
   * Adds a having predicate.
   * @param input Predicate expression or aggregate filter shorthand.
   * @returns A cloned query builder with the appended having predicate.
   */
  having(
    input: WhereInput<QueryColumns<columnTypes>>,
  ): QueryBuilder<columnTypes, row, loaded, tableName, primaryKey> {
    let predicate = normalizeWhereInput(input)
    let normalizedPredicate = normalizePredicateValues(
      predicate,
      createPredicateColumnResolver([this.#table, ...this.#state.joins.map((join) => join.table)]),
    )

    return this.#clone({
      having: [...this.#state.having, normalizedPredicate],
    })
  }

  /**
   * Adds a join clause.
   * @param target Target table to join.
   * @param on Join predicate.
   * @param type Join type.
   * @returns A query builder whose column map includes joined table columns.
   */
  join<target extends AnyTable>(
    target: target,
    on: Predicate<QueryColumns<columnTypes> | QueryColumnName<target>>,
    type: JoinType = 'inner',
  ): QueryBuilder<
    MergeColumnTypeMaps<columnTypes, QueryColumnTypeMap<target>>,
    row,
    loaded,
    tableName,
    primaryKey
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
      MergeColumnTypeMaps<columnTypes, QueryColumnTypeMap<target>>,
      row,
      loaded,
      tableName,
      primaryKey
    >
  }

  /**
   * Adds a left join clause.
   * @param target Target table to join.
   * @param on Join predicate.
   * @returns A query builder whose column map includes joined table columns.
   */
  leftJoin<target extends AnyTable>(
    target: target,
    on: Predicate<QueryColumns<columnTypes> | QueryColumnName<target>>,
  ): QueryBuilder<
    MergeColumnTypeMaps<columnTypes, QueryColumnTypeMap<target>>,
    row,
    loaded,
    tableName,
    primaryKey
  > {
    return this.join(target, on, 'left')
  }

  /**
   * Adds a right join clause.
   * @param target Target table to join.
   * @param on Join predicate.
   * @returns A query builder whose column map includes joined table columns.
   */
  rightJoin<target extends AnyTable>(
    target: target,
    on: Predicate<QueryColumns<columnTypes> | QueryColumnName<target>>,
  ): QueryBuilder<
    MergeColumnTypeMaps<columnTypes, QueryColumnTypeMap<target>>,
    row,
    loaded,
    tableName,
    primaryKey
  > {
    return this.join(target, on, 'right')
  }

  /**
   * Appends an order-by clause.
   * @param column Column to sort by.
   * @param direction Sort direction.
   * @returns A cloned query builder with the appended order-by clause.
   */
  orderBy(
    column: QueryColumnInput<columnTypes>,
    direction: 'asc' | 'desc' = 'asc',
  ): QueryBuilder<columnTypes, row, loaded, tableName, primaryKey> {
    return this.#clone({
      orderBy: [...this.#state.orderBy, { column: normalizeColumnInput(column), direction }],
    })
  }

  /**
   * Appends group-by columns.
   * @param columns Columns to include in the grouping set.
   * @returns A cloned query builder with appended group-by columns.
   */
  groupBy(
    ...columns: QueryColumnInput<columnTypes>[]
  ): QueryBuilder<columnTypes, row, loaded, tableName, primaryKey> {
    return this.#clone({
      groupBy: [...this.#state.groupBy, ...columns.map((column) => normalizeColumnInput(column))],
    })
  }

  /**
   * Limits returned rows.
   * @param value Maximum number of rows to return.
   * @returns A cloned query builder with a row limit.
   */
  limit(value: number): QueryBuilder<columnTypes, row, loaded, tableName, primaryKey> {
    return this.#clone({ limit: value })
  }

  /**
   * Skips returned rows.
   * @param value Number of rows to skip.
   * @returns A cloned query builder with a row offset.
   */
  offset(value: number): QueryBuilder<columnTypes, row, loaded, tableName, primaryKey> {
    return this.#clone({ offset: value })
  }

  /**
   * Configures eager-loaded relations.
   * @param relations Relation map describing nested eager-load behavior.
   * @returns A cloned query builder with relation loading configuration.
   */
  with<relations extends RelationMapForSourceName<tableName>>(
    relations: relations,
  ): QueryBuilder<columnTypes, row, loaded & LoadedRelationMap<relations>, tableName, primaryKey> {
    return this.#clone({
      with: {
        ...this.#state.with,
        ...relations,
      },
    }) as QueryBuilder<
      columnTypes,
      row,
      loaded & LoadedRelationMap<relations>,
      tableName,
      primaryKey
    >
  }

  /**
   * Executes the query and returns all rows.
   * @returns All matching rows with requested eager-loaded relations.
   */
  async all(): Promise<Array<row & loaded>> {
    let rows = await this[loadRowsWithRelations]()
    return applyAfterReadHooksToLoadedRows(this.#table, rows, this.#state.with) as Array<
      row & loaded
    >
  }

  /**
   * Executes the built select query and hydrates any configured eager-loaded relations.
   *
   * @returns Raw rows with eager-loaded relation data applied.
   */
  async [loadRowsWithRelations](): Promise<Record<string, unknown>[]> {
    let operation = this.#toSelectOperation()
    let result = await this.#database[executeOperation](operation)
    let rows = normalizeRows(result.rows)

    if (Object.keys(this.#state.with).length === 0) {
      return rows
    }

    return loadRelationsForRows(this.#database, this.#table, rows, this.#state.with)
  }

  /**
   * Executes the query and returns the first row.
   * @returns The first matching row, or `null` when no rows match.
   */
  async first(): Promise<(row & loaded) | null> {
    let rows = await this.limit(1).all()
    return rows[0] ?? null
  }

  /**
   * Loads a single row by primary key.
   * @param value Primary-key value or composite-key object.
   * @returns The matching row, or `null` when no row exists.
   */
  async find(value: PrimaryKeyInputForRow<row, primaryKey>): Promise<(row & loaded) | null> {
    let where = getPrimaryKeyObject(this.#table, value as any)
    return this.where(where as WhereInput<QueryColumns<columnTypes>>).first()
  }

  /**
   * Executes a count query.
   * @returns Number of rows that match the current query scope.
   */
  async count(): Promise<number> {
    let operation: CountOperation<AnyTable> = {
      kind: 'count',
      table: this.#table,
      joins: [...this.#state.joins],
      where: [...this.#state.where],
      groupBy: [...this.#state.groupBy],
      having: [...this.#state.having],
    }

    let result = await this.#database[executeOperation](operation)

    if (result.rows && result.rows[0] && typeof result.rows[0].count === 'number') {
      return result.rows[0].count as number
    }

    if (result.rows) {
      return result.rows.length
    }

    return 0
  }

  /**
   * Executes an existence query.
   * @returns `true` when at least one row matches the current query scope.
   */
  async exists(): Promise<boolean> {
    let operation: ExistsOperation<AnyTable> = {
      kind: 'exists',
      table: this.#table,
      joins: [...this.#state.joins],
      where: [...this.#state.where],
      groupBy: [...this.#state.groupBy],
      having: [...this.#state.having],
    }

    let result = await this.#database[executeOperation](operation)

    if (result.rows && result.rows[0] && typeof result.rows[0].exists === 'boolean') {
      return result.rows[0].exists as boolean
    }

    if (result.rows && result.rows[0] && typeof result.rows[0].count === 'number') {
      return Number(result.rows[0].count) > 0
    }

    return Boolean(result.rows && result.rows.length > 0)
  }

  /**
   * Inserts one row.
   * @param values Values to insert.
   * @param options Insert options.
   * @param options.returning Optional return selection for adapters that support returning.
   * @param options.touch When `true`, manages timestamp columns automatically.
   * @returns Insert metadata, and optionally the returned row.
   */
  async insert(
    values: Partial<row>,
    options?: { returning?: ReturningInput<row>; touch?: boolean },
  ): Promise<WriteResult | WriteRowResult<row>> {
    assertWriteState(this.#state, 'insert', {
      where: false,
      orderBy: false,
      limit: false,
      offset: false,
    })

    let preparedValues = prepareInsertValues(
      this.#table,
      values,
      this.#database.now(),
      options?.touch ?? true,
    )
    let returning = options?.returning

    assertReturningCapability(this.#database.adapter, 'insert', returning)

    if (returning) {
      let operation: InsertOperation<AnyTable> = {
        kind: 'insert',
        table: this.#table,
        values: preparedValues,
        returning: normalizeReturningSelection(returning),
      }

      let result = await this.#database[executeOperation](operation)
      let row = (applyAfterReadHooksToRows(this.#table, normalizeRows(result.rows))[0] ??
        null) as row | null
      let affectedRows = result.affectedRows ?? 0
      runAfterWriteHook(this.#table, {
        operation: 'create',
        tableName: getTableName(this.#table),
        values: [preparedValues as Partial<row>],
        affectedRows,
        insertId: result.insertId,
      })

      return {
        affectedRows,
        insertId: result.insertId,
        row,
      }
    }

    let operation: InsertOperation<AnyTable> = {
      kind: 'insert',
      table: this.#table,
      values: preparedValues,
    }

    let result = await this.#database[executeOperation](operation)
    let affectedRows = result.affectedRows ?? 0
    runAfterWriteHook(this.#table, {
      operation: 'create',
      tableName: getTableName(this.#table),
      values: [preparedValues as Partial<row>],
      affectedRows,
      insertId: result.insertId,
    })

    return {
      affectedRows,
      insertId: result.insertId,
    }
  }

  /**
   * Inserts many rows.
   * @param values Values to insert.
   * @param options Insert options.
   * @param options.returning Optional return selection for adapters that support returning.
   * @param options.touch When `true`, manages timestamp columns automatically.
   * @returns Insert metadata, and optionally the returned rows.
   */
  async insertMany(
    values: Partial<row>[],
    options?: { returning?: ReturningInput<row>; touch?: boolean },
  ): Promise<WriteResult | WriteRowsResult<row>> {
    assertWriteState(this.#state, 'insertMany', {
      where: false,
      orderBy: false,
      limit: false,
      offset: false,
    })

    let preparedValues = values.map((value) =>
      prepareInsertValues(this.#table, value, this.#database.now(), options?.touch ?? true),
    )

    if (
      preparedValues.length > 0 &&
      preparedValues.every((preparedValue) => Object.keys(preparedValue).length === 0)
    ) {
      throw new DataTableQueryError(
        'insertMany() requires at least one explicit value across the batch',
      )
    }

    let returning = options?.returning

    assertReturningCapability(this.#database.adapter, 'insertMany', returning)

    if (returning) {
      let operation: InsertManyOperation<AnyTable> = {
        kind: 'insertMany',
        table: this.#table,
        values: preparedValues,
        returning: normalizeReturningSelection(returning),
      }

      let result = await this.#database[executeOperation](operation)
      let affectedRows = result.affectedRows ?? 0
      runAfterWriteHook(this.#table, {
        operation: 'create',
        tableName: getTableName(this.#table),
        values: preparedValues as Array<Partial<row>>,
        affectedRows,
        insertId: result.insertId,
      })

      return {
        affectedRows,
        insertId: result.insertId,
        rows: applyAfterReadHooksToRows(this.#table, normalizeRows(result.rows)) as row[],
      }
    }

    let operation: InsertManyOperation<AnyTable> = {
      kind: 'insertMany',
      table: this.#table,
      values: preparedValues,
    }

    let result = await this.#database[executeOperation](operation)
    let affectedRows = result.affectedRows ?? 0
    runAfterWriteHook(this.#table, {
      operation: 'create',
      tableName: getTableName(this.#table),
      values: preparedValues as Array<Partial<row>>,
      affectedRows,
      insertId: result.insertId,
    })

    return {
      affectedRows,
      insertId: result.insertId,
    }
  }

  /**
   * Updates scoped rows.
   * @param changes Column changes to apply.
   * @param options Update options.
   * @param options.returning Optional return selection for adapters that support returning.
   * @param options.touch When `true`, updates timestamp columns automatically.
   * @returns Update metadata, and optionally the returned rows.
   */
  async update(
    changes: Partial<row>,
    options?: { returning?: ReturningInput<row>; touch?: boolean },
  ): Promise<WriteResult | WriteRowsResult<row>> {
    assertWriteState(this.#state, 'update', {
      where: true,
      orderBy: true,
      limit: true,
      offset: true,
    })

    let returning = options?.returning
    assertReturningCapability(this.#database.adapter, 'update', returning)
    let preparedChanges = prepareUpdateValues(
      this.#table,
      changes,
      this.#database.now(),
      options?.touch ?? true,
    )

    if (Object.keys(preparedChanges).length === 0) {
      throw new DataTableQueryError('update() requires at least one change')
    }

    let result: DataManipulationResult

    if (hasScopedWriteModifiers(this.#state)) {
      let table = this.#table
      let queryState = this.#state

      result = await this.#database.transaction(async (tx) => {
        let primaryKeys = await loadPrimaryKeyRowsForScope(
          tx as unknown as QueryExecutionContext,
          table,
          queryState,
        )
        let primaryKeyPredicate = buildPrimaryKeyPredicate(table, primaryKeys)

        if (!primaryKeyPredicate) {
          return {
            affectedRows: 0,
            insertId: undefined,
            rows: returning ? [] : undefined,
          }
        }

        let txRuntime = tx as unknown as QueryExecutionContext
        return txRuntime[executeOperation]({
          kind: 'update',
          table,
          changes: preparedChanges,
          where: [primaryKeyPredicate],
          returning: returning ? normalizeReturningSelection(returning) : undefined,
        })
      })
    } else {
      let operation: UpdateOperation<AnyTable> = {
        kind: 'update',
        table: this.#table,
        changes: preparedChanges,
        where: [...this.#state.where],
        returning: returning ? normalizeReturningSelection(returning) : undefined,
      }

      result = await this.#database[executeOperation](operation)
    }

    let affectedRows = result.affectedRows ?? 0
    runAfterWriteHook(this.#table, {
      operation: 'update',
      tableName: getTableName(this.#table),
      values: [preparedChanges as Partial<row>],
      affectedRows,
      insertId: result.insertId,
    })

    if (!returning) {
      return {
        affectedRows,
        insertId: result.insertId,
      }
    }

    return {
      affectedRows,
      insertId: result.insertId,
      rows: applyAfterReadHooksToRows(this.#table, normalizeRows(result.rows)) as row[],
    }
  }

  /**
   * Deletes scoped rows.
   * @param options Delete options.
   * @param options.returning Optional return selection for adapters that support returning.
   * @returns Delete metadata, and optionally the returned rows.
   */
  async delete(options?: {
    returning?: ReturningInput<row>
  }): Promise<WriteResult | WriteRowsResult<row>> {
    assertWriteState(this.#state, 'delete', {
      where: true,
      orderBy: true,
      limit: true,
      offset: true,
    })

    let returning = options?.returning
    assertReturningCapability(this.#database.adapter, 'delete', returning)
    let tableName = getTableName(this.#table)
    let deleteContext = {
      tableName,
      where: [...this.#state.where],
      orderBy: [...this.#state.orderBy],
      limit: this.#state.limit,
      offset: this.#state.offset,
    }

    runBeforeDeleteHook(this.#table, deleteContext)
    let result: DataManipulationResult

    if (hasScopedWriteModifiers(this.#state)) {
      let table = this.#table
      let queryState = this.#state

      result = await this.#database.transaction(async (tx) => {
        let primaryKeys = await loadPrimaryKeyRowsForScope(
          tx as unknown as QueryExecutionContext,
          table,
          queryState,
        )
        let primaryKeyPredicate = buildPrimaryKeyPredicate(table, primaryKeys)

        if (!primaryKeyPredicate) {
          return {
            affectedRows: 0,
            insertId: undefined,
            rows: returning ? [] : undefined,
          }
        }

        let txRuntime = tx as unknown as QueryExecutionContext
        return txRuntime[executeOperation]({
          kind: 'delete',
          table,
          where: [primaryKeyPredicate],
          returning: returning ? normalizeReturningSelection(returning) : undefined,
        })
      })
    } else {
      let operation: DeleteOperation<AnyTable> = {
        kind: 'delete',
        table: this.#table,
        where: [...this.#state.where],
        returning: returning ? normalizeReturningSelection(returning) : undefined,
      }

      result = await this.#database[executeOperation](operation)
    }

    let affectedRows = result.affectedRows ?? 0
    runAfterDeleteHook(this.#table, {
      tableName,
      where: deleteContext.where,
      orderBy: deleteContext.orderBy,
      limit: deleteContext.limit,
      offset: deleteContext.offset,
      affectedRows,
    })

    if (!returning) {
      return {
        affectedRows,
        insertId: result.insertId,
      }
    }

    return {
      affectedRows,
      insertId: result.insertId,
      rows: applyAfterReadHooksToRows(this.#table, normalizeRows(result.rows)) as row[],
    }
  }

  /**
   * Performs an upsert operation.
   * @param values Values to insert.
   * @param options Upsert options.
   * @param options.returning Optional return selection for adapters that support returning.
   * @param options.touch When `true`, manages timestamp columns automatically.
   * @param options.conflictTarget Conflict target columns for adapters that require them.
   * @param options.update Optional update payload used when a conflict occurs.
   * @returns Upsert metadata, and optionally the returned row.
   */
  async upsert(
    values: Partial<row>,
    options?: {
      returning?: ReturningInput<row>
      touch?: boolean
      conflictTarget?: (keyof row & string)[]
      update?: Partial<row>
    },
  ): Promise<WriteResult | WriteRowResult<row>> {
    assertWriteState(this.#state, 'upsert', {
      where: false,
      orderBy: false,
      limit: false,
      offset: false,
    })

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
          'create',
        )
      : undefined
    let returning = options?.returning
    assertReturningCapability(this.#database.adapter, 'upsert', returning)

    if (returning) {
      let operation: UpsertOperation<AnyTable> = {
        kind: 'upsert',
        table: this.#table,
        values: preparedValues,
        conflictTarget: options?.conflictTarget ? [...options.conflictTarget] : undefined,
        update: updateChanges,
        returning: normalizeReturningSelection(returning),
      }

      let result = await this.#database[executeOperation](operation)
      let row = (applyAfterReadHooksToRows(this.#table, normalizeRows(result.rows))[0] ??
        null) as row | null
      let affectedRows = result.affectedRows ?? 0
      let preparedWriteValues = updateChanges
        ? ([preparedValues, updateChanges] as Array<Partial<row>>)
        : ([preparedValues] as Array<Partial<row>>)
      runAfterWriteHook(this.#table, {
        operation: 'create',
        tableName: getTableName(this.#table),
        values: preparedWriteValues,
        affectedRows,
        insertId: result.insertId,
      })

      return {
        affectedRows,
        insertId: result.insertId,
        row,
      }
    }

    let operation: UpsertOperation<AnyTable> = {
      kind: 'upsert',
      table: this.#table,
      values: preparedValues,
      conflictTarget: options?.conflictTarget ? [...options.conflictTarget] : undefined,
      update: updateChanges,
    }

    let result = await this.#database[executeOperation](operation)
    let affectedRows = result.affectedRows ?? 0
    let preparedWriteValues = updateChanges
      ? ([preparedValues, updateChanges] as Array<Partial<row>>)
      : ([preparedValues] as Array<Partial<row>>)
    runAfterWriteHook(this.#table, {
      operation: 'create',
      tableName: getTableName(this.#table),
      values: preparedWriteValues,
      affectedRows,
      insertId: result.insertId,
    })

    return {
      affectedRows,
      insertId: result.insertId,
    }
  }

  #toSelectOperation(): SelectOperation<AnyTable> {
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

  #clone(
    patch: Partial<QueryState>,
  ): QueryBuilder<columnTypes, row, loaded, tableName, primaryKey> {
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
}

function cloneSelection(selection: '*' | SelectColumn[]): '*' | SelectColumn[] {
  if (selection === '*') {
    return '*'
  }

  return selection.map((column) => ({ ...column }))
}

function normalizeRows(rows: DataManipulationResult['rows']): Record<string, unknown>[] {
  if (!rows) {
    return []
  }

  return rows.map((row) => ({ ...row }))
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
