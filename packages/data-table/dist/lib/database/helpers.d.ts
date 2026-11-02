import type { OrderByInput, OrderByTuple, QueryTableInput, SingleTableWhere, TableColumnName, WriteResult, WriteRowsResult } from '../database.ts';
import type { Predicate } from '../operators.ts';
import type { AnyTable, PrimaryKeyInput, TableName, TablePrimaryKey, TableRow } from '../table.ts';
import type { QueryExecutionContext } from './execution-context.ts';
export declare function asQueryTableInput<table extends AnyTable>(table: table): QueryTableInput<TableName<table>, TableRow<table>, TablePrimaryKey<table>>;
export declare function getPrimaryKeyWhere<table extends AnyTable>(table: table, value: PrimaryKeyInput<table>): SingleTableWhere<table>;
export declare function getPrimaryKeyWhereFromRow<table extends AnyTable>(table: table, row: Record<string, unknown>): SingleTableWhere<table>;
export declare function resolveCreateRowWhere<table extends AnyTable>(table: table, values: Partial<TableRow<table>>, insertId: unknown): SingleTableWhere<table>;
export declare function normalizeOrderByInput<table extends AnyTable>(input: OrderByInput<table> | undefined): OrderByTuple<table>[];
export declare function toWriteResult(result: WriteResult | WriteRowsResult<unknown>): WriteResult;
export declare function hasScopedWriteModifiers(state: {
    orderBy: unknown[];
    limit?: number;
    offset?: number;
}): boolean;
export declare function loadPrimaryKeyRowsForScope<table extends AnyTable>(database: QueryExecutionContext, table: table, state: {
    where: Predicate<string>[];
    orderBy: Array<{
        column: string;
        direction: 'asc' | 'desc';
    }>;
    limit?: number;
    offset?: number;
}): Promise<Record<string, unknown>[]>;
export declare function buildPrimaryKeyPredicate<table extends AnyTable>(table: table, keyObjects: Record<string, unknown>[]): Predicate<TableColumnName<table>> | undefined;
//# sourceMappingURL=helpers.d.ts.map