import {
  belongsTo,
  createTable,
  hasMany,
  hasManyThrough,
  hasOne,
} from '@remix-run/data-table'
import type {
  AnyTable,
  BelongsToOptions,
  ColumnSchemas,
  DataSchema,
  Database,
  HasManyOptions,
  HasManyThroughOptions,
  HasOneOptions,
  Relation,
  TimestampOptions,
} from '@remix-run/data-table'
import { inferTableName } from '@remix-run/data-table/inflection'

const modelDatabaseKey = Symbol('data-model.database')
const modelTableKey = Symbol('data-model.table')

type ModelValues = Record<string, unknown>
type FindOptions = { with?: unknown }
type FindOneOptions = { where: unknown; orderBy?: unknown; with?: unknown }
type FindManyOptions = {
  where?: unknown
  orderBy?: unknown
  limit?: number
  offset?: number
  with?: unknown
}
type WriteOptions = { touch?: boolean; with?: unknown }

type InferSchemaOutput<schema> = schema extends DataSchema<any, infer output> ? output : never

/**
 * Infers instance property types from a model's `columns` definition.
 */
export type InferModelProperties<columns extends ColumnSchemas> = {
  [column in keyof columns & string]: InferSchemaOutput<columns[column]>
}

/**
 * Base class for ActiveRecord-style models.
 *
 * Subclasses declare static metadata (`columns`, optional `tableName`,
 * `primaryKey`, and `timestamps`) and can use static CRUD/relation helpers
 * after being bound with `Model.bind(database)` or through a model registry.
 */
export abstract class Model {
  /**
   * Optional explicit table name. Defaults to inferred snake_case plural name
   * from the class name.
   */
  static tableName?: string
  /**
   * Optional primary key override. Defaults to data-table table defaults.
   */
  static primaryKey?: string | readonly string[]
  /**
   * Optional timestamp configuration passed through to `createTable`.
   */
  static timestamps?: TimestampOptions
  /**
   * Column schema definitions for this model.
   */
  static columns: ColumnSchemas

  /**
   * Creates a model instance from a row-like object.
   *
   * @param values Initial values to assign to instance properties.
   */
  constructor(values?: ModelValues) {
    if (values) {
      Object.assign(this, values)
    }
  }

  /**
   * Lazily resolves and caches this model's table metadata.
   */
  static get table(): AnyTable {
    let table = getModelTable(this)
    if (table) {
      return table
    }

    let columns = resolveModelColumns(this)
    if (!columns) {
      throw new Error(
        'No columns defined for model "' + this.name + '". Set ' + this.name + '.columns first.',
      )
    }

    table = createTable({
      name: this.tableName ?? inferTableName(this.name),
      columns,
      primaryKey: this.primaryKey as any,
      timestamps: this.timestamps,
    })

    Object.defineProperty(this, modelTableKey, {
      value: table,
      enumerable: false,
      writable: false,
      configurable: false,
    })

    return table
  }

  /**
   * Creates a query builder scoped to this model's table.
   *
   * @returns A query builder for this model table.
   */
  static query(this: typeof Model) {
    return this.db.query(this.table as any)
  }

  /**
   * Normalizes a lookup value before `find`, `update`, `destroy`, and `delete`.
   * Return `null` to short-circuit lookup as invalid.
   *
   * @param value Lookup value provided by the caller.
   * @returns Normalized lookup value, or `null` to skip lookup.
   */
  static normalizeLookupValue(this: typeof Model, value: unknown): unknown | null {
    return value
  }

  /**
   * Normalizes find options before `find`.
   *
   * @param options Optional find options.
   * @returns Normalized find options.
   */
  static normalizeFindOptions(
    this: typeof Model,
    options?: FindOptions,
  ): FindOptions | undefined {
    return options
  }

  /**
   * Normalizes values before `create`.
   *
   * @param values Values passed to `create`.
   * @returns Normalized create values.
   */
  static normalizeCreateValues(this: typeof Model, values: ModelValues): ModelValues {
    return values
  }

  /**
   * Normalizes changes before `update`.
   *
   * @param changes Changes passed to `update`.
   * @returns Normalized update values.
   */
  static normalizeUpdateValues(this: typeof Model, changes: ModelValues): ModelValues {
    return changes
  }

  /**
   * Finds a row by primary key value and returns a hydrated model instance.
   *
   * @param value Primary key value.
   * @param options Optional eager-loading options.
   * @returns A model instance or `null` when no row matches.
   */
  static async find<self extends typeof Model>(
    this: self,
    value: unknown,
    options?: FindOptions,
  ): Promise<InstanceType<self> | null> {
    let lookupValue = this.normalizeLookupValue(value)
    if (lookupValue === null) {
      return null
    }

    let findOptions = this.normalizeFindOptions(options)
    let row = await this.db.find(this.table as any, lookupValue as any, findOptions as any)

    if (!row) {
      return null
    }

    return this.build(row as ModelValues)
  }

  /**
   * Finds the first row matching query options and returns a model instance.
   *
   * @param options Query options.
   * @returns A model instance or `null` when no row matches.
   */
  static async findOne<self extends typeof Model>(
    this: self,
    options: FindOneOptions,
  ): Promise<InstanceType<self> | null> {
    let row = await this.db.findOne(this.table as any, options as any)

    if (!row) {
      return null
    }

    return this.build(row as ModelValues)
  }

  /**
   * Finds all rows matching query options and returns model instances.
   *
   * @param options Optional query options.
   * @returns Matching model instances.
   */
  static async findMany<self extends typeof Model>(
    this: self,
    options?: FindManyOptions,
  ): Promise<Array<InstanceType<self>>> {
    let rows = await this.db.findMany(this.table as any, options as any)

    return this.buildMany(rows as ModelValues[])
  }

  /**
   * Returns all rows for this model table.
   *
   * @returns All model instances for this table.
   */
  static async all<self extends typeof Model>(
    this: self,
  ): Promise<Array<InstanceType<self>>> {
    return this.findMany()
  }

  /**
   * Counts rows for this model table.
   *
   * @param options Optional `where` filter.
   * @param options.where Optional predicate used for counting.
   * @returns Number of matching rows.
   */
  static async count(this: typeof Model, options?: { where?: unknown }): Promise<number> {
    return this.db.count(this.table as any, options as any)
  }

  /**
   * Creates a row and returns the created model instance.
   *
   * @param values Values to create.
   * @param options Optional write options.
   * @returns Created model instance.
   */
  static async create<self extends typeof Model>(
    this: self,
    values: ModelValues,
    options?: WriteOptions,
  ): Promise<InstanceType<self>> {
    let normalizedValues = this.normalizeCreateValues(values)
    let row = await this.db.create(this.table as any, normalizedValues as any, {
      ...(options as any),
      returnRow: true,
    })

    return this.build(row as ModelValues)
  }

  /**
   * Updates a row by lookup value and returns the updated model instance.
   *
   * @param value Primary key value.
   * @param changes Changes to persist.
   * @param options Optional write options.
   * @returns Updated model instance, or `null` when no row matches.
   */
  static async update<self extends typeof Model>(
    this: self,
    value: unknown,
    changes: ModelValues,
    options?: WriteOptions,
  ): Promise<InstanceType<self> | null> {
    let lookupValue = this.normalizeLookupValue(value)
    if (lookupValue === null) {
      return null
    }

    let normalizedChanges = this.normalizeUpdateValues(changes)
    if (Object.keys(normalizedChanges).length === 0) {
      return this.find(lookupValue, options ? { with: options.with } : undefined)
    }

    let row = await this.db.update(
      this.table as any,
      lookupValue as any,
      normalizedChanges as any,
      options as any,
    )

    if (!row) {
      return null
    }

    return this.build(row as ModelValues)
  }

  /**
   * Deletes a row by lookup value.
   *
   * @param value Primary key value.
   * @returns `true` when a row was deleted, otherwise `false`.
   */
  static async destroy(this: typeof Model, value: unknown): Promise<boolean> {
    let lookupValue = this.normalizeLookupValue(value)
    if (lookupValue === null) {
      return false
    }

    return this.db.delete(this.table as any, lookupValue as any)
  }

  /**
   * Alias for `destroy`.
   *
   * @param value Primary key value.
   * @returns `true` when a row was deleted, otherwise `false`.
   */
  static async delete(this: typeof Model, value: unknown): Promise<boolean> {
    return this.destroy(value)
  }

  /**
   * Declares a one-to-many relation from this model to a target model.
   *
   * @param targetModel Related model class.
   * @param options Optional relation configuration.
   * @returns A relation descriptor.
   */
  static hasMany<target extends typeof Model>(
    this: typeof Model,
    targetModel: target,
    options?: HasManyOptions<AnyTable, AnyTable>,
  ): Relation<AnyTable, AnyTable, 'many'> {
    return hasMany(this.table, targetModel.table, options as any)
  }

  /**
   * Declares a one-to-one relation from this model to a target model.
   *
   * @param targetModel Related model class.
   * @param options Optional relation configuration.
   * @returns A relation descriptor.
   */
  static hasOne<target extends typeof Model>(
    this: typeof Model,
    targetModel: target,
    options?: HasOneOptions<AnyTable, AnyTable>,
  ): Relation<AnyTable, AnyTable, 'one'> {
    return hasOne(this.table, targetModel.table, options as any)
  }

  /**
   * Declares an inverse relation from this model to a parent model.
   *
   * @param targetModel Related model class.
   * @param options Optional relation configuration.
   * @returns A relation descriptor.
   */
  static belongsTo<target extends typeof Model>(
    this: typeof Model,
    targetModel: target,
    options?: BelongsToOptions<AnyTable, AnyTable>,
  ): Relation<AnyTable, AnyTable, 'one'> {
    return belongsTo(this.table, targetModel.table, options as any)
  }

  /**
   * Declares a one-to-many relation through a join relation.
   *
   * @param targetModel Related model class.
   * @param options Join relation configuration.
   * @returns A relation descriptor.
   */
  static hasManyThrough<target extends typeof Model>(
    this: typeof Model,
    targetModel: target,
    options: HasManyThroughOptions<AnyTable, AnyTable>,
  ): Relation<AnyTable, AnyTable, 'many'> {
    return hasManyThrough(this.table, targetModel.table, options as any)
  }

  /**
   * Gets the database currently bound to this model class.
   */
  static get db(): Database {
    let database = resolveBoundDatabase(this)

    if (!database) {
      throw new Error(
        'No database bound for model "' + this.name +
          '". Use modelRegistry.bind(database) before calling model methods.',
      )
    }

    return database
  }

  /**
   * Hydrates a single row into a model instance.
   *
   * @param row Row values to hydrate.
   * @returns A model instance.
   */
  static build<self extends typeof Model>(
    this: self,
    row: ModelValues,
  ): InstanceType<self> {
    let Constructor = this as unknown as new (values?: ModelValues) => InstanceType<self>
    return new Constructor(row)
  }

  /**
   * Hydrates many rows into model instances.
   *
   * @param rows Row values to hydrate.
   * @returns Model instances.
   */
  static buildMany<self extends typeof Model>(
    this: self,
    rows: ModelValues[],
  ): Array<InstanceType<self>> {
    return rows.map((row) => this.build(row))
  }

  /**
   * Creates a bound subclass that uses the provided database.
   *
   * @param database Database instance to bind to the returned subclass.
   * @returns A bound subclass of the current model class.
   */
  static bind<self extends typeof Model>(this: self, database: Database): self {
    let table = this.table
    let BoundModel = class extends (this as typeof Model) {}

    Object.defineProperty(BoundModel, modelDatabaseKey, {
      value: database,
      enumerable: false,
      writable: false,
      configurable: false,
    })

    Object.defineProperty(BoundModel, modelTableKey, {
      value: table,
      enumerable: false,
      writable: false,
      configurable: false,
    })

    return BoundModel as unknown as self
  }
}

function getModelTable(modelClass: typeof Model): AnyTable | undefined {
  return (modelClass as any)[modelTableKey] as AnyTable | undefined
}

function resolveModelColumns(modelClass: typeof Model): ColumnSchemas | undefined {
  let columns = (modelClass as any).columns as ColumnSchemas | undefined
  if (!columns || typeof columns !== 'object') {
    return undefined
  }

  return columns
}

function resolveBoundDatabase(modelClass: typeof Model): Database | undefined {
  return (modelClass as any)[modelDatabaseKey] as Database | undefined
}
