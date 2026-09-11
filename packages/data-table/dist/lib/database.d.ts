import type { ColumnDefinition, DataManipulationResult, DatabaseCapabilities, DatabaseDriver, TableRef, TransactionOptions } from './driver.ts';
import type { ColumnBuilder } from './column.ts';
import type { AnyQuery, BoundQueryPhase, Query as QueryObject, QueryExecutionResult } from './query.ts';
import type { ColumnInput, NormalizeColumnInput, TableMetadataLike } from './references.ts';
import type { DatabaseMigrateOptions, DatabaseMigrationStatusOptions, DatabaseResetOptions, MigrateResult, Migrations, MigrationStatusEntry } from './migrations.ts';
import type { SqlStatement } from './sql.ts';
import type { AnyRelation, AnyTable, LoadedRelationMap, OrderDirection, PrimaryKeyInput, TableName, TablePrimaryKey, TableRow, TableRowWith, TableValidate, tableMetadataKey, TimestampConfig } from './table.ts';
import type { Pretty } from './types.ts';
import type { WhereInput } from './operators.ts';
export type TableColumnName<table extends AnyTable> = keyof TableRow<table> & string;
export type QualifiedTableColumnName<table extends AnyTable> = `${TableName<table>}.${TableColumnName<table>}`;
export type QueryColumnName<table extends AnyTable> = TableColumnName<table> | QualifiedTableColumnName<table>;
type RowColumnName<row extends Record<string, unknown>> = keyof row & string;
type QualifiedRowColumnName<tableName extends string, row extends Record<string, unknown>> = `${tableName}.${RowColumnName<row>}`;
export type QueryColumnTypeMapFromRow<tableName extends string, row extends Record<string, unknown>> = {
    [column in RowColumnName<row> | QualifiedRowColumnName<tableName, row>]: column extends RowColumnName<row> ? row[column] : column extends `${tableName}.${infer name extends RowColumnName<row>}` ? row[name] : never;
};
export type QueryColumnTypeMap<table extends AnyTable> = Pretty<QueryColumnTypeMapFromRow<TableName<table>, TableRow<table>>>;
export type MergeColumnTypeMaps<left extends Record<string, unknown>, right extends Record<string, unknown>> = Pretty<{
    [column in Extract<keyof left | keyof right, string>]: column extends keyof right ? column extends keyof left ? left[column] | right[column] : right[column] : column extends keyof left ? left[column] : never;
}>;
export type QueryColumns<columnTypes extends Record<string, unknown>> = Extract<keyof columnTypes, string>;
export type QueryColumnInput<columnTypes extends Record<string, unknown>> = ColumnInput<QueryColumns<columnTypes>>;
export type SelectedAliasRow<columnTypes extends Record<string, unknown>, selection extends Record<string, QueryColumnInput<columnTypes>>> = Pretty<{
    [alias in keyof selection]: NormalizeColumnInput<selection[alias]> extends keyof columnTypes ? columnTypes[NormalizeColumnInput<selection[alias]>] : never;
}>;
export type RelationMapForSourceName<tableName extends string> = Record<string, AnyRelation & {
    sourceTable: {
        [tableMetadataKey]: {
            name: tableName;
        };
    };
}>;
export type PrimaryKeyInputForRow<row extends Record<string, unknown>, primaryKey extends readonly string[]> = primaryKey extends readonly [infer column extends keyof row & string] ? row[column] : {
    [column in primaryKey[number] & keyof row]: row[column];
};
export type ReturningInput<row extends Record<string, unknown>> = '*' | (keyof row & string)[];
/**
 * Table-like metadata accepted by `database.query()`.
 */
export type QueryTableInput<tableName extends string, row extends Record<string, unknown>, primaryKey extends readonly (keyof row & string)[]> = TableMetadataLike<tableName, {
    [column in keyof row & string]: ColumnBuilder<row[column]>;
}, primaryKey, TimestampConfig | null> & {
    [tableMetadataKey]: {
        name: tableName;
        columns: {
            [column in keyof row & string]: ColumnBuilder<row[column]>;
        };
        primaryKey: primaryKey;
        timestamps: TimestampConfig | null;
        columnDefinitions: Record<string, ColumnDefinition>;
        validate?: TableValidate<Record<string, unknown>>;
    };
} & Record<string, unknown>;
/**
 * Result metadata for write operations that do not return rows.
 */
export type WriteResult = {
    affectedRows: number;
    insertId?: unknown;
};
/**
 * Result metadata for write operations that return multiple rows.
 */
export type WriteRowsResult<row> = {
    affectedRows: number;
    insertId?: unknown;
    rows: row[];
};
/**
 * Result metadata for write operations that return a single row.
 */
export type WriteRowResult<row> = {
    affectedRows: number;
    insertId?: unknown;
    row: row | null;
};
/**
 * Queryable column type map for a concrete table.
 */
export type QueryColumnTypesForTable<table extends AnyTable> = QueryColumnTypeMap<table>;
/**
 * Query type produced for a concrete table.
 */
export type QueryForTable<table extends AnyTable, loaded extends Record<string, unknown> = {}> = QueryObject<QueryTableInput<TableName<table>, TableRow<table>, TablePrimaryKey<table>>, QueryColumnTypesForTable<table>, TableRow<table>, loaded, BoundQueryPhase<'all'>>;
/**
 * Column names accepted in single-table queries.
 */
export type SingleTableColumn<table extends AnyTable> = QueryColumns<QueryColumnTypeMap<table>>;
/**
 * `where` input accepted in single-table queries.
 */
export type SingleTableWhere<table extends AnyTable> = WhereInput<SingleTableColumn<table>>;
/**
 * Tuple form accepted by `orderBy` for a single table.
 */
export type OrderByTuple<table extends AnyTable> = [
    column: SingleTableColumn<table>,
    direction?: OrderDirection
];
/**
 * `orderBy` input accepted in single-table queries.
 */
export type OrderByInput<table extends AnyTable> = OrderByTuple<table> | OrderByTuple<table>[];
/**
 * Options for loading many rows from a table.
 */
export type FindManyOptions<table extends AnyTable, relations extends RelationMapForSourceName<TableName<table>> = {}> = {
    where?: SingleTableWhere<table>;
    orderBy?: OrderByInput<table>;
    limit?: number;
    offset?: number;
    with?: relations;
};
/**
 * Options for loading a single row from a table.
 */
export type FindOneOptions<table extends AnyTable, relations extends RelationMapForSourceName<TableName<table>> = {}> = Omit<FindManyOptions<table, relations>, 'limit' | 'offset'> & {
    where: SingleTableWhere<table>;
};
/**
 * Options for updating a single row.
 */
export type UpdateOptions<table extends AnyTable, relations extends RelationMapForSourceName<TableName<table>> = {}> = {
    touch?: boolean;
    with?: relations;
};
/**
 * Options for updating many rows.
 */
export type UpdateManyOptions<table extends AnyTable> = {
    where: SingleTableWhere<table>;
    orderBy?: OrderByInput<table>;
    limit?: number;
    offset?: number;
    touch?: boolean;
};
/**
 * Options for deleting many rows.
 */
export type DeleteManyOptions<table extends AnyTable> = {
    where: SingleTableWhere<table>;
    orderBy?: OrderByInput<table>;
    limit?: number;
    offset?: number;
};
/**
 * Options for counting rows.
 */
export type CountOptions<table extends AnyTable> = {
    where?: SingleTableWhere<table>;
};
/**
 * Options for create operations that return only write metadata.
 */
export type CreateResultOptions = {
    touch?: boolean;
    returnRow?: false;
};
/**
 * Options for create operations that return the inserted row.
 */
export type CreateRowOptions<table extends AnyTable, relations extends RelationMapForSourceName<TableName<table>> = {}> = {
    touch?: boolean;
    with?: relations;
    returnRow: true;
};
/**
 * Options for bulk-create operations that return only write metadata.
 */
export type CreateManyResultOptions = {
    touch?: boolean;
    returnRows?: false;
};
/**
 * Options for bulk-create operations that return inserted rows.
 */
export type CreateManyRowsOptions = {
    touch?: boolean;
    returnRows: true;
};
/** Options shared by database instances. */
export interface DatabaseOptions {
    /** Clock function used for auto-managed timestamps. */
    now?: () => unknown;
}
/**
 * High-level database runtime used to query and manage a database.
 *
 * Database dialects extend this class and provide a {@link DatabaseDriver} to the constructor.
 * The driver owns SQL execution, transactions, and connection lifecycle while this class provides
 * the shared query, persistence, and migration APIs.
 */
export declare class Database<dialect extends string = string> {
    #private;
    /**
     * Creates a database backed by a driver.
     * @param driver Low-level database engine integration.
     * @param options Database runtime options.
     */
    constructor(driver: DatabaseDriver<dialect>, options?: DatabaseOptions);
    /** Stable identifier for the SQL dialect. */
    get dialect(): dialect;
    /** Immutable feature flags used by shared query and migration behavior. */
    get capabilities(): DatabaseCapabilities;
    /**
     * Executes a migration or raw multi-statement SQL script.
     * @param sql SQL script to execute.
     * @returns A promise that resolves when execution completes.
     */
    executeScript(sql: string): Promise<void>;
    /**
     * Reports whether a table exists.
     * @param table Table to inspect.
     * @returns A promise that resolves to `true` when the table exists.
     */
    hasTable(table: TableRef): Promise<boolean>;
    /**
     * Reports whether a column exists on a table.
     * @param table Table to inspect.
     * @param column Column name to inspect.
     * @returns A promise that resolves to `true` when the column exists.
     */
    hasColumn(table: TableRef, column: string): Promise<boolean>;
    /**
     * Closes resources owned by this database.
     * @returns A promise that resolves when owned resources have been released.
     */
    close(): Promise<void>;
    /**
     * Destructively recreates the configured database.
     * @returns A promise that resolves when the database is ready for use.
     */
    wipe(): Promise<void>;
    /**
     * Applies or reverts migrations in order.
     *
     * @param migrations Migration descriptors or registry to apply.
     * @param options Migration direction, bound, dry-run, and journal configuration.
     * @returns The migrations applied or reverted by this run and their SQL scripts.
     */
    migrate(migrations: Migrations, options?: DatabaseMigrateOptions): Promise<MigrateResult>;
    /**
     * Reports the current state of the provided migrations.
     *
     * @param migrations Migration descriptors or registry to inspect.
     * @param options Migration journal configuration.
     * @returns Status entries for the provided migrations.
     */
    migrationStatus(migrations: Migrations, options?: DatabaseMigrationStatusOptions): Promise<MigrationStatusEntry[]>;
    /**
     * Wipes the database, applies migrations, and optionally seeds data.
     *
     * @param options Migrations and optional seed function used to rebuild the database.
     * @returns A promise that resolves when the database has been rebuilt.
     */
    reset(options: DatabaseResetOptions): Promise<void>;
    now(): unknown;
    query<tableName extends string, row extends Record<string, unknown>, primaryKey extends readonly (keyof row & string)[]>(table: QueryTableInput<tableName, row, primaryKey>): QueryObject<QueryTableInput<tableName, row, primaryKey>, Pretty<QueryColumnTypeMapFromRow<tableName, row>>, row, {}, BoundQueryPhase<'all'>>;
    create<table extends AnyTable>(table: table, values: Partial<TableRow<table>>, options?: CreateResultOptions): Promise<WriteResult>;
    create<table extends AnyTable, relations extends RelationMapForSourceName<TableName<table>> = {}>(table: table, values: Partial<TableRow<table>>, options: CreateRowOptions<table, relations>): Promise<TableRowWith<table, LoadedRelationMap<relations>>>;
    createMany<table extends AnyTable>(table: table, values: Array<Partial<TableRow<table>>>, options?: CreateManyResultOptions): Promise<WriteResult>;
    createMany<table extends AnyTable>(table: table, values: Array<Partial<TableRow<table>>>, options: CreateManyRowsOptions): Promise<TableRow<table>[]>;
    find<table extends AnyTable, relations extends RelationMapForSourceName<TableName<table>> = {}>(table: table, value: PrimaryKeyInput<table>, options?: {
        with?: relations;
    }): Promise<TableRowWith<table, LoadedRelationMap<relations>> | null>;
    findOne<table extends AnyTable, relations extends RelationMapForSourceName<TableName<table>> = {}>(table: table, options: FindOneOptions<table, relations>): Promise<TableRowWith<table, LoadedRelationMap<relations>> | null>;
    findMany<table extends AnyTable, relations extends RelationMapForSourceName<TableName<table>> = {}>(table: table, options?: FindManyOptions<table, relations>): Promise<Array<TableRowWith<table, LoadedRelationMap<relations>>>>;
    count<table extends AnyTable>(table: table, options?: CountOptions<table>): Promise<number>;
    update<table extends AnyTable, relations extends RelationMapForSourceName<TableName<table>> = {}>(table: table, value: PrimaryKeyInput<table>, changes: Partial<TableRow<table>>, options?: UpdateOptions<table, relations>): Promise<TableRowWith<table, LoadedRelationMap<relations>>>;
    updateMany<table extends AnyTable>(table: table, changes: Partial<TableRow<table>>, options: UpdateManyOptions<table>): Promise<WriteResult>;
    delete<table extends AnyTable>(table: table, value: PrimaryKeyInput<table>): Promise<boolean>;
    deleteMany<table extends AnyTable>(table: table, options: DeleteManyOptions<table>): Promise<WriteResult>;
    exec(statement: string | SqlStatement, values?: unknown[]): Promise<DataManipulationResult>;
    exec<input extends AnyQuery>(input: input): Promise<QueryExecutionResult<input>>;
    transaction<result>(callback: (database: Database<dialect>) => Promise<result>, options?: TransactionOptions): Promise<result>;
}
export {};
//# sourceMappingURL=database.d.ts.map