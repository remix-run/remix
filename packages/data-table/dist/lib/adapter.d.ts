import type { AnyTable, OrderByClause } from './table.ts';
import type { Predicate } from './operators.ts';
import type { SqlStatement } from './sql.ts';
import type { Pretty } from './types.ts';
/**
 * Supported SQL join kinds.
 */
export type JoinType = 'inner' | 'left' | 'right';
/**
 * Join configuration used in compiled select statements.
 */
export type JoinClause = {
    type: JoinType;
    table: AnyTable;
    on: Predicate;
};
/**
 * Selected output column with optional alias.
 */
export type SelectColumn = {
    column: string;
    alias: string;
};
/**
 * Returning selection for write statements.
 */
export type ReturningSelection = '*' | string[];
/**
 * Canonical select statement shape consumed by adapters.
 */
export type SelectStatement<table extends AnyTable = AnyTable> = {
    kind: 'select';
    table: table;
    select: '*' | SelectColumn[];
    distinct: boolean;
    joins: JoinClause[];
    where: Predicate[];
    groupBy: string[];
    having: Predicate[];
    orderBy: OrderByClause[];
    limit?: number;
    offset?: number;
};
/**
 * Canonical count statement shape consumed by adapters.
 */
export type CountStatement<table extends AnyTable = AnyTable> = {
    kind: 'count';
    table: table;
    joins: JoinClause[];
    where: Predicate[];
    groupBy: string[];
    having: Predicate[];
};
/**
 * Canonical exists statement shape consumed by adapters.
 */
export type ExistsStatement<table extends AnyTable = AnyTable> = {
    kind: 'exists';
    table: table;
    joins: JoinClause[];
    where: Predicate[];
    groupBy: string[];
    having: Predicate[];
};
/**
 * Canonical insert statement shape consumed by adapters.
 */
export type InsertStatement<table extends AnyTable = AnyTable> = {
    kind: 'insert';
    table: table;
    values: Record<string, unknown>;
    returning?: ReturningSelection;
};
/**
 * Canonical bulk-insert statement shape consumed by adapters.
 */
export type InsertManyStatement<table extends AnyTable = AnyTable> = {
    kind: 'insertMany';
    table: table;
    values: Record<string, unknown>[];
    returning?: ReturningSelection;
};
/**
 * Canonical update statement shape consumed by adapters.
 */
export type UpdateStatement<table extends AnyTable = AnyTable> = {
    kind: 'update';
    table: table;
    changes: Record<string, unknown>;
    where: Predicate[];
    returning?: ReturningSelection;
};
/**
 * Canonical delete statement shape consumed by adapters.
 */
export type DeleteStatement<table extends AnyTable = AnyTable> = {
    kind: 'delete';
    table: table;
    where: Predicate[];
    returning?: ReturningSelection;
};
/**
 * Canonical upsert statement shape consumed by adapters.
 */
export type UpsertStatement<table extends AnyTable = AnyTable> = {
    kind: 'upsert';
    table: table;
    values: Record<string, unknown>;
    conflictTarget?: string[];
    update?: Record<string, unknown>;
    returning?: ReturningSelection;
};
/**
 * Raw SQL statement execution descriptor.
 */
export type RawStatement = {
    kind: 'raw';
    sql: SqlStatement;
};
/**
 * Union of all canonical statement shapes.
 */
export type AdapterStatement = SelectStatement | CountStatement | ExistsStatement | InsertStatement | InsertManyStatement | UpdateStatement | DeleteStatement | UpsertStatement | RawStatement;
/**
 * Opaque transaction handle supplied by adapters.
 */
export type TransactionToken = {
    id: string;
    metadata?: Record<string, unknown>;
};
/**
 * Transaction hints that adapters may apply when supported by the dialect.
 */
export type TransactionOptions = {
    isolationLevel?: 'read uncommitted' | 'read committed' | 'repeatable read' | 'serializable';
    readOnly?: boolean;
};
/**
 * Adapter execution request payload.
 */
export type AdapterExecuteRequest = {
    statement: AdapterStatement;
    transaction?: TransactionToken;
};
/**
 * Adapter execution result payload.
 */
export type AdapterResult = {
    rows?: Record<string, unknown>[];
    affectedRows?: number;
    insertId?: unknown;
};
/**
 * Declares adapter feature support.
 */
export type AdapterCapabilities = {
    returning: boolean;
    savepoints: boolean;
    upsert: boolean;
};
/**
 * Partial capabilities used to override adapter defaults.
 */
export type AdapterCapabilityOverrides = Pretty<Partial<AdapterCapabilities>>;
/**
 * Runtime contract implemented by concrete database adapters.
 */
export interface DatabaseAdapter {
    dialect: string;
    capabilities: AdapterCapabilities;
    execute(request: AdapterExecuteRequest): Promise<AdapterResult>;
    beginTransaction(options?: TransactionOptions): Promise<TransactionToken>;
    commitTransaction(token: TransactionToken): Promise<void>;
    rollbackTransaction(token: TransactionToken): Promise<void>;
    createSavepoint(token: TransactionToken, name: string): Promise<void>;
    rollbackToSavepoint(token: TransactionToken, name: string): Promise<void>;
    releaseSavepoint(token: TransactionToken, name: string): Promise<void>;
}
//# sourceMappingURL=adapter.d.ts.map