import type { AdapterResult, DatabaseAdapter, JoinClause, JoinType, SelectColumn, TransactionOptions, TransactionToken } from './adapter.ts';
import type { AnyTable, LoadedRelationMap, OrderByClause, OrderDirection, PrimaryKeyInput, RelationMapForTable, TableRow } from './model.ts';
import type { Predicate, WhereInput } from './operators.ts';
import type { SqlStatement } from './sql.ts';
import type { AdapterStatement } from './adapter.ts';
type QueryState<table extends AnyTable> = {
    select: '*' | SelectColumn[];
    distinct: boolean;
    joins: JoinClause[];
    where: Predicate<string>[];
    groupBy: string[];
    having: Predicate<string>[];
    orderBy: OrderByClause[];
    limit?: number;
    offset?: number;
    with: RelationMapForTable<table>;
};
type TableColumnName<table extends AnyTable> = keyof TableRow<table> & string;
type QualifiedTableColumnName<table extends AnyTable> = `${table['name']}.${TableColumnName<table>}`;
type QueryColumnName<table extends AnyTable> = TableColumnName<table> | QualifiedTableColumnName<table>;
type QueryColumnTypeMap<table extends AnyTable> = {
    [column in QueryColumnName<table>]: column extends TableColumnName<table> ? TableRow<table>[column] : column extends `${table['name']}.${infer name extends TableColumnName<table>}` ? TableRow<table>[name] : never;
};
type MergeColumnTypeMaps<left extends Record<string, unknown>, right extends Record<string, unknown>> = {
    [column in Extract<keyof left | keyof right, string>]: column extends keyof right ? column extends keyof left ? left[column] | right[column] : right[column] : column extends keyof left ? left[column] : never;
};
type QueryColumns<columnTypes extends Record<string, unknown>> = Extract<keyof columnTypes, string>;
type SelectedAliasRow<columnTypes extends Record<string, unknown>, selection extends Record<string, QueryColumns<columnTypes>>> = {
    [alias in keyof selection]: selection[alias] extends keyof columnTypes ? columnTypes[selection[alias]] : never;
};
type SavepointCounter = {
    value: number;
};
type ReturningInput<table extends AnyTable> = '*' | (keyof TableRow<table> & string)[];
export type WriteResult = {
    affectedRows: number;
    insertId?: unknown;
};
export type WriteRowsResult<row> = WriteResult & {
    rows: row[];
};
export type WriteRowResult<row> = WriteResult & {
    row: row | null;
};
export type Database = {
    adapter: DatabaseAdapter;
    now(): unknown;
    query<table extends AnyTable>(table: table): QueryBuilder<table, {}, QueryColumnTypeMap<table>, TableRow<table>>;
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
    query<table extends AnyTable>(table: table): QueryBuilder<table, {}, QueryColumnTypeMap<table>, TableRow<table>>;
    exec(statement: string | SqlStatement, values?: unknown[]): Promise<AdapterResult>;
    transaction<result>(callback: (database: Database) => Promise<result>, options?: TransactionOptions): Promise<result>;
    execute(statement: AdapterStatement): Promise<AdapterResult>;
}
export declare function createDatabase(adapter: DatabaseAdapter, options?: {
    now?: () => unknown;
}): Database;
export declare class QueryBuilder<table extends AnyTable, loaded extends Record<string, unknown> = {}, columnTypes extends Record<string, unknown> = QueryColumnTypeMap<table>, row extends Record<string, unknown> = TableRow<table>> {
    #private;
    constructor(database: DatabaseRuntime, table: table, state: QueryState<table>);
    select<selection extends (keyof TableRow<table> & string)[]>(...columns: selection): QueryBuilder<table, loaded, columnTypes, Pick<TableRow<table>, selection[number]>>;
    select<selection extends Record<string, QueryColumns<columnTypes>>>(selection: selection): QueryBuilder<table, loaded, columnTypes, SelectedAliasRow<columnTypes, selection>>;
    distinct(value?: boolean): QueryBuilder<table, loaded, columnTypes, row>;
    where(input: WhereInput<QueryColumns<columnTypes>>): QueryBuilder<table, loaded, columnTypes, row>;
    having(input: WhereInput<QueryColumns<columnTypes>>): QueryBuilder<table, loaded, columnTypes, row>;
    join<target extends AnyTable>(target: target, on: Predicate<QueryColumns<columnTypes> | QueryColumnName<target>>, type?: JoinType): QueryBuilder<table, loaded, MergeColumnTypeMaps<columnTypes, QueryColumnTypeMap<target>>, row>;
    leftJoin<target extends AnyTable>(target: target, on: Predicate<QueryColumns<columnTypes> | QueryColumnName<target>>): QueryBuilder<table, loaded, MergeColumnTypeMaps<columnTypes, QueryColumnTypeMap<target>>, row>;
    rightJoin<target extends AnyTable>(target: target, on: Predicate<QueryColumns<columnTypes> | QueryColumnName<target>>): QueryBuilder<table, loaded, MergeColumnTypeMaps<columnTypes, QueryColumnTypeMap<target>>, row>;
    fullJoin<target extends AnyTable>(target: target, on: Predicate<QueryColumns<columnTypes> | QueryColumnName<target>>): QueryBuilder<table, loaded, MergeColumnTypeMaps<columnTypes, QueryColumnTypeMap<target>>, row>;
    orderBy(column: QueryColumns<columnTypes>, direction?: OrderDirection): QueryBuilder<table, loaded, columnTypes, row>;
    groupBy(...columns: QueryColumns<columnTypes>[]): QueryBuilder<table, loaded, columnTypes, row>;
    limit(value: number): QueryBuilder<table, loaded, columnTypes, row>;
    offset(value: number): QueryBuilder<table, loaded, columnTypes, row>;
    with<relations extends RelationMapForTable<table>>(relations: relations): QueryBuilder<table, loaded & LoadedRelationMap<relations>, columnTypes, row>;
    all(): Promise<Array<row & loaded>>;
    first(): Promise<(row & loaded) | null>;
    find(value: PrimaryKeyInput<table>): Promise<(row & loaded) | null>;
    count(): Promise<number>;
    exists(): Promise<boolean>;
    insert(values: Partial<TableRow<table>>, options?: {
        returning?: ReturningInput<table>;
        touch?: boolean;
    }): Promise<WriteResult | WriteRowResult<TableRow<table>>>;
    insertMany(values: Partial<TableRow<table>>[], options?: {
        returning?: ReturningInput<table>;
        touch?: boolean;
    }): Promise<WriteResult | WriteRowsResult<TableRow<table>>>;
    update(changes: Partial<TableRow<table>>, options?: {
        returning?: ReturningInput<table>;
        touch?: boolean;
    }): Promise<WriteResult | WriteRowsResult<TableRow<table>>>;
    delete(options?: {
        returning?: ReturningInput<table>;
    }): Promise<WriteResult | WriteRowsResult<TableRow<table>>>;
    upsert(values: Partial<TableRow<table>>, options?: {
        returning?: ReturningInput<table>;
        touch?: boolean;
        conflictTarget?: (keyof TableRow<table> & string)[];
        update?: Partial<TableRow<table>>;
    }): Promise<WriteResult | WriteRowResult<TableRow<table>>>;
}
export {};
//# sourceMappingURL=database.d.ts.map