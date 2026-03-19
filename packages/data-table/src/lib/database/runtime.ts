import type {
  DataManipulationOperation,
  DataManipulationResult,
  DatabaseAdapter,
  TransactionOptions,
  TransactionToken,
} from '../adapter.ts'
import type {
  CountOptions,
  CreateManyResultOptions,
  CreateManyRowsOptions,
  CreateResultOptions,
  CreateRowOptions,
  Database,
  DeleteManyOptions,
  FindManyOptions,
  FindOneOptions,
  QueryBuilderFor,
  QueryForTable,
  QueryMethod,
  QueryTableInput,
  RelationMapForSourceName,
  UpdateManyOptions,
  UpdateOptions,
  WriteResult,
} from '../database.ts'
import { DataTableAdapterError, DataTableQueryError } from '../errors.ts'
import type { SqlStatement } from '../sql.ts'
import { isSqlStatement, rawSql } from '../sql.ts'
import type {
  AnyTable,
  LoadedRelationMap,
  PrimaryKeyInput,
  TableName,
  TablePrimaryKey,
  TableRow,
  TableRowWith,
} from '../table.ts'
import { getTableName } from '../table.ts'

import { executeOperation, type QueryExecutionContext } from './execution-context.ts'
import {
  asQueryTableInput,
  getPrimaryKeyWhere,
  getPrimaryKeyWhereFromRow,
  normalizeOrderByInput,
  resolveCreateRowWhere,
  toWriteResult,
} from './helpers.ts'
import { createInitialQueryState, QueryBuilder } from './query-builder.ts'

type SavepointCounter = {
  value: number
}

export class DatabaseRuntime implements Database, QueryExecutionContext {
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

  query: QueryMethod = <
    tableName extends string,
    row extends Record<string, unknown>,
    primaryKey extends readonly (keyof row & string)[],
  >(
    table: QueryTableInput<tableName, row, primaryKey>,
  ): QueryBuilderFor<tableName, row, primaryKey> =>
    new QueryBuilder(this, table, createInitialQueryState()) as QueryBuilderFor<
      tableName,
      row,
      primaryKey
    >

  create<table extends AnyTable>(
    table: table,
    values: Partial<TableRow<table>>,
    options?: CreateResultOptions,
  ): Promise<WriteResult>
  create<table extends AnyTable, relations extends RelationMapForSourceName<TableName<table>> = {}>(
    table: table,
    values: Partial<TableRow<table>>,
    options: CreateRowOptions<table, relations>,
  ): Promise<TableRowWith<table, LoadedRelationMap<relations>>>
  async create<
    table extends AnyTable,
    relations extends RelationMapForSourceName<TableName<table>> = {},
  >(
    table: table,
    values: Partial<TableRow<table>>,
    options?: CreateResultOptions | CreateRowOptions<table, relations>,
  ): Promise<WriteResult | TableRowWith<table, LoadedRelationMap<relations>>> {
    let touch = options?.touch
    let query: QueryForTable<table> = this.query(asQueryTableInput(table))

    if (options?.returnRow !== true) {
      let result = await query.insert(values, { touch })
      return toWriteResult(result)
    }

    if (this.#adapter.capabilities.returning) {
      let result = (await query.insert(values, {
        returning: '*',
        touch,
      })) as { row: TableRow<table> | null }
      let row = result.row

      if (!row) {
        throw new DataTableQueryError(
          'create({ returnRow: true }) failed to return an inserted row',
        )
      }

      if (!options.with) {
        return row as TableRowWith<table, LoadedRelationMap<relations>>
      }

      let where = getPrimaryKeyWhereFromRow(table, row)
      let loaded = await this.findOne(table, {
        where,
        with: options.with,
      })

      if (!loaded) {
        throw new DataTableQueryError('create({ returnRow: true }) failed to load inserted row')
      }

      return loaded
    }

    let insertResult = await query.insert(values, { touch })
    let where = resolveCreateRowWhere(table, values, toWriteResult(insertResult).insertId)
    let loaded = await this.findOne(table, {
      where,
      with: options.with,
    })

    if (!loaded) {
      throw new DataTableQueryError('create({ returnRow: true }) failed to load inserted row')
    }

    return loaded
  }

  createMany<table extends AnyTable>(
    table: table,
    values: Array<Partial<TableRow<table>>>,
    options?: CreateManyResultOptions,
  ): Promise<WriteResult>
  createMany<table extends AnyTable>(
    table: table,
    values: Array<Partial<TableRow<table>>>,
    options: CreateManyRowsOptions,
  ): Promise<TableRow<table>[]>
  async createMany<table extends AnyTable>(
    table: table,
    values: Array<Partial<TableRow<table>>>,
    options?: CreateManyResultOptions | CreateManyRowsOptions,
  ): Promise<WriteResult | TableRow<table>[]> {
    let query: QueryForTable<table> = this.query(asQueryTableInput(table))

    if (options?.returnRows === true) {
      if (!this.#adapter.capabilities.returning) {
        throw new DataTableQueryError(
          'createMany({ returnRows: true }) is not supported by this adapter',
        )
      }

      let result = (await query.insertMany(values, {
        returning: '*',
        touch: options.touch,
      })) as { rows: TableRow<table>[] }

      return result.rows
    }

    let result = await query.insertMany(values, {
      touch: options?.touch,
    })

    return toWriteResult(result)
  }

  async find<
    table extends AnyTable,
    relations extends RelationMapForSourceName<TableName<table>> = {},
  >(
    table: table,
    value: PrimaryKeyInput<table>,
    options?: { with?: relations },
  ): Promise<TableRowWith<table, LoadedRelationMap<relations>> | null> {
    if (value == null) {
      return null
    }

    let query: QueryForTable<table> = this.query(asQueryTableInput(table))

    if (options?.with) {
      return query.with(options.with).find(value as any) as Promise<TableRowWith<
        table,
        LoadedRelationMap<relations>
      > | null>
    }

    return query.find(value as any) as Promise<TableRowWith<
      table,
      LoadedRelationMap<relations>
    > | null>
  }

  async findOne<
    table extends AnyTable,
    relations extends RelationMapForSourceName<TableName<table>> = {},
  >(
    table: table,
    options: FindOneOptions<table, relations>,
  ): Promise<TableRowWith<table, LoadedRelationMap<relations>> | null> {
    let query: QueryForTable<table> = this.query(asQueryTableInput(table)).where(options.where)
    let orderBy = normalizeOrderByInput(options.orderBy)

    for (let [column, direction] of orderBy) {
      query = query.orderBy(column, direction)
    }

    if (options.with) {
      return query.with(options.with).first() as Promise<TableRowWith<
        table,
        LoadedRelationMap<relations>
      > | null>
    }

    return query.first() as Promise<TableRowWith<table, LoadedRelationMap<relations>> | null>
  }

  async findMany<
    table extends AnyTable,
    relations extends RelationMapForSourceName<TableName<table>> = {},
  >(
    table: table,
    options?: FindManyOptions<table, relations>,
  ): Promise<Array<TableRowWith<table, LoadedRelationMap<relations>>>> {
    let query: QueryForTable<table> = this.query(asQueryTableInput(table))

    if (options?.where) {
      query = query.where(options.where)
    }

    let orderBy = normalizeOrderByInput(options?.orderBy)
    for (let [column, direction] of orderBy) {
      query = query.orderBy(column, direction)
    }

    if (options?.limit !== undefined) {
      query = query.limit(options.limit)
    }

    if (options?.offset !== undefined) {
      query = query.offset(options.offset)
    }

    if (options?.with) {
      return query.with(options.with).all() as Promise<
        Array<TableRowWith<table, LoadedRelationMap<relations>>>
      >
    }

    return query.all() as Promise<Array<TableRowWith<table, LoadedRelationMap<relations>>>>
  }

  async count<table extends AnyTable>(
    table: table,
    options?: CountOptions<table>,
  ): Promise<number> {
    let query: QueryForTable<table> = this.query(asQueryTableInput(table))

    if (options?.where) {
      query = query.where(options.where)
    }

    return query.count()
  }

  async update<
    table extends AnyTable,
    relations extends RelationMapForSourceName<TableName<table>> = {},
  >(
    table: table,
    value: PrimaryKeyInput<table>,
    changes: Partial<TableRow<table>>,
    options?: UpdateOptions<table, relations>,
  ): Promise<TableRowWith<table, LoadedRelationMap<relations>>> {
    let where = getPrimaryKeyWhere(table, value)

    if (this.#adapter.capabilities.returning) {
      let updateResult = (await this.query(asQueryTableInput(table)).where(where).update(changes, {
        touch: options?.touch,
        returning: '*',
      })) as { rows: TableRow<table>[] }
      let updatedRow = updateResult.rows[0]

      if (!updatedRow) {
        throw new DataTableQueryError(
          'update() failed to find row for table "' + getTableName(table) + '"',
        )
      }

      if (!options?.with) {
        return updatedRow as TableRowWith<table, LoadedRelationMap<relations>>
      }

      let loaded = await this.findOne(table, {
        where: getPrimaryKeyWhereFromRow(table, updatedRow),
        with: options.with,
      })

      if (!loaded) {
        throw new DataTableQueryError(
          'update() failed to find row for table "' + getTableName(table) + '"',
        )
      }

      return loaded
    }

    await this.query(asQueryTableInput(table)).where(where).update(changes, {
      touch: options?.touch,
    })

    let loaded = await this.find(table, value, { with: options?.with })

    if (!loaded) {
      throw new DataTableQueryError(
        'update() failed to find row for table "' + getTableName(table) + '"',
      )
    }

    return loaded
  }

  async updateMany<table extends AnyTable>(
    table: table,
    changes: Partial<TableRow<table>>,
    options: UpdateManyOptions<table>,
  ): Promise<WriteResult> {
    let query: QueryForTable<table> = this.query(asQueryTableInput(table)).where(options.where)
    let orderBy = normalizeOrderByInput(options.orderBy)

    for (let [column, direction] of orderBy) {
      query = query.orderBy(column, direction)
    }

    if (options.limit !== undefined) {
      query = query.limit(options.limit)
    }

    if (options.offset !== undefined) {
      query = query.offset(options.offset)
    }

    let result = await query.update(changes, { touch: options.touch })
    return toWriteResult(result)
  }

  async delete<table extends AnyTable>(
    table: table,
    value: PrimaryKeyInput<table>,
  ): Promise<boolean> {
    let where = getPrimaryKeyWhere(table, value)
    let result = await this.query(asQueryTableInput(table)).where(where).delete()
    return toWriteResult(result).affectedRows > 0
  }

  async deleteMany<table extends AnyTable>(
    table: table,
    options: DeleteManyOptions<table>,
  ): Promise<WriteResult> {
    let query: QueryForTable<table> = this.query(asQueryTableInput(table)).where(options.where)
    let orderBy = normalizeOrderByInput(options.orderBy)

    for (let [column, direction] of orderBy) {
      query = query.orderBy(column, direction)
    }

    if (options.limit !== undefined) {
      query = query.limit(options.limit)
    }

    if (options.offset !== undefined) {
      query = query.offset(options.offset)
    }

    let result = await query.delete()
    return toWriteResult(result)
  }

  async exec(
    statement: string | SqlStatement,
    values: unknown[] = [],
  ): Promise<DataManipulationResult> {
    let sqlStatement = isSqlStatement(statement) ? statement : rawSql(statement, values)

    return this[executeOperation]({
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
      let tx = new DatabaseRuntime({
        adapter: this.#adapter,
        token,
        now: this.#now,
        savepointCounter: this.#savepointCounter,
      })

      try {
        let result = await callback(tx)
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

  async [executeOperation](operation: DataManipulationOperation): Promise<DataManipulationResult> {
    try {
      return await this.#adapter.execute({
        operation,
        transaction: this.#token,
      })
    } catch (error) {
      throw new DataTableAdapterError('Adapter execution failed', {
        cause: error,
        metadata: {
          dialect: this.#adapter.dialect,
          operationKind: operation.kind,
        },
      })
    }
  }
}
