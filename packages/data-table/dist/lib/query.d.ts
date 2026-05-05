import type { JoinClause, JoinType, SelectColumn } from './adapter.ts';
import type { MergeColumnTypeMaps, PrimaryKeyInputForRow, QueryColumnInput, QueryColumnName, QueryColumnTypeMap, QueryColumnTypeMapFromRow, QueryColumns, QueryTableInput, RelationMapForSourceName, ReturningInput, SelectedAliasRow, WriteResult, WriteRowResult, WriteRowsResult } from './database.ts';
import type { Predicate, WhereInput } from './operators.ts';
import type { AnyRelation, AnyTable, LoadedRelationMap, OrderByClause } from './table.ts';
type QueryBindingState = 'bound' | 'unbound';
type InsertQueryOptions<row extends Record<string, unknown>> = {
    returning?: ReturningInput<row>;
    touch?: boolean;
};
type DeleteQueryOptions<row extends Record<string, unknown>> = {
    returning?: ReturningInput<row>;
};
type UpsertQueryOptions<row extends Record<string, unknown>> = {
    returning?: ReturningInput<row>;
    touch?: boolean;
    conflictTarget?: (keyof row & string)[];
    update?: Partial<row>;
};
export type QueryState = {
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
type QueryPlanMap<row extends Record<string, unknown>, primaryKey extends readonly string[]> = {
    all: {
        kind: 'all';
    };
    first: {
        kind: 'first';
    };
    find: {
        kind: 'find';
        value: PrimaryKeyInputForRow<row, primaryKey>;
    };
    count: {
        kind: 'count';
    };
    exists: {
        kind: 'exists';
    };
    insert: {
        kind: 'insert';
        values: Partial<row>;
        options?: InsertQueryOptions<row>;
    };
    insertMany: {
        kind: 'insertMany';
        values: Partial<row>[];
        options?: InsertQueryOptions<row>;
    };
    update: {
        kind: 'update';
        changes: Partial<row>;
        options?: InsertQueryOptions<row>;
    };
    delete: {
        kind: 'delete';
        options?: DeleteQueryOptions<row>;
    };
    upsert: {
        kind: 'upsert';
        values: Partial<row>;
        options?: UpsertQueryOptions<row>;
    };
};
type QueryExecutionMode = keyof QueryPlanMap<Record<string, unknown>, readonly string[]>;
type QueryPhase<binding extends QueryBindingState = QueryBindingState, mode extends QueryExecutionMode = QueryExecutionMode> = {
    binding: binding;
    mode: mode;
};
export type BoundQueryPhase<mode extends QueryExecutionMode = QueryExecutionMode> = QueryPhase<'bound', mode>;
export type UnboundQueryPhase<mode extends QueryExecutionMode = QueryExecutionMode> = QueryPhase<'unbound', mode>;
type AnyQuerySource = QueryTableInput<string, Record<string, unknown>, readonly string[]>;
type QuerySourceTableName<source extends AnyQuerySource> = source extends QueryTableInput<infer tableName, any, any> ? tableName : never;
type QuerySourceRow<source extends AnyQuerySource> = source extends QueryTableInput<any, infer row, any> ? row : never;
type QuerySourcePrimaryKey<source extends AnyQuerySource> = source extends QueryTableInput<any, any, infer primaryKey> ? primaryKey : never;
type QuerySourceColumnTypes<source extends AnyQuerySource> = QueryColumnTypeMapFromRow<QuerySourceTableName<source>, QuerySourceRow<source>>;
type QueryPlan<row extends Record<string, unknown>, primaryKey extends readonly string[], mode extends QueryExecutionMode = QueryExecutionMode> = QueryPlanMap<row, primaryKey>[mode];
type QueryResultMap<row extends Record<string, unknown>, loaded extends Record<string, unknown>> = {
    all: Array<row & loaded>;
    first: (row & loaded) | null;
    find: (row & loaded) | null;
    count: number;
    exists: boolean;
    insert: WriteResult | WriteRowResult<row>;
    insertMany: WriteResult | WriteRowsResult<row>;
    update: WriteResult | WriteRowsResult<row>;
    delete: WriteResult | WriteRowsResult<row>;
    upsert: WriteResult | WriteRowResult<row>;
};
/**
 * Convenience alias for any {@link Query} regardless of its source, columns,
 * row shape, loaded relations, or execution phase. Use this in helper APIs
 * that accept a query but don't care about the specific generic parameters.
 */
export type AnyQuery = Query<any, any, any, any, any>;
type QuerySource<input extends AnyQuery> = input extends Query<infer source, any, any, any, any> ? source : never;
type QueryColumnTypes<input extends AnyQuery> = input extends Query<any, infer columnTypes, any, any, any> ? columnTypes : never;
type QueryRow<input extends AnyQuery> = input extends Query<any, any, infer row, any, any> ? row : never;
type QueryLoaded<input extends AnyQuery> = input extends Query<any, any, any, infer loaded, any> ? loaded : never;
type QueryPhaseOf<input extends AnyQuery> = input extends Query<any, any, any, any, infer phase> ? phase : never;
type QueryBinding<input extends AnyQuery> = QueryPhaseOf<input>['binding'];
type QueryMode<input extends AnyQuery> = QueryPhaseOf<input>['mode'];
type QueryPhaseBinding<phase extends QueryPhase> = phase['binding'];
type QueryPhaseMode<phase extends QueryPhase> = phase['mode'];
type QueryAllPhase<phase extends QueryPhase> = QueryPhase<QueryPhaseBinding<phase>, 'all'>;
type QueryWith<input extends AnyQuery, phase extends QueryPhase> = Query<QuerySource<input>, QueryColumnTypes<input>, QueryRow<input>, QueryLoaded<input>, phase>;
type QueryTerminalResult<input extends AnyQuery, mode extends QueryExecutionMode, result> = QueryBinding<input> extends 'bound' ? Promise<result> : QueryWith<input, UnboundQueryPhase<mode>>;
export type QueryExecutionResult<input> = input extends AnyQuery ? QueryResultMap<QueryRow<input>, QueryLoaded<input>>[Extract<QueryMode<input>, QueryExecutionMode>] : never;
type QueryRuntime = {
    exec<input extends AnyQuery>(input: input): Promise<QueryExecutionResult<input>>;
};
type QuerySnapshot<source extends AnyQuerySource = AnyQuerySource, row extends Record<string, unknown> = Record<string, unknown>, mode extends QueryExecutionMode = QueryExecutionMode> = {
    table: source;
    state: QueryState;
    plan: QueryPlan<row, QuerySourcePrimaryKey<source>, mode>;
};
export declare const bindQueryRuntime: unique symbol;
export declare const querySnapshot: unique symbol;
declare const queryTypeBrand: unique symbol;
/**
 * Type-safe query builder for `@remix-run/data-table` sources. Construct via
 * {@link query} and chain calls (`select`, `where`, `orderBy`, etc.) to build
 * up a plan; run it by `await`-ing on a runtime-bound query, or by passing an
 * unbound one to a runtime.
 *
 * The five generic parameters track, in order: the source/table, the column
 * type map, the projected row shape, any loaded relations, and the
 * binding/execution-mode phase. Most consumers do not need to spell them out
 * — `query(table)` infers everything.
 */
export declare class Query<source extends AnyQuerySource, columnTypes extends Record<string, unknown> = QuerySourceColumnTypes<source>, row extends Record<string, unknown> = QuerySourceRow<source>, loaded extends Record<string, unknown> = {}, phase extends QueryPhase = UnboundQueryPhase<'all'>> {
    #private;
    readonly [queryTypeBrand]: {
        binding: QueryPhaseBinding<phase>;
        mode: QueryPhaseMode<phase>;
    };
    constructor(table: source);
    select<selection extends (keyof row & string)[]>(this: Query<source, columnTypes, row, loaded, QueryAllPhase<phase>>, ...columns: selection): Query<source, columnTypes, Pick<row, selection[number]>, loaded, QueryAllPhase<phase>>;
    select<selection extends Record<string, QueryColumnInput<columnTypes>>>(this: Query<source, columnTypes, row, loaded, QueryAllPhase<phase>>, selection: selection): Query<source, columnTypes, SelectedAliasRow<columnTypes, selection>, loaded, QueryAllPhase<phase>>;
    distinct(this: Query<source, columnTypes, row, loaded, QueryAllPhase<phase>>, value?: boolean): Query<source, columnTypes, row, loaded, QueryAllPhase<phase>>;
    where(this: Query<source, columnTypes, row, loaded, QueryAllPhase<phase>>, input: WhereInput<QueryColumns<columnTypes>>): Query<source, columnTypes, row, loaded, QueryAllPhase<phase>>;
    having(this: Query<source, columnTypes, row, loaded, QueryAllPhase<phase>>, input: WhereInput<QueryColumns<columnTypes>>): Query<source, columnTypes, row, loaded, QueryAllPhase<phase>>;
    join<target extends AnyTable>(this: Query<source, columnTypes, row, loaded, QueryAllPhase<phase>>, target: target, on: Predicate<QueryColumns<columnTypes> | QueryColumnName<target>>, type?: JoinType): Query<source, MergeColumnTypeMaps<columnTypes, QueryColumnTypeMap<target>>, row, loaded, QueryAllPhase<phase>>;
    leftJoin<target extends AnyTable>(this: Query<source, columnTypes, row, loaded, QueryAllPhase<phase>>, target: target, on: Predicate<QueryColumns<columnTypes> | QueryColumnName<target>>): Query<source, MergeColumnTypeMaps<columnTypes, QueryColumnTypeMap<target>>, row, loaded, QueryAllPhase<phase>>;
    rightJoin<target extends AnyTable>(this: Query<source, columnTypes, row, loaded, QueryAllPhase<phase>>, target: target, on: Predicate<QueryColumns<columnTypes> | QueryColumnName<target>>): Query<source, MergeColumnTypeMaps<columnTypes, QueryColumnTypeMap<target>>, row, loaded, QueryAllPhase<phase>>;
    orderBy(this: Query<source, columnTypes, row, loaded, QueryAllPhase<phase>>, column: QueryColumnInput<columnTypes>, direction?: 'asc' | 'desc'): Query<source, columnTypes, row, loaded, QueryAllPhase<phase>>;
    groupBy(this: Query<source, columnTypes, row, loaded, QueryAllPhase<phase>>, ...columns: QueryColumnInput<columnTypes>[]): Query<source, columnTypes, row, loaded, QueryAllPhase<phase>>;
    limit(this: Query<source, columnTypes, row, loaded, QueryAllPhase<phase>>, value: number): Query<source, columnTypes, row, loaded, QueryAllPhase<phase>>;
    offset(this: Query<source, columnTypes, row, loaded, QueryAllPhase<phase>>, value: number): Query<source, columnTypes, row, loaded, QueryAllPhase<phase>>;
    with<relations extends RelationMapForSourceName<QuerySourceTableName<source>>>(this: Query<source, columnTypes, row, loaded, QueryAllPhase<phase>>, relations: relations): Query<source, columnTypes, row, loaded & LoadedRelationMap<relations>, QueryAllPhase<phase>>;
    all(this: Query<source, columnTypes, row, loaded, BoundQueryPhase<'all'>>): Promise<Array<row & loaded>>;
    first(this: Query<source, columnTypes, row, loaded, QueryAllPhase<phase>>): QueryTerminalResult<Query<source, columnTypes, row, loaded, QueryAllPhase<phase>>, 'first', (row & loaded) | null>;
    find(this: Query<source, columnTypes, row, loaded, QueryAllPhase<phase>>, value: PrimaryKeyInputForRow<row, QuerySourcePrimaryKey<source>>): QueryTerminalResult<Query<source, columnTypes, row, loaded, QueryAllPhase<phase>>, 'find', (row & loaded) | null>;
    count(this: Query<source, columnTypes, row, loaded, QueryAllPhase<phase>>): QueryTerminalResult<Query<source, columnTypes, row, loaded, QueryAllPhase<phase>>, 'count', number>;
    exists(this: Query<source, columnTypes, row, loaded, QueryAllPhase<phase>>): QueryTerminalResult<Query<source, columnTypes, row, loaded, QueryAllPhase<phase>>, 'exists', boolean>;
    insert(this: Query<source, columnTypes, row, loaded, QueryAllPhase<phase>>, values: Partial<row>, options?: InsertQueryOptions<row>): QueryTerminalResult<Query<source, columnTypes, row, loaded, QueryAllPhase<phase>>, 'insert', WriteResult | WriteRowResult<row>>;
    insertMany(this: Query<source, columnTypes, row, loaded, QueryAllPhase<phase>>, values: Partial<row>[], options?: InsertQueryOptions<row>): QueryTerminalResult<Query<source, columnTypes, row, loaded, QueryAllPhase<phase>>, 'insertMany', WriteResult | WriteRowsResult<row>>;
    update(this: Query<source, columnTypes, row, loaded, QueryAllPhase<phase>>, changes: Partial<row>, options?: InsertQueryOptions<row>): QueryTerminalResult<Query<source, columnTypes, row, loaded, QueryAllPhase<phase>>, 'update', WriteResult | WriteRowsResult<row>>;
    delete(this: Query<source, columnTypes, row, loaded, QueryAllPhase<phase>>, options?: DeleteQueryOptions<row>): QueryTerminalResult<Query<source, columnTypes, row, loaded, QueryAllPhase<phase>>, 'delete', WriteResult | WriteRowsResult<row>>;
    upsert(this: Query<source, columnTypes, row, loaded, QueryAllPhase<phase>>, values: Partial<row>, options?: UpsertQueryOptions<row>): QueryTerminalResult<Query<source, columnTypes, row, loaded, QueryAllPhase<phase>>, 'upsert', WriteResult | WriteRowResult<row>>;
    [querySnapshot](): QuerySnapshot<source, row, QueryPhaseMode<phase>>;
    [bindQueryRuntime](runtime: QueryRuntime): Query<source, columnTypes, row, loaded, BoundQueryPhase<QueryPhaseMode<phase>>>;
}
/**
 * Begin a {@link Query} against a `@remix-run/data-table` source. The returned
 * builder is in `'all'` execution mode and unbound; chain `select`, `where`,
 * `orderBy`, etc. to refine the plan, and `await` it after binding it to a
 * runtime to materialize results.
 *
 * @param table The table or source to query.
 * @returns An unbound {@link Query} builder rooted at `table`.
 *
 * @example
 * ```ts
 * let activeUsers = await query(users)
 *   .where({ status: 'active' })
 *   .orderBy('createdAt', 'desc')
 *   .select(['id', 'email'])
 * ```
 */
export declare function query<tableName extends string, row extends Record<string, unknown>, primaryKey extends readonly (keyof row & string)[]>(table: QueryTableInput<tableName, row, primaryKey>): Query<QueryTableInput<tableName, row, primaryKey>, QueryColumnTypeMapFromRow<tableName, row>, row, {}, UnboundQueryPhase<'all'>>;
export declare function cloneQueryState(state: QueryState): QueryState;
export {};
//# sourceMappingURL=query.d.ts.map