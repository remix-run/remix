import { DataTableDatabaseError, DataTableQueryError } from './errors.js';
import { executeOperation, runInTransaction, } from './database/execution-context.js';
import { asQueryTableInput, getPrimaryKeyWhere, getPrimaryKeyWhereFromRow, normalizeOrderByInput, resolveCreateRowWhere, toWriteResult, } from './database/helpers.js';
import { executeQuery } from './database/query-execution.js';
import { bindQueryRuntime, query as createQuery } from './query.js';
import { createMigrationRunner } from './migrations/runner.js';
import { isSqlStatement, rawSql } from './sql.js';
import { getTableName } from './table.js';
/**
 * High-level database runtime used to query and manage a database.
 *
 * Database dialects extend this class and provide a {@link DatabaseDriver} to the constructor.
 * The driver owns SQL execution, transactions, and connection lifecycle while this class provides
 * the shared query, persistence, and migration APIs.
 */
export class Database {
    #driver;
    #executionContext;
    #token;
    #now;
    #savepointCounter;
    /**
     * Creates a database backed by a driver.
     * @param driver Low-level database engine integration.
     * @param options Database runtime options.
     */
    constructor(driver, options) {
        this.#driver = driver;
        this.#now = options?.now ?? defaultNow;
        this.#savepointCounter = { value: 0 };
        let database = this;
        this.#executionContext = {
            get capabilities() {
                return database.capabilities;
            },
            now() {
                return database.now();
            },
            [executeOperation](operation) {
                return database.#executeOperation(operation);
            },
            [runInTransaction](callback, transactionOptions) {
                return database.#runInTransaction((transactionDatabase) => callback(transactionDatabase.#executionContext), transactionOptions);
            },
        };
    }
    static #createInternalDatabase(driver, options, internal) {
        let database = new Database(driver, options);
        database.#token = internal.token;
        database.#savepointCounter = internal.savepointCounter;
        return database;
    }
    /** Stable identifier for the SQL dialect. */
    get dialect() {
        return this.#driver.dialect;
    }
    /** Immutable feature flags used by shared query and migration behavior. */
    get capabilities() {
        return this.#driver.capabilities;
    }
    /**
     * Executes a migration or raw multi-statement SQL script.
     * @param sql SQL script to execute.
     * @returns A promise that resolves when execution completes.
     */
    executeScript(sql) {
        return this.#driver.executeScript(sql, this.#token);
    }
    /**
     * Reports whether a table exists.
     * @param table Table to inspect.
     * @returns A promise that resolves to `true` when the table exists.
     */
    hasTable(table) {
        return this.#driver.hasTable(table, this.#token);
    }
    /**
     * Reports whether a column exists on a table.
     * @param table Table to inspect.
     * @param column Column name to inspect.
     * @returns A promise that resolves to `true` when the column exists.
     */
    hasColumn(table, column) {
        return this.#driver.hasColumn(table, column, this.#token);
    }
    /**
     * Closes resources owned by this database.
     * @returns A promise that resolves when owned resources have been released.
     */
    async close() {
        this.#assertLifecycleOperationAllowed('close');
        await this.#driver.close();
    }
    /**
     * Destructively recreates the configured database.
     * @returns A promise that resolves when the database is ready for use.
     */
    async wipe() {
        this.#assertLifecycleOperationAllowed('wipe');
        await this.#driver.wipe();
    }
    /**
     * Applies or reverts migrations in order.
     *
     * @param migrations Migration descriptors or registry to apply.
     * @param options Migration direction, bound, dry-run, and journal configuration.
     * @returns The migrations applied or reverted by this run and their SQL scripts.
     */
    async migrate(migrations, options) {
        this.#assertLifecycleOperationAllowed('migrate');
        let { direction = 'up', journalTable, ...migrateOptions } = options ?? {};
        let runner = createMigrationRunner(this.#driver, migrations, { journalTable });
        return direction === 'up' ? runner.up(migrateOptions) : runner.down(migrateOptions);
    }
    /**
     * Reports the current state of the provided migrations.
     *
     * @param migrations Migration descriptors or registry to inspect.
     * @param options Migration journal configuration.
     * @returns Status entries for the provided migrations.
     */
    async migrationStatus(migrations, options = {}) {
        this.#assertLifecycleOperationAllowed('migrationStatus');
        let runner = createMigrationRunner(this.#driver, migrations, options);
        return runner.status();
    }
    /**
     * Wipes the database, applies migrations, and optionally seeds data.
     *
     * @param options Migrations and optional seed function used to rebuild the database.
     * @returns A promise that resolves when the database has been rebuilt.
     */
    async reset(options) {
        this.#assertLifecycleOperationAllowed('reset');
        await this.wipe();
        await this.migrate(options.migrations, { journalTable: options.journalTable });
        await options.seed?.(this);
    }
    #assertLifecycleOperationAllowed(method) {
        if (this.#token) {
            throw new DataTableQueryError('Cannot call ' + method + '() from a transaction-scoped database');
        }
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
        if (this.capabilities.returning) {
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
            if (!this.capabilities.returning) {
                throw new DataTableQueryError('createMany({ returnRows: true }) is not supported by this database');
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
        if (this.capabilities.returning) {
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
            return this.#executeOperation({
                kind: 'raw',
                sql: sqlStatement,
            });
        }
        return executeQuery(this.#executionContext, statementOrInput);
    }
    async transaction(callback, options) {
        return this.#runInTransaction(callback, options);
    }
    async #runInTransaction(callback, options) {
        if (!this.#token) {
            let token = await this.#driver.beginTransaction(options);
            let tx = Database.#createInternalDatabase(this.#driver, { now: this.#now }, {
                token,
                savepointCounter: this.#savepointCounter,
            });
            let result;
            try {
                result = await callback(tx);
            }
            catch (error) {
                try {
                    await this.#driver.rollbackTransaction(token);
                }
                catch (rollbackError) {
                    throw new AggregateError([error, rollbackError], 'Database transaction and rollback both failed', { cause: error });
                }
                throw error;
            }
            await this.#driver.commitTransaction(token);
            return result;
        }
        if (!this.capabilities.savepoints) {
            throw new DataTableQueryError('Nested transactions require database savepoint support');
        }
        let savepointName = 'sp_' + String(this.#savepointCounter.value);
        this.#savepointCounter.value += 1;
        await this.#driver.createSavepoint(this.#token, savepointName);
        let result;
        try {
            result = await callback(this);
        }
        catch (error) {
            let failures = [error];
            try {
                await this.#driver.rollbackToSavepoint(this.#token, savepointName);
            }
            catch (rollbackError) {
                failures.push(rollbackError);
            }
            try {
                await this.#driver.releaseSavepoint(this.#token, savepointName);
            }
            catch (releaseError) {
                failures.push(releaseError);
            }
            if (failures.length > 1) {
                throw new AggregateError(failures, 'Nested transaction cleanup failed', { cause: error });
            }
            throw error;
        }
        await this.#driver.releaseSavepoint(this.#token, savepointName);
        return result;
    }
    async #executeOperation(operation) {
        try {
            return await this.#driver.execute({
                operation,
                transaction: this.#token,
            });
        }
        catch (error) {
            throw new DataTableDatabaseError('Database execution failed', {
                cause: error,
                metadata: {
                    dialect: this.dialect,
                    operationKind: operation.kind,
                },
            });
        }
    }
}
function defaultNow() {
    return new Date();
}
