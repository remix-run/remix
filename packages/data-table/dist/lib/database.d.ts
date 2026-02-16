import type { Schema } from '@remix-run/data-schema';
import type { AdapterResult, DatabaseAdapter, JoinClause, JoinType, SelectColumn, TransactionOptions, TransactionToken } from './adapter.ts';
import type { AnyRelation, AnyTable, LoadedRelationMap, OrderByClause, OrderDirection, PrimaryKeyInput, TableName, TablePrimaryKey, TableRow, TableRowWith, TimestampConfig, tableMetadataKey } from './table.ts';
import type { Predicate, WhereInput } from './operators.ts';
import type { SqlStatement } from './sql.ts';
import type { AdapterStatement } from './adapter.ts';
import type { Pretty } from './types.ts';
import type { ColumnInput, NormalizeColumnInput, TableMetadataLike } from './references.ts';
type QueryState = {
    select: '*' | SelectColumn[];
    distinct: boolean;
    joins: JoinClause[];
    where: Predicate<string>[];
    groupBy: string[];
    having: Predicate<string>[];
    orderBy: OrderByClause[];
    limit?: number;
    offset?: number;
    with: Record<string, AnyRelation>;
};
type TableColumnName<table extends AnyTable> = keyof TableRow<table> & string;
type QualifiedTableColumnName<table extends AnyTable> = `${TableName<table>}.${TableColumnName<table>}`;
type QueryColumnName<table extends AnyTable> = TableColumnName<table> | QualifiedTableColumnName<table>;
type RowColumnName<row extends Record<string, unknown>> = keyof row & string;
type QualifiedRowColumnName<tableName extends string, row extends Record<string, unknown>> = `${tableName}.${RowColumnName<row>}`;
type QueryColumnTypeMapFromRow<tableName extends string, row extends Record<string, unknown>> = {
    [column in RowColumnName<row> | QualifiedRowColumnName<tableName, row>]: column extends RowColumnName<row> ? row[column] : column extends `${tableName}.${infer name extends RowColumnName<row>}` ? row[name] : never;
};
type QueryColumnTypeMap<table extends AnyTable> = Pretty<QueryColumnTypeMapFromRow<TableName<table>, TableRow<table>>>;
type MergeColumnTypeMaps<left extends Record<string, unknown>, right extends Record<string, unknown>> = Pretty<{
    [column in Extract<keyof left | keyof right, string>]: column extends keyof right ? column extends keyof left ? left[column] | right[column] : right[column] : column extends keyof left ? left[column] : never;
}>;
type QueryColumns<columnTypes extends Record<string, unknown>> = Extract<keyof columnTypes, string>;
type QueryColumnInput<columnTypes extends Record<string, unknown>> = ColumnInput<QueryColumns<columnTypes>>;
type SelectedAliasRow<columnTypes extends Record<string, unknown>, selection extends Record<string, QueryColumnInput<columnTypes>>> = Pretty<{
    [alias in keyof selection]: NormalizeColumnInput<selection[alias]> extends keyof columnTypes ? columnTypes[NormalizeColumnInput<selection[alias]>] : never;
}>;
type SavepointCounter = {
    value: number;
};
declare const executeStatement: unique symbol;
type RelationMapForSourceName<tableName extends string> = Record<string, AnyRelation & {
    sourceTable: {
        [tableMetadataKey]: {
            name: tableName;
        };
    };
}>;
type PrimaryKeyInputForRow<row extends Record<string, unknown>, primaryKey extends readonly string[]> = primaryKey extends readonly [infer column extends keyof row & string] ? row[column] : {
    [column in primaryKey[number] & keyof row]: row[column];
};
type ReturningInput<row extends Record<string, unknown>> = '*' | (keyof row & string)[];
export type QueryTableInput<tableName extends string, row extends Record<string, unknown>, primaryKey extends readonly (keyof row & string)[]> = TableMetadataLike<tableName, {
    [column in keyof row & string]: Schema<any, row[column]>;
}, primaryKey, TimestampConfig | null> & {
    '~standard': Schema<unknown, Partial<row>>['~standard'];
} & Record<string, unknown>;
export type QueryBuilderFor<tableName extends string, row extends Record<string, unknown>, primaryKey extends readonly (keyof row & string)[], loaded extends Record<string, unknown> = {}> = QueryBuilder<Pretty<QueryColumnTypeMapFromRow<tableName, row>>, row, loaded, tableName, primaryKey>;
export type QueryMethod = <tableName extends string, row extends Record<string, unknown>, primaryKey extends readonly (keyof row & string)[]>(table: QueryTableInput<tableName, row, primaryKey>) => QueryBuilderFor<tableName, row, primaryKey>;
export type WriteResult = {
    affectedRows: number;
    insertId?: unknown;
};
export type WriteRowsResult<row> = {
    affectedRows: number;
    insertId?: unknown;
    rows: row[];
};
export type WriteRowResult<row> = {
    affectedRows: number;
    insertId?: unknown;
    row: row | null;
};
export type QueryColumnTypesForTable<table extends AnyTable> = QueryColumnTypeMap<table>;
export type QueryForTable<table extends AnyTable, loaded extends Record<string, unknown> = {}> = QueryBuilder<QueryColumnTypesForTable<table>, TableRow<table>, loaded, TableName<table>, TablePrimaryKey<table>>;
export type SingleTableColumn<table extends AnyTable> = QueryColumns<QueryColumnTypeMap<table>>;
export type SingleTableWhere<table extends AnyTable> = WhereInput<SingleTableColumn<table>>;
export type OrderByTuple<table extends AnyTable> = [
    column: SingleTableColumn<table>,
    direction?: OrderDirection
];
export type OrderByInput<table extends AnyTable> = OrderByTuple<table> | OrderByTuple<table>[];
export type FindManyOptions<table extends AnyTable, relations extends RelationMapForSourceName<TableName<table>> = {}> = {
    where?: SingleTableWhere<table>;
    orderBy?: OrderByInput<table>;
    limit?: number;
    offset?: number;
    with?: relations;
};
export type FindOneOptions<table extends AnyTable, relations extends RelationMapForSourceName<TableName<table>> = {}> = Omit<FindManyOptions<table, relations>, 'limit' | 'offset'> & {
    where: SingleTableWhere<table>;
};
export type UpdateOptions<table extends AnyTable, relations extends RelationMapForSourceName<TableName<table>> = {}> = {
    touch?: boolean;
    with?: relations;
};
export type UpdateManyOptions<table extends AnyTable> = {
    where: SingleTableWhere<table>;
    orderBy?: OrderByInput<table>;
    limit?: number;
    offset?: number;
    touch?: boolean;
};
export type DeleteManyOptions<table extends AnyTable> = {
    where: SingleTableWhere<table>;
    orderBy?: OrderByInput<table>;
    limit?: number;
    offset?: number;
};
export type CountOptions<table extends AnyTable> = {
    where?: SingleTableWhere<table>;
};
export type CreateResultOptions = {
    touch?: boolean;
    returnRow?: false;
};
export type CreateRowOptions<table extends AnyTable, relations extends RelationMapForSourceName<TableName<table>> = {}> = {
    touch?: boolean;
    with?: relations;
    returnRow: true;
};
export type CreateManyResultOptions = {
    touch?: boolean;
    returnRows?: false;
};
export type CreateManyRowsOptions = {
    touch?: boolean;
    returnRows: true;
};
export type Database = {
    adapter: DatabaseAdapter;
    now(): unknown;
    query: QueryMethod;
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
    update<table extends AnyTable, relations extends RelationMapForSourceName<TableName<table>> = {}>(table: table, value: PrimaryKeyInput<table>, changes: Partial<TableRow<table>>, options?: UpdateOptions<table, relations>): Promise<TableRowWith<table, LoadedRelationMap<relations>> | null>;
    updateMany<table extends AnyTable>(table: table, changes: Partial<TableRow<table>>, options: UpdateManyOptions<table>): Promise<WriteResult>;
    delete<table extends AnyTable>(table: table, value: PrimaryKeyInput<table>): Promise<boolean>;
    deleteMany<table extends AnyTable>(table: table, options: DeleteManyOptions<table>): Promise<WriteResult>;
    exec(statement: string | SqlStatement, values?: unknown[]): Promise<AdapterResult>;
    transaction<result>(callback: (database: Database) => Promise<result>, options?: TransactionOptions): Promise<result>;
};
declare class DatabaseRuntime implements Database {
    #private;
    constructor(options: {
        adapter: DatabaseAdapter;
        token?: TransactionToken;
        now: () => unknown;
        savepointCounter: SavepointCounter;
    });
    get adapter(): DatabaseAdapter;
    now(): unknown;
    query: QueryMethod;
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
    update<table extends AnyTable, relations extends RelationMapForSourceName<TableName<table>> = {}>(table: table, value: PrimaryKeyInput<table>, changes: Partial<TableRow<table>>, options?: UpdateOptions<table, relations>): Promise<TableRowWith<table, LoadedRelationMap<relations>> | null>;
    updateMany<table extends AnyTable>(table: table, changes: Partial<TableRow<table>>, options: UpdateManyOptions<table>): Promise<WriteResult>;
    delete<table extends AnyTable>(table: table, value: PrimaryKeyInput<table>): Promise<boolean>;
    deleteMany<table extends AnyTable>(table: table, options: DeleteManyOptions<table>): Promise<WriteResult>;
    exec(statement: string | SqlStatement, values?: unknown[]): Promise<AdapterResult>;
    transaction<result>(callback: (database: Database) => Promise<result>, options?: TransactionOptions): Promise<result>;
    [executeStatement](statement: AdapterStatement): Promise<AdapterResult>;
}
/**
 * Creates a database runtime from an adapter.
 * @param adapter Adapter implementation responsible for SQL execution.
 * @param options Optional runtime options.
 * @param options.now Clock function used for auto-managed timestamps.
 * @returns A `Database` API instance.
 */
export declare function createDatabase(adapter: DatabaseAdapter, options?: {
    now?: () => unknown;
}): Database;
/**
 * Immutable query builder used by `db.query(table)`.
 */
export declare class QueryBuilder<columnTypes extends Record<string, unknown>, row extends Record<string, unknown>, loaded extends Record<string, unknown> = {}, tableName extends string = string, primaryKey extends readonly string[] = readonly string[]> {
    #private;
    constructor(database: DatabaseRuntime, table: AnyTable, state: QueryState);
    /**
     * Narrows selected columns, optionally with aliases.
     */
    select<selection extends (keyof row & string)[]>(...columns: selection): QueryBuilder<columnTypes, Pick<row, selection[number]>, loaded, tableName, primaryKey>;
    select<selection extends Record<string, QueryColumnInput<columnTypes>>>(selection: selection): QueryBuilder<columnTypes, SelectedAliasRow<columnTypes, selection>, loaded, tableName, primaryKey>;
    /**
     * Toggles `distinct` selection.
     * @param value When `true`, eliminates duplicate rows.
     * @returns A cloned query builder with updated distinct state.
     */
    distinct(value?: boolean): QueryBuilder<columnTypes, row, loaded, tableName, primaryKey>;
    /**
     * Adds a where predicate.
     * @param input Predicate expression or column-value shorthand.
     * @returns A cloned query builder with the appended where predicate.
     */
    where(input: WhereInput<QueryColumns<columnTypes>>): QueryBuilder<columnTypes, row, loaded, tableName, primaryKey>;
    /**
     * Adds a having predicate.
     * @param input Predicate expression or aggregate filter shorthand.
     * @returns A cloned query builder with the appended having predicate.
     */
    having(input: WhereInput<QueryColumns<columnTypes>>): QueryBuilder<columnTypes, row, loaded, tableName, primaryKey>;
    /**
     * Adds a join clause.
     * @param target Target table to join.
     * @param on Join predicate.
     * @param type Join type.
     * @returns A query builder whose column map includes joined table columns.
     */
    join<target extends AnyTable>(target: target, on: Predicate<QueryColumns<columnTypes> | QueryColumnName<target>>, type?: JoinType): QueryBuilder<MergeColumnTypeMaps<columnTypes, QueryColumnTypeMap<target>>, row, loaded, tableName, primaryKey>;
    /**
     * Adds a left join clause.
     * @param target Target table to join.
     * @param on Join predicate.
     * @returns A query builder whose column map includes joined table columns.
     */
    leftJoin<target extends AnyTable>(target: target, on: Predicate<QueryColumns<columnTypes> | QueryColumnName<target>>): QueryBuilder<MergeColumnTypeMaps<columnTypes, QueryColumnTypeMap<target>>, row, loaded, tableName, primaryKey>;
    /**
     * Adds a right join clause.
     * @param target Target table to join.
     * @param on Join predicate.
     * @returns A query builder whose column map includes joined table columns.
     */
    rightJoin<target extends AnyTable>(target: target, on: Predicate<QueryColumns<columnTypes> | QueryColumnName<target>>): QueryBuilder<MergeColumnTypeMaps<columnTypes, QueryColumnTypeMap<target>>, row, loaded, tableName, primaryKey>;
    /**
     * Appends an order-by clause.
     * @param column Column to sort by.
     * @param direction Sort direction.
     * @returns A cloned query builder with the appended order-by clause.
     */
    orderBy(column: QueryColumnInput<columnTypes>, direction?: OrderDirection): QueryBuilder<columnTypes, row, loaded, tableName, primaryKey>;
    /**
     * Appends group-by columns.
     * @param columns Columns to include in the grouping set.
     * @returns A cloned query builder with appended group-by columns.
     */
    groupBy(...columns: QueryColumnInput<columnTypes>[]): QueryBuilder<columnTypes, row, loaded, tableName, primaryKey>;
    /**
     * Limits returned rows.
     * @param value Maximum number of rows to return.
     * @returns A cloned query builder with a row limit.
     */
    limit(value: number): QueryBuilder<columnTypes, row, loaded, tableName, primaryKey>;
    /**
     * Skips returned rows.
     * @param value Number of rows to skip.
     * @returns A cloned query builder with a row offset.
     */
    offset(value: number): QueryBuilder<columnTypes, row, loaded, tableName, primaryKey>;
    /**
     * Configures eager-loaded relations.
     * @param relations Relation map describing nested eager-load behavior.
     * @returns A cloned query builder with relation loading configuration.
     */
    with<relations extends RelationMapForSourceName<tableName>>(relations: relations): QueryBuilder<columnTypes, row, loaded & LoadedRelationMap<relations>, tableName, primaryKey>;
    /**
     * Executes the query and returns all rows.
     * @returns All matching rows with requested eager-loaded relations.
     */
    all(): Promise<Array<row & loaded>>;
    /**
     * Executes the query and returns the first row.
     * @returns The first matching row, or `null` when no rows match.
     */
    first(): Promise<(row & loaded) | null>;
    /**
     * Loads a single row by primary key.
     * @param value Primary-key value or composite-key object.
     * @returns The matching row, or `null` when no row exists.
     */
    find(value: PrimaryKeyInputForRow<row, primaryKey>): Promise<(row & loaded) | null>;
    /**
     * Executes a count query.
     * @returns Number of rows that match the current query scope.
     */
    count(): Promise<number>;
    /**
     * Executes an existence query.
     * @returns `true` when at least one row matches the current query scope.
     */
    exists(): Promise<boolean>;
    /**
     * Inserts one row.
     * @param values Values to insert.
     * @param options Insert options.
     * @param options.returning Optional return selection for adapters that support returning.
     * @param options.touch When `true`, manages timestamp columns automatically.
     * @returns Insert metadata, and optionally the returned row.
     */
    insert(values: Partial<row>, options?: {
        returning?: ReturningInput<row>;
        touch?: boolean;
    }): Promise<WriteResult | WriteRowResult<row>>;
    /**
     * Inserts many rows.
     * @param values Values to insert.
     * @param options Insert options.
     * @param options.returning Optional return selection for adapters that support returning.
     * @param options.touch When `true`, manages timestamp columns automatically.
     * @returns Insert metadata, and optionally the returned rows.
     */
    insertMany(values: Partial<row>[], options?: {
        returning?: ReturningInput<row>;
        touch?: boolean;
    }): Promise<WriteResult | WriteRowsResult<row>>;
    /**
     * Updates scoped rows.
     * @param changes Column changes to apply.
     * @param options Update options.
     * @param options.returning Optional return selection for adapters that support returning.
     * @param options.touch When `true`, updates timestamp columns automatically.
     * @returns Update metadata, and optionally the returned rows.
     */
    update(changes: Partial<row>, options?: {
        returning?: ReturningInput<row>;
        touch?: boolean;
    }): Promise<WriteResult | WriteRowsResult<row>>;
    /**
     * Deletes scoped rows.
     * @param options Delete options.
     * @param options.returning Optional return selection for adapters that support returning.
     * @returns Delete metadata, and optionally the returned rows.
     */
    delete(options?: {
        returning?: ReturningInput<row>;
    }): Promise<WriteResult | WriteRowsResult<row>>;
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
    upsert(values: Partial<row>, options?: {
        returning?: ReturningInput<row>;
        touch?: boolean;
        conflictTarget?: (keyof row & string)[];
        update?: Partial<row>;
    }): Promise<WriteResult | WriteRowResult<row>>;
}
export {};
//# sourceMappingURL=database.d.ts.map