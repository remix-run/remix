import type { InferOutput } from '@remix-run/data-schema';
import type { AnyTable, BelongsToOptions, ColumnSchemas, Database, HasManyOptions, HasManyThroughOptions, HasOneOptions, Relation, TimestampOptions } from '@remix-run/data-table';
type ModelValues = Record<string, unknown>;
type FindOptions = {
    with?: unknown;
};
type FindOneOptions = {
    where: unknown;
    orderBy?: unknown;
    with?: unknown;
};
type FindManyOptions = {
    where?: unknown;
    orderBy?: unknown;
    limit?: number;
    offset?: number;
    with?: unknown;
};
type WriteOptions = {
    touch?: boolean;
    with?: unknown;
};
/**
 * Infers instance property types from a model's `columns` definition.
 */
export type InferModelProperties<columns extends ColumnSchemas> = {
    [column in keyof columns & string]: InferOutput<columns[column]>;
};
/**
 * Base class for ActiveRecord-style models.
 *
 * Subclasses declare static metadata (`columns`, optional `tableName`,
 * `primaryKey`, and `timestamps`) and can use static CRUD/relation helpers
 * after being bound with `Model.bind(database)` or through a model registry.
 */
export declare abstract class Model {
    /**
     * Optional explicit table name. Defaults to inferred snake_case plural name
     * from the class name.
     */
    static tableName?: string;
    /**
     * Optional primary key override. Defaults to data-table table defaults.
     */
    static primaryKey?: string | readonly string[];
    /**
     * Optional timestamp configuration passed through to `createTable`.
     */
    static timestamps?: TimestampOptions;
    /**
     * Column schema definitions for this model.
     */
    static columns: ColumnSchemas;
    /**
     * Creates a model instance from a row-like object.
     *
     * @param values Initial values to assign to instance properties.
     */
    constructor(values?: ModelValues);
    /**
     * Lazily resolves and caches this model's table metadata.
     */
    static get table(): AnyTable;
    /**
     * Creates a query builder scoped to this model's table.
     *
     * @returns A query builder for this model table.
     */
    static query(this: typeof Model): import("@remix-run/data-table").QueryBuilderFor<string, Record<string, unknown>, readonly string[], {}>;
    /**
     * Normalizes a lookup value before `find`, `update`, `destroy`, and `delete`.
     * Return `null` to short-circuit lookup as invalid.
     *
     * @param value Lookup value provided by the caller.
     * @returns Normalized lookup value, or `null` to skip lookup.
     */
    static normalizeLookupValue(this: typeof Model, value: unknown): unknown | null;
    /**
     * Normalizes find options before `find`.
     *
     * @param options Optional find options.
     * @returns Normalized find options.
     */
    static normalizeFindOptions(this: typeof Model, options?: FindOptions): FindOptions | undefined;
    /**
     * Normalizes values before `create`.
     *
     * @param values Values passed to `create`.
     * @returns Normalized create values.
     */
    static normalizeCreateValues(this: typeof Model, values: ModelValues): ModelValues;
    /**
     * Normalizes changes before `update`.
     *
     * @param changes Changes passed to `update`.
     * @returns Normalized update values.
     */
    static normalizeUpdateValues(this: typeof Model, changes: ModelValues): ModelValues;
    /**
     * Finds a row by primary key value and returns a hydrated model instance.
     *
     * @param value Primary key value.
     * @param options Optional eager-loading options.
     * @returns A model instance or `null` when no row matches.
     */
    static find<self extends typeof Model>(this: self, value: unknown, options?: FindOptions): Promise<InstanceType<self> | null>;
    /**
     * Finds the first row matching query options and returns a model instance.
     *
     * @param options Query options.
     * @returns A model instance or `null` when no row matches.
     */
    static findOne<self extends typeof Model>(this: self, options: FindOneOptions): Promise<InstanceType<self> | null>;
    /**
     * Finds all rows matching query options and returns model instances.
     *
     * @param options Optional query options.
     * @returns Matching model instances.
     */
    static findMany<self extends typeof Model>(this: self, options?: FindManyOptions): Promise<Array<InstanceType<self>>>;
    /**
     * Returns all rows for this model table.
     *
     * @returns All model instances for this table.
     */
    static all<self extends typeof Model>(this: self): Promise<Array<InstanceType<self>>>;
    /**
     * Counts rows for this model table.
     *
     * @param options Optional `where` filter.
     * @param options.where Optional predicate used for counting.
     * @returns Number of matching rows.
     */
    static count(this: typeof Model, options?: {
        where?: unknown;
    }): Promise<number>;
    /**
     * Creates a row and returns the created model instance.
     *
     * @param values Values to create.
     * @param options Optional write options.
     * @returns Created model instance.
     */
    static create<self extends typeof Model>(this: self, values: ModelValues, options?: WriteOptions): Promise<InstanceType<self>>;
    /**
     * Updates a row by lookup value and returns the updated model instance.
     *
     * @param value Primary key value.
     * @param changes Changes to persist.
     * @param options Optional write options.
     * @returns Updated model instance, or `null` when no row matches.
     */
    static update<self extends typeof Model>(this: self, value: unknown, changes: ModelValues, options?: WriteOptions): Promise<InstanceType<self> | null>;
    /**
     * Deletes a row by lookup value.
     *
     * @param value Primary key value.
     * @returns `true` when a row was deleted, otherwise `false`.
     */
    static destroy(this: typeof Model, value: unknown): Promise<boolean>;
    /**
     * Alias for `destroy`.
     *
     * @param value Primary key value.
     * @returns `true` when a row was deleted, otherwise `false`.
     */
    static delete(this: typeof Model, value: unknown): Promise<boolean>;
    /**
     * Declares a one-to-many relation from this model to a target model.
     *
     * @param targetModel Related model class.
     * @param options Optional relation configuration.
     * @returns A relation descriptor.
     */
    static hasMany<target extends typeof Model>(this: typeof Model, targetModel: target, options?: HasManyOptions<AnyTable, AnyTable>): Relation<AnyTable, AnyTable, 'many'>;
    /**
     * Declares a one-to-one relation from this model to a target model.
     *
     * @param targetModel Related model class.
     * @param options Optional relation configuration.
     * @returns A relation descriptor.
     */
    static hasOne<target extends typeof Model>(this: typeof Model, targetModel: target, options?: HasOneOptions<AnyTable, AnyTable>): Relation<AnyTable, AnyTable, 'one'>;
    /**
     * Declares an inverse relation from this model to a parent model.
     *
     * @param targetModel Related model class.
     * @param options Optional relation configuration.
     * @returns A relation descriptor.
     */
    static belongsTo<target extends typeof Model>(this: typeof Model, targetModel: target, options?: BelongsToOptions<AnyTable, AnyTable>): Relation<AnyTable, AnyTable, 'one'>;
    /**
     * Declares a one-to-many relation through a join relation.
     *
     * @param targetModel Related model class.
     * @param options Join relation configuration.
     * @returns A relation descriptor.
     */
    static hasManyThrough<target extends typeof Model>(this: typeof Model, targetModel: target, options: HasManyThroughOptions<AnyTable, AnyTable>): Relation<AnyTable, AnyTable, 'many'>;
    /**
     * Gets the database currently bound to this model class.
     */
    static get db(): Database;
    /**
     * Hydrates a single row into a model instance.
     *
     * @param row Row values to hydrate.
     * @returns A model instance.
     */
    static build<self extends typeof Model>(this: self, row: ModelValues): InstanceType<self>;
    /**
     * Hydrates many rows into model instances.
     *
     * @param rows Row values to hydrate.
     * @returns Model instances.
     */
    static buildMany<self extends typeof Model>(this: self, rows: ModelValues[]): Array<InstanceType<self>>;
    /**
     * Creates a bound subclass that uses the provided database.
     *
     * @param database Database instance to bind to the returned subclass.
     * @returns A bound subclass of the current model class.
     */
    static bind<self extends typeof Model>(this: self, database: Database): self;
}
export {};
//# sourceMappingURL=model.d.ts.map