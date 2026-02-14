import type { AdapterResult, DatabaseAdapter, JoinClause, JoinType, SelectColumn, TransactionOptions, TransactionToken } from './adapter.ts';
import type { AnyRelation, AnyTable, DataSchema, LoadedRelationMap, OrderByClause, OrderDirection, PrimaryKeyInput, TableRow, TableRowWithLoaded } from './table.ts';
import type { Predicate, WhereInput } from './operators.ts';
import type { SqlStatement } from './sql.ts';
import type { AdapterStatement } from './adapter.ts';
import type { Pretty } from './types.ts';
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
type QualifiedTableColumnName<table extends AnyTable> = `${table['name']}.${TableColumnName<table>}`;
type QueryColumnName<table extends AnyTable> = TableColumnName<table> | QualifiedTableColumnName<table>;
type RowColumnName<row extends Record<string, unknown>> = keyof row & string;
type QualifiedRowColumnName<tableName extends string, row extends Record<string, unknown>> = `${tableName}.${RowColumnName<row>}`;
type QueryColumnTypeMapFromRow<tableName extends string, row extends Record<string, unknown>> = {
    [column in RowColumnName<row> | QualifiedRowColumnName<tableName, row>]: column extends RowColumnName<row> ? row[column] : column extends `${tableName}.${infer name extends RowColumnName<row>}` ? row[name] : never;
};
type QueryColumnTypeMap<table extends AnyTable> = Pretty<QueryColumnTypeMapFromRow<table['name'], TableRow<table>>>;
type MergeColumnTypeMaps<left extends Record<string, unknown>, right extends Record<string, unknown>> = Pretty<{
    [column in Extract<keyof left | keyof right, string>]: column extends keyof right ? column extends keyof left ? left[column] | right[column] : right[column] : column extends keyof left ? left[column] : never;
}>;
type QueryColumns<columnTypes extends Record<string, unknown>> = Extract<keyof columnTypes, string>;
type SelectedAliasRow<columnTypes extends Record<string, unknown>, selection extends Record<string, QueryColumns<columnTypes>>> = Pretty<{
    [alias in keyof selection]: selection[alias] extends keyof columnTypes ? columnTypes[selection[alias]] : never;
}>;
type SavepointCounter = {
    value: number;
};
declare const executeStatement: unique symbol;
type RelationMapForSourceName<tableName extends string> = Record<string, AnyRelation & {
    sourceTable: {
        name: tableName;
    };
}>;
type PrimaryKeyInputForRow<row extends Record<string, unknown>, primaryKey extends readonly string[]> = primaryKey extends readonly [infer column extends keyof row & string] ? row[column] : {
    [column in primaryKey[number] & keyof row]: row[column];
};
type ReturningInput<row extends Record<string, unknown>> = '*' | (keyof row & string)[];
export type QueryTableInput<tableName extends string, row extends Record<string, unknown>, primaryKey extends readonly (keyof row & string)[]> = AnyTable & {
    kind: 'table';
    name: tableName;
    columns: {
        [column in keyof row & string]: DataSchema<any, row[column]>;
    };
    primaryKey: primaryKey;
};
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
export type QueryForTable<table extends AnyTable, loaded extends Record<string, unknown> = {}> = QueryBuilder<QueryColumnTypesForTable<table>, TableRow<table>, loaded, table['name'], table['primaryKey']>;
export type SingleTableColumn<table extends AnyTable> = QueryColumns<QueryColumnTypeMap<table>>;
export type SingleTableWhere<table extends AnyTable> = WhereInput<SingleTableColumn<table>>;
export type OrderByTuple<table extends AnyTable> = [
    column: SingleTableColumn<table>,
    direction?: OrderDirection
];
export type OrderByInput<table extends AnyTable> = OrderByTuple<table> | OrderByTuple<table>[];
export type FindManyOptions<table extends AnyTable, relations extends RelationMapForSourceName<table['name']> = {}> = {
    where?: SingleTableWhere<table>;
    orderBy?: OrderByInput<table>;
    limit?: number;
    offset?: number;
    with?: relations;
};
export type FindOneOptions<table extends AnyTable, relations extends RelationMapForSourceName<table['name']> = {}> = Omit<FindManyOptions<table, relations>, 'limit' | 'offset'> & {
    where: SingleTableWhere<table>;
};
export type UpdateOptions<table extends AnyTable, relations extends RelationMapForSourceName<table['name']> = {}> = {
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
export type CreateRowOptions<table extends AnyTable, relations extends RelationMapForSourceName<table['name']> = {}> = {
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
    create<table extends AnyTable, relations extends RelationMapForSourceName<table['name']> = {}>(table: table, values: Partial<TableRow<table>>, options: CreateRowOptions<table, relations>): Promise<TableRowWithLoaded<table, LoadedRelationMap<relations>>>;
    createMany<table extends AnyTable>(table: table, values: Array<Partial<TableRow<table>>>, options?: CreateManyResultOptions): Promise<WriteResult>;
    createMany<table extends AnyTable>(table: table, values: Array<Partial<TableRow<table>>>, options: CreateManyRowsOptions): Promise<TableRow<table>[]>;
    find<table extends AnyTable, relations extends RelationMapForSourceName<table['name']> = {}>(table: table, value: PrimaryKeyInput<table>, options?: {
        with?: relations;
    }): Promise<TableRowWithLoaded<table, LoadedRelationMap<relations>> | null>;
    findOne<table extends AnyTable, relations extends RelationMapForSourceName<table['name']> = {}>(table: table, options: FindOneOptions<table, relations>): Promise<TableRowWithLoaded<table, LoadedRelationMap<relations>> | null>;
    findMany<table extends AnyTable, relations extends RelationMapForSourceName<table['name']> = {}>(table: table, options?: FindManyOptions<table, relations>): Promise<Array<TableRowWithLoaded<table, LoadedRelationMap<relations>>>>;
    count<table extends AnyTable>(table: table, options?: CountOptions<table>): Promise<number>;
    update<table extends AnyTable, relations extends RelationMapForSourceName<table['name']> = {}>(table: table, value: PrimaryKeyInput<table>, changes: Partial<TableRow<table>>, options?: UpdateOptions<table, relations>): Promise<TableRowWithLoaded<table, LoadedRelationMap<relations>> | null>;
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
    create<table extends AnyTable, relations extends RelationMapForSourceName<table['name']> = {}>(table: table, values: Partial<TableRow<table>>, options: CreateRowOptions<table, relations>): Promise<TableRowWithLoaded<table, LoadedRelationMap<relations>>>;
    createMany<table extends AnyTable>(table: table, values: Array<Partial<TableRow<table>>>, options?: CreateManyResultOptions): Promise<WriteResult>;
    createMany<table extends AnyTable>(table: table, values: Array<Partial<TableRow<table>>>, options: CreateManyRowsOptions): Promise<TableRow<table>[]>;
    find<table extends AnyTable, relations extends RelationMapForSourceName<table['name']> = {}>(table: table, value: PrimaryKeyInput<table>, options?: {
        with?: relations;
    }): Promise<TableRowWithLoaded<table, LoadedRelationMap<relations>> | null>;
    findOne<table extends AnyTable, relations extends RelationMapForSourceName<table['name']> = {}>(table: table, options: FindOneOptions<table, relations>): Promise<TableRowWithLoaded<table, LoadedRelationMap<relations>> | null>;
    findMany<table extends AnyTable, relations extends RelationMapForSourceName<table['name']> = {}>(table: table, options?: FindManyOptions<table, relations>): Promise<Array<TableRowWithLoaded<table, LoadedRelationMap<relations>>>>;
    count<table extends AnyTable>(table: table, options?: CountOptions<table>): Promise<number>;
    update<table extends AnyTable, relations extends RelationMapForSourceName<table['name']> = {}>(table: table, value: PrimaryKeyInput<table>, changes: Partial<TableRow<table>>, options?: UpdateOptions<table, relations>): Promise<TableRowWithLoaded<table, LoadedRelationMap<relations>> | null>;
    updateMany<table extends AnyTable>(table: table, changes: Partial<TableRow<table>>, options: UpdateManyOptions<table>): Promise<WriteResult>;
    delete<table extends AnyTable>(table: table, value: PrimaryKeyInput<table>): Promise<boolean>;
    deleteMany<table extends AnyTable>(table: table, options: DeleteManyOptions<table>): Promise<WriteResult>;
    exec(statement: string | SqlStatement, values?: unknown[]): Promise<AdapterResult>;
    transaction<result>(callback: (database: Database) => Promise<result>, options?: TransactionOptions): Promise<result>;
    [executeStatement](statement: AdapterStatement): Promise<AdapterResult>;
}
export declare function createDatabase(adapter: DatabaseAdapter, options?: {
    now?: () => unknown;
}): Database;
export declare class QueryBuilder<columnTypes extends Record<string, unknown>, row extends Record<string, unknown>, loaded extends Record<string, unknown> = {}, tableName extends string = string, primaryKey extends readonly string[] = readonly string[]> {
    #private;
    constructor(database: DatabaseRuntime, table: AnyTable, state: QueryState);
    select<selection extends (keyof row & string)[]>(...columns: selection): QueryBuilder<columnTypes, Pick<row, selection[number]>, loaded, tableName, primaryKey>;
    select<selection extends Record<string, QueryColumns<columnTypes>>>(selection: selection): QueryBuilder<columnTypes, SelectedAliasRow<columnTypes, selection>, loaded, tableName, primaryKey>;
    distinct(value?: boolean): QueryBuilder<columnTypes, row, loaded, tableName, primaryKey>;
    where(input: WhereInput<QueryColumns<columnTypes>>): QueryBuilder<columnTypes, row, loaded, tableName, primaryKey>;
    having(input: WhereInput<QueryColumns<columnTypes>>): QueryBuilder<columnTypes, row, loaded, tableName, primaryKey>;
    join<target extends AnyTable>(target: target, on: Predicate<QueryColumns<columnTypes> | QueryColumnName<target>>, type?: JoinType): QueryBuilder<MergeColumnTypeMaps<columnTypes, QueryColumnTypeMap<target>>, row, loaded, tableName, primaryKey>;
    leftJoin<target extends AnyTable>(target: target, on: Predicate<QueryColumns<columnTypes> | QueryColumnName<target>>): QueryBuilder<MergeColumnTypeMaps<columnTypes, QueryColumnTypeMap<target>>, row, loaded, tableName, primaryKey>;
    rightJoin<target extends AnyTable>(target: target, on: Predicate<QueryColumns<columnTypes> | QueryColumnName<target>>): QueryBuilder<MergeColumnTypeMaps<columnTypes, QueryColumnTypeMap<target>>, row, loaded, tableName, primaryKey>;
    orderBy(column: QueryColumns<columnTypes>, direction?: OrderDirection): QueryBuilder<columnTypes, row, loaded, tableName, primaryKey>;
    groupBy(...columns: QueryColumns<columnTypes>[]): QueryBuilder<columnTypes, row, loaded, tableName, primaryKey>;
    limit(value: number): QueryBuilder<columnTypes, row, loaded, tableName, primaryKey>;
    offset(value: number): QueryBuilder<columnTypes, row, loaded, tableName, primaryKey>;
    with<relations extends RelationMapForSourceName<tableName>>(relations: relations): QueryBuilder<columnTypes, row, loaded & LoadedRelationMap<relations>, tableName, primaryKey>;
    all(): Promise<Array<row & loaded>>;
    first(): Promise<(row & loaded) | null>;
    find(value: PrimaryKeyInputForRow<row, primaryKey>): Promise<(row & loaded) | null>;
    count(): Promise<number>;
    exists(): Promise<boolean>;
    insert(values: Partial<row>, options?: {
        returning?: ReturningInput<row>;
        touch?: boolean;
    }): Promise<WriteResult | WriteRowResult<row>>;
    insertMany(values: Partial<row>[], options?: {
        returning?: ReturningInput<row>;
        touch?: boolean;
    }): Promise<WriteResult | WriteRowsResult<row>>;
    update(changes: Partial<row>, options?: {
        returning?: ReturningInput<row>;
        touch?: boolean;
    }): Promise<WriteResult | WriteRowsResult<row>>;
    delete(options?: {
        returning?: ReturningInput<row>;
    }): Promise<WriteResult | WriteRowsResult<row>>;
    upsert(values: Partial<row>, options?: {
        returning?: ReturningInput<row>;
        touch?: boolean;
        conflictTarget?: (keyof row & string)[];
        update?: Partial<row>;
    }): Promise<WriteResult | WriteRowResult<row>>;
}
export {};
//# sourceMappingURL=database.d.ts.map