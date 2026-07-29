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
export type SelectOperation<table extends AnyTable = AnyTable> = {
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
export type CountOperation<table extends AnyTable = AnyTable> = {
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
export type ExistsOperation<table extends AnyTable = AnyTable> = {
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
export type InsertOperation<table extends AnyTable = AnyTable> = {
    kind: 'insert';
    table: table;
    values: Record<string, unknown>;
    returning?: ReturningSelection;
};
/**
 * Canonical bulk-insert statement shape consumed by adapters.
 */
export type InsertManyOperation<table extends AnyTable = AnyTable> = {
    kind: 'insertMany';
    table: table;
    values: Record<string, unknown>[];
    returning?: ReturningSelection;
};
/**
 * Canonical update statement shape consumed by adapters.
 */
export type UpdateOperation<table extends AnyTable = AnyTable> = {
    kind: 'update';
    table: table;
    changes: Record<string, unknown>;
    where: Predicate[];
    returning?: ReturningSelection;
};
/**
 * Canonical delete statement shape consumed by adapters.
 */
export type DeleteOperation<table extends AnyTable = AnyTable> = {
    kind: 'delete';
    table: table;
    where: Predicate[];
    returning?: ReturningSelection;
};
/**
 * Canonical upsert statement shape consumed by adapters.
 */
export type UpsertOperation<table extends AnyTable = AnyTable> = {
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
export type RawOperation = {
    kind: 'raw';
    sql: SqlStatement;
};
/**
 * Union of all data-manipulation statement shapes.
 */
export type DataManipulationOperation = SelectOperation | CountOperation | ExistsOperation | InsertOperation | InsertManyOperation | UpdateOperation | DeleteOperation | UpsertOperation | RawOperation;
/**
 * Qualified table reference.
 */
export type TableRef = {
    name: string;
    schema?: string;
};
/**
 * Referential actions supported by foreign key constraints.
 */
export type ForeignKeyAction = 'cascade' | 'restrict' | 'set null' | 'set default' | 'no action';
/**
 * Logical column type names used by schema definitions.
 */
export type ColumnTypeName = 'varchar' | 'text' | 'integer' | 'bigint' | 'decimal' | 'boolean' | 'uuid' | 'date' | 'time' | 'timestamp' | 'json' | 'binary' | 'enum';
/**
 * Default value definition for a column.
 */
export type ColumnDefault = {
    kind: 'literal';
    value: unknown;
} | {
    kind: 'now';
} | {
    kind: 'sql';
    expression: string;
};
/**
 * Definition for a computed or generated column.
 */
export type ColumnComputed = {
    expression: string;
    stored: boolean;
};
/** Options for configuring identity column generation. */
export type IdentityOptions = {
    always?: boolean;
    start?: number;
    increment?: number;
};
/** Foreign-key reference metadata declared on a column. */
export type ColumnReference = {
    table: TableRef;
    columns: string[];
    name: string;
    onDelete?: ForeignKeyAction;
    onUpdate?: ForeignKeyAction;
};
/**
 * Check constraint declared on a column definition.
 */
export type ColumnCheck = {
    expression: string;
    name: string;
};
/**
 * Normalized column definition used in schema operations.
 */
export type ColumnDefinition = {
    type: ColumnTypeName;
    nullable?: boolean;
    primaryKey?: boolean;
    unique?: boolean | {
        name?: string;
    };
    default?: ColumnDefault;
    computed?: ColumnComputed;
    references?: ColumnReference;
    checks?: ColumnCheck[];
    comment?: string;
    length?: number;
    precision?: number;
    scale?: number;
    unsigned?: boolean;
    withTimezone?: boolean;
    enumValues?: string[];
    autoIncrement?: boolean;
    identity?: IdentityOptions;
    collate?: string;
    charset?: string;
};
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
export type DataManipulationRequest = {
    operation: DataManipulationOperation;
    transaction?: TransactionToken;
};
/**
 * Adapter data-manipulation result payload.
 */
export type DataManipulationResult = {
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
    transactionalDdl: boolean;
    migrationLock: boolean;
};
/**
 * Partial capabilities used to override adapter defaults.
 */
export type AdapterCapabilityOverrides = Pretty<Partial<AdapterCapabilities>>;
/**
 * Runtime contract implemented by concrete database adapters.
 */
export interface DatabaseAdapter {
    /** Database dialect name exposed by the adapter. */
    dialect: string;
    /** Feature flags describing the adapter's supported behaviors. */
    capabilities: AdapterCapabilities;
    /** Compiles a data-manipulation operation into executable SQL statements. */
    compileSql(operation: DataManipulationOperation): SqlStatement[];
    /** Executes a data-manipulation request. */
    execute(request: DataManipulationRequest): Promise<DataManipulationResult>;
    /**
     * Executes a raw SQL script that may contain multiple statements.
     *
     * Drivers must be configured to accept multi-statement scripts where required
     * (for example, mysql2 needs `multipleStatements: true`).
     */
    executeScript(sql: string, transaction?: TransactionToken): Promise<void>;
    /** Checks whether a table exists. */
    hasTable(table: TableRef, transaction?: TransactionToken): Promise<boolean>;
    /** Checks whether a column exists on a table. */
    hasColumn(table: TableRef, column: string, transaction?: TransactionToken): Promise<boolean>;
    /** Starts a new database transaction. */
    beginTransaction(options?: TransactionOptions): Promise<TransactionToken>;
    /** Commits an open transaction. */
    commitTransaction(token: TransactionToken): Promise<void>;
    /** Rolls back an open transaction. */
    rollbackTransaction(token: TransactionToken): Promise<void>;
    /** Creates a savepoint inside an open transaction. */
    createSavepoint(token: TransactionToken, name: string): Promise<void>;
    /** Rolls back to a previously created savepoint. */
    rollbackToSavepoint(token: TransactionToken, name: string): Promise<void>;
    /** Releases a previously created savepoint. */
    releaseSavepoint(token: TransactionToken, name: string): Promise<void>;
    /** Acquires the adapter's migration lock when supported. */
    acquireMigrationLock?(): Promise<void>;
    /** Releases the adapter's migration lock when supported. */
    releaseMigrationLock?(): Promise<void>;
}
//# sourceMappingURL=adapter.d.ts.map