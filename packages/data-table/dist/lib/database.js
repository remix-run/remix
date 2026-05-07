import { DataTableAdapterError, DataTableQueryError } from "./errors.js";
import { executeOperation } from "./database/execution-context.js";
import { asQueryTableInput, getPrimaryKeyWhere, getPrimaryKeyWhereFromRow, normalizeOrderByInput, resolveCreateRowWhere, toWriteResult, } from "./database/helpers.js";
import { executeQuery } from "./database/query-execution.js";
import { bindQueryRuntime, query as createQuery } from "./query.js";
import { isSqlStatement, rawSql } from "./sql.js";
import { getTableName } from "./table.js";
const createInternalDatabase = Symbol('createInternalDatabase');
/**
 * High-level database runtime used to build and execute data manipulation operations.
 *
 * Create instances directly with `new Database(adapter, options)` or use
 * `createDatabase(adapter, options)` as a thin wrapper.
 */
export class Database {
    #adapter;
    #token;
    #now;
    #savepointCounter;
    constructor(adapter, options) {
        this.#adapter = adapter;
        this.#now = options?.now ?? defaultNow;
        this.#savepointCounter = { value: 0 };
    }
    static [createInternalDatabase](adapter, options, internal) {
        let database = new Database(adapter, options);
        database.#token = internal.token;
        database.#savepointCounter = internal.savepointCounter;
        return database;
    }
    get adapter() {
        return this.#adapter;
    }
    now() {
        return this.#now();
    }
    query(table) {
        return createQuery(table)[bindQueryRuntime](this);
    }
    async create(table, values, options) {
        let touch = options?.touch;
        let query = this.query(asQueryTableInput(table));
        if (options?.returnRow !== true) {
            let result = await query.insert(values, { touch });
            return toWriteResult(result);
        }
        if (this.#adapter.capabilities.returning) {
            let result = (await query.insert(values, {
                returning: '*',
                touch,
            }));
            let row = result.row;
            if (!row) {
                throw new DataTableQueryError('create({ returnRow: true }) failed to return an inserted row');
            }
            if (!options.with) {
                return row;
            }
            let where = getPrimaryKeyWhereFromRow(table, row);
            let loaded = await this.findOne(table, {
                where,
                with: options.with,
            });
            if (!loaded) {
                throw new DataTableQueryError('create({ returnRow: true }) failed to load inserted row');
            }
            return loaded;
        }
        let insertResult = await query.insert(values, { touch });
        let where = resolveCreateRowWhere(table, values, toWriteResult(insertResult).insertId);
        let loaded = await this.findOne(table, {
            where,
            with: options.with,
        });
        if (!loaded) {
            throw new DataTableQueryError('create({ returnRow: true }) failed to load inserted row');
        }
        return loaded;
    }
    async createMany(table, values, options) {
        let query = this.query(asQueryTableInput(table));
        if (options?.returnRows === true) {
            if (!this.#adapter.capabilities.returning) {
                throw new DataTableQueryError('createMany({ returnRows: true }) is not supported by this adapter');
            }
            let result = (await query.insertMany(values, {
                returning: '*',
                touch: options.touch,
            }));
            return result.rows;
        }
        let result = await query.insertMany(values, {
            touch: options?.touch,
        });
        return toWriteResult(result);
    }
    async find(table, value, options) {
        if (value == null) {
            return null;
        }
        let query = this.query(asQueryTableInput(table));
        if (options?.with) {
            return query.with(options.with).find(value);
        }
        return query.find(value);
    }
    async findOne(table, options) {
        let query = this.query(asQueryTableInput(table)).where(options.where);
        let orderBy = normalizeOrderByInput(options.orderBy);
        for (let [column, direction] of orderBy) {
            query = query.orderBy(column, direction);
        }
        if (options.with) {
            return query.with(options.with).first();
        }
        return query.first();
    }
    async findMany(table, options) {
        let query = this.query(asQueryTableInput(table));
        if (options?.where) {
            query = query.where(options.where);
        }
        let orderBy = normalizeOrderByInput(options?.orderBy);
        for (let [column, direction] of orderBy) {
            query = query.orderBy(column, direction);
        }
        if (options?.limit !== undefined) {
            query = query.limit(options.limit);
        }
        if (options?.offset !== undefined) {
            query = query.offset(options.offset);
        }
        if (options?.with) {
            return query.with(options.with).all();
        }
        return query.all();
    }
    async count(table, options) {
        let query = this.query(asQueryTableInput(table));
        if (options?.where) {
            query = query.where(options.where);
        }
        return query.count();
    }
    async update(table, value, changes, options) {
        let where = getPrimaryKeyWhere(table, value);
        if (this.#adapter.capabilities.returning) {
            let updateResult = (await this.query(asQueryTableInput(table)).where(where).update(changes, {
                touch: options?.touch,
                returning: '*',
            }));
            let updatedRow = updateResult.rows[0];
            if (!updatedRow) {
                throw new DataTableQueryError('update() failed to find row for table "' + getTableName(table) + '"');
            }
            if (!options?.with) {
                return updatedRow;
            }
            let loaded = await this.findOne(table, {
                where: getPrimaryKeyWhereFromRow(table, updatedRow),
                with: options.with,
            });
            if (!loaded) {
                throw new DataTableQueryError('update() failed to find row for table "' + getTableName(table) + '"');
            }
            return loaded;
        }
        await this.query(asQueryTableInput(table)).where(where).update(changes, {
            touch: options?.touch,
        });
        let loaded = await this.find(table, value, { with: options?.with });
        if (!loaded) {
            throw new DataTableQueryError('update() failed to find row for table "' + getTableName(table) + '"');
        }
        return loaded;
    }
    async updateMany(table, changes, options) {
        let query = this.query(asQueryTableInput(table)).where(options.where);
        let orderBy = normalizeOrderByInput(options.orderBy);
        for (let [column, direction] of orderBy) {
            query = query.orderBy(column, direction);
        }
        if (options.limit !== undefined) {
            query = query.limit(options.limit);
        }
        if (options.offset !== undefined) {
            query = query.offset(options.offset);
        }
        let result = await query.update(changes, { touch: options.touch });
        return toWriteResult(result);
    }
    async delete(table, value) {
        let where = getPrimaryKeyWhere(table, value);
        let result = await this.query(asQueryTableInput(table)).where(where).delete();
        return toWriteResult(result).affectedRows > 0;
    }
    async deleteMany(table, options) {
        let query = this.query(asQueryTableInput(table)).where(options.where);
        let orderBy = normalizeOrderByInput(options.orderBy);
        for (let [column, direction] of orderBy) {
            query = query.orderBy(column, direction);
        }
        if (options.limit !== undefined) {
            query = query.limit(options.limit);
        }
        if (options.offset !== undefined) {
            query = query.offset(options.offset);
        }
        let result = await query.delete();
        return toWriteResult(result);
    }
    async exec(statementOrInput, values = []) {
        if (typeof statementOrInput === 'string' || isSqlStatement(statementOrInput)) {
            let sqlStatement = isSqlStatement(statementOrInput)
                ? statementOrInput
                : rawSql(statementOrInput, values);
            return this[executeOperation]({
                kind: 'raw',
                sql: sqlStatement,
            });
        }
        return executeQuery(this, statementOrInput);
    }
    async transaction(callback, options) {
        if (!this.#token) {
            let token = await this.#adapter.beginTransaction(options);
            let tx = Database[createInternalDatabase](this.#adapter, { now: this.#now }, {
                token,
                savepointCounter: this.#savepointCounter,
            });
            try {
                let result = await callback(tx);
                await this.#adapter.commitTransaction(token);
                return result;
            }
            catch (error) {
                await this.#adapter.rollbackTransaction(token);
                throw error;
            }
        }
        if (!this.#adapter.capabilities.savepoints) {
            throw new DataTableQueryError('Nested transactions require adapter savepoint support');
        }
        let savepointName = 'sp_' + String(this.#savepointCounter.value);
        this.#savepointCounter.value += 1;
        await this.#adapter.createSavepoint(this.#token, savepointName);
        try {
            let result = await callback(this);
            await this.#adapter.releaseSavepoint(this.#token, savepointName);
            return result;
        }
        catch (error) {
            await this.#adapter.rollbackToSavepoint(this.#token, savepointName);
            await this.#adapter.releaseSavepoint(this.#token, savepointName);
            throw error;
        }
    }
    async [executeOperation](operation) {
        try {
            return await this.#adapter.execute({
                operation,
                transaction: this.#token,
            });
        }
        catch (error) {
            throw new DataTableAdapterError('Adapter execution failed', {
                cause: error,
                metadata: {
                    dialect: this.#adapter.dialect,
                    operationKind: operation.kind,
                },
            });
        }
    }
}
/**
 * Creates a database runtime from an adapter.
 * Thin wrapper around `new Database(adapter, options)`.
 * @param adapter Adapter implementation responsible for SQL execution.
 * @param options Optional runtime options.
 * @param options.now Clock function used for auto-managed timestamps.
 * @returns A {@link Database} API instance.
 * @example
 * ```ts
 * import { column as c, createDatabase, table } from 'remix/data-table'
 *
 * let users = table({
 *   name: 'users',
 *   columns: {
 *     id: c.integer(),
 *     email: c.varchar(255),
 *   },
 * })
 *
 * let db = createDatabase(adapter)
 * let rows = await db.query(users).where({ id: 1 }).all()
 * ```
 */
export function createDatabase(adapter, options) {
    return new Database(adapter, options);
}
/**
 * Creates a database runtime bound to an existing adapter transaction token.
 * This is an internal helper used by the migration runner.
 * @param adapter Adapter implementation responsible for SQL execution.
 * @param token Active adapter transaction token.
 * @param options Optional runtime options.
 * @param options.now Clock function used for auto-managed timestamps.
 * @returns A {@link Database} API instance bound to the provided transaction.
 */
export function createDatabaseWithTransaction(adapter, token, options) {
    return Database[createInternalDatabase](adapter, options, {
        token,
        savepointCounter: { value: 0 },
    });
}
function defaultNow() {
    return new Date();
}
