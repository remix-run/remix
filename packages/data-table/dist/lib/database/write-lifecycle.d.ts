import type { DatabaseAdapter, ReturningSelection } from '../adapter.ts';
import type { ReturningInput } from '../database.ts';
import type { AnyRelation, AnyTable, TableAfterDeleteContext, TableAfterWriteContext, TableBeforeDeleteContext, TableRow, TableWriteOperation } from '../table.ts';
export declare function prepareInsertValues<table extends AnyTable>(table: table, values: Partial<TableRow<table>>, now: unknown, touch: boolean): Record<string, unknown>;
export declare function prepareUpdateValues<table extends AnyTable>(table: table, values: Partial<TableRow<table>>, now: unknown, touch: boolean, operation?: TableWriteOperation): Record<string, unknown>;
export declare function applyAfterReadHooksToRows<table extends AnyTable>(table: table, rows: Record<string, unknown>[]): Record<string, unknown>[];
export declare function applyAfterReadHooksToLoadedRows(table: AnyTable, rows: Record<string, unknown>[], relationMap: Record<string, AnyRelation>): Record<string, unknown>[];
export declare function runBeforeDeleteHook<table extends AnyTable>(table: table, context: TableBeforeDeleteContext): void;
export declare function runAfterWriteHook<table extends AnyTable>(table: table, context: TableAfterWriteContext<TableRow<table>>): void;
export declare function runAfterDeleteHook<table extends AnyTable>(table: table, context: TableAfterDeleteContext): void;
export declare function assertReturningCapability<row extends Record<string, unknown>>(adapter: DatabaseAdapter, operation: 'insert' | 'insertMany' | 'update' | 'delete' | 'upsert', returning: ReturningInput<row> | undefined): void;
export declare function normalizeReturningSelection<row extends Record<string, unknown>>(returning: ReturningInput<row>): ReturningSelection;
//# sourceMappingURL=write-lifecycle.d.ts.map