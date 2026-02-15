import { belongsTo, createTable, hasMany, hasManyThrough, hasOne, } from '@remix-run/data-table';
import { inferTableName } from '@remix-run/data-table/inflection';
const modelDatabaseKey = Symbol('data-model.database');
const modelTableKey = Symbol('data-model.table');
/**
 * Base class for ActiveRecord-style models.
 *
 * Subclasses declare static metadata (`columns`, optional `tableName`,
 * `primaryKey`, and `timestamps`) and can use static CRUD/relation helpers
 * after being bound with `Model.bind(database)` or through a model registry.
 */
export class Model {
    /**
     * Optional explicit table name. Defaults to inferred snake_case plural name
     * from the class name.
     */
    static tableName;
    /**
     * Optional primary key override. Defaults to data-table table defaults.
     */
    static primaryKey;
    /**
     * Optional timestamp configuration passed through to `createTable`.
     */
    static timestamps;
    /**
     * Column schema definitions for this model.
     */
    static columns;
    /**
     * Creates a model instance from a row-like object.
     *
     * @param values Initial values to assign to instance properties.
     */
    constructor(values) {
        if (values) {
            Object.assign(this, values);
        }
    }
    /**
     * Lazily resolves and caches this model's table metadata.
     */
    static get table() {
        let table = getModelTable(this);
        if (table) {
            return table;
        }
        let columns = resolveModelColumns(this);
        if (!columns) {
            throw new Error('No columns defined for model "' + this.name + '". Set ' + this.name + '.columns first.');
        }
        table = createTable({
            name: this.tableName ?? inferTableName(this.name),
            columns,
            primaryKey: this.primaryKey,
            timestamps: this.timestamps,
        });
        Object.defineProperty(this, modelTableKey, {
            value: table,
            enumerable: false,
            writable: false,
            configurable: false,
        });
        return table;
    }
    /**
     * Creates a query builder scoped to this model's table.
     *
     * @returns A query builder for this model table.
     */
    static query() {
        return this.db.query(this.table);
    }
    /**
     * Normalizes a lookup value before `find`, `update`, `destroy`, and `delete`.
     * Return `null` to short-circuit lookup as invalid.
     *
     * @param value Lookup value provided by the caller.
     * @returns Normalized lookup value, or `null` to skip lookup.
     */
    static normalizeLookupValue(value) {
        return value;
    }
    /**
     * Normalizes find options before `find`.
     *
     * @param options Optional find options.
     * @returns Normalized find options.
     */
    static normalizeFindOptions(options) {
        return options;
    }
    /**
     * Normalizes values before `create`.
     *
     * @param values Values passed to `create`.
     * @returns Normalized create values.
     */
    static normalizeCreateValues(values) {
        return values;
    }
    /**
     * Normalizes changes before `update`.
     *
     * @param changes Changes passed to `update`.
     * @returns Normalized update values.
     */
    static normalizeUpdateValues(changes) {
        return changes;
    }
    /**
     * Finds a row by primary key value and returns a hydrated model instance.
     *
     * @param value Primary key value.
     * @param options Optional eager-loading options.
     * @returns A model instance or `null` when no row matches.
     */
    static async find(value, options) {
        let lookupValue = this.normalizeLookupValue(value);
        if (lookupValue === null) {
            return null;
        }
        let findOptions = this.normalizeFindOptions(options);
        let row = await this.db.find(this.table, lookupValue, findOptions);
        if (!row) {
            return null;
        }
        return this.build(row);
    }
    /**
     * Finds the first row matching query options and returns a model instance.
     *
     * @param options Query options.
     * @returns A model instance or `null` when no row matches.
     */
    static async findOne(options) {
        let row = await this.db.findOne(this.table, options);
        if (!row) {
            return null;
        }
        return this.build(row);
    }
    /**
     * Finds all rows matching query options and returns model instances.
     *
     * @param options Optional query options.
     * @returns Matching model instances.
     */
    static async findMany(options) {
        let rows = await this.db.findMany(this.table, options);
        return this.buildMany(rows);
    }
    /**
     * Returns all rows for this model table.
     *
     * @returns All model instances for this table.
     */
    static async all() {
        return this.findMany();
    }
    /**
     * Counts rows for this model table.
     *
     * @param options Optional `where` filter.
     * @param options.where Optional predicate used for counting.
     * @returns Number of matching rows.
     */
    static async count(options) {
        return this.db.count(this.table, options);
    }
    /**
     * Creates a row and returns the created model instance.
     *
     * @param values Values to create.
     * @param options Optional write options.
     * @returns Created model instance.
     */
    static async create(values, options) {
        let normalizedValues = this.normalizeCreateValues(values);
        let row = await this.db.create(this.table, normalizedValues, {
            ...options,
            returnRow: true,
        });
        return this.build(row);
    }
    /**
     * Updates a row by lookup value and returns the updated model instance.
     *
     * @param value Primary key value.
     * @param changes Changes to persist.
     * @param options Optional write options.
     * @returns Updated model instance, or `null` when no row matches.
     */
    static async update(value, changes, options) {
        let lookupValue = this.normalizeLookupValue(value);
        if (lookupValue === null) {
            return null;
        }
        let normalizedChanges = this.normalizeUpdateValues(changes);
        if (Object.keys(normalizedChanges).length === 0) {
            return this.find(lookupValue, options ? { with: options.with } : undefined);
        }
        let row = await this.db.update(this.table, lookupValue, normalizedChanges, options);
        if (!row) {
            return null;
        }
        return this.build(row);
    }
    /**
     * Deletes a row by lookup value.
     *
     * @param value Primary key value.
     * @returns `true` when a row was deleted, otherwise `false`.
     */
    static async destroy(value) {
        let lookupValue = this.normalizeLookupValue(value);
        if (lookupValue === null) {
            return false;
        }
        return this.db.delete(this.table, lookupValue);
    }
    /**
     * Alias for `destroy`.
     *
     * @param value Primary key value.
     * @returns `true` when a row was deleted, otherwise `false`.
     */
    static async delete(value) {
        return this.destroy(value);
    }
    /**
     * Declares a one-to-many relation from this model to a target model.
     *
     * @param targetModel Related model class.
     * @param options Optional relation configuration.
     * @returns A relation descriptor.
     */
    static hasMany(targetModel, options) {
        return hasMany(this.table, targetModel.table, options);
    }
    /**
     * Declares a one-to-one relation from this model to a target model.
     *
     * @param targetModel Related model class.
     * @param options Optional relation configuration.
     * @returns A relation descriptor.
     */
    static hasOne(targetModel, options) {
        return hasOne(this.table, targetModel.table, options);
    }
    /**
     * Declares an inverse relation from this model to a parent model.
     *
     * @param targetModel Related model class.
     * @param options Optional relation configuration.
     * @returns A relation descriptor.
     */
    static belongsTo(targetModel, options) {
        return belongsTo(this.table, targetModel.table, options);
    }
    /**
     * Declares a one-to-many relation through a join relation.
     *
     * @param targetModel Related model class.
     * @param options Join relation configuration.
     * @returns A relation descriptor.
     */
    static hasManyThrough(targetModel, options) {
        return hasManyThrough(this.table, targetModel.table, options);
    }
    /**
     * Gets the database currently bound to this model class.
     */
    static get db() {
        let database = resolveBoundDatabase(this);
        if (!database) {
            throw new Error('No database bound for model "' + this.name +
                '". Use modelRegistry.bind(database) before calling model methods.');
        }
        return database;
    }
    /**
     * Hydrates a single row into a model instance.
     *
     * @param row Row values to hydrate.
     * @returns A model instance.
     */
    static build(row) {
        let Constructor = this;
        return new Constructor(row);
    }
    /**
     * Hydrates many rows into model instances.
     *
     * @param rows Row values to hydrate.
     * @returns Model instances.
     */
    static buildMany(rows) {
        return rows.map((row) => this.build(row));
    }
    /**
     * Creates a bound subclass that uses the provided database.
     *
     * @param database Database instance to bind to the returned subclass.
     * @returns A bound subclass of the current model class.
     */
    static bind(database) {
        let table = this.table;
        let BoundModel = class extends this {
        };
        Object.defineProperty(BoundModel, modelDatabaseKey, {
            value: database,
            enumerable: false,
            writable: false,
            configurable: false,
        });
        Object.defineProperty(BoundModel, modelTableKey, {
            value: table,
            enumerable: false,
            writable: false,
            configurable: false,
        });
        return BoundModel;
    }
}
function getModelTable(modelClass) {
    return modelClass[modelTableKey];
}
function resolveModelColumns(modelClass) {
    let columns = modelClass.columns;
    if (!columns || typeof columns !== 'object') {
        return undefined;
    }
    return columns;
}
function resolveBoundDatabase(modelClass) {
    return modelClass[modelDatabaseKey];
}
