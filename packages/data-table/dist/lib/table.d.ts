import type { ColumnDefinition } from './adapter.ts';
import { ColumnBuilder } from './column.ts';
import type { ColumnInput as ColumnBuilderInput, ColumnOutput } from './column.ts';
import type { Predicate, WhereInput } from './operators.ts';
import { columnMetadataKey, tableMetadataKey } from './references.ts';
import type { ColumnInput, ColumnReferenceLike, TableMetadataLike } from './references.ts';
import type { Pretty } from './types.ts';
/**
 * Symbol key used to store non-enumerable table metadata.
 */
export { columnMetadataKey, tableMetadataKey } from './references.ts';
export type TableColumnsDefinition = Record<string, ColumnBuilder<any>>;
export type TableValidationOperation = 'create' | 'update';
export type TableWriteOperation = TableValidationOperation;
export type TableLifecycleOperation = TableWriteOperation | 'delete' | 'read';
export type ValidationIssue = {
    message: string;
    path?: Array<string | number>;
};
export type ValidationFailure = {
    issues: ReadonlyArray<ValidationIssue>;
};
export type TableValidationContext<row extends Record<string, unknown>> = {
    operation: TableValidationOperation;
    tableName: string;
    value: Partial<row>;
};
export type TableValidationResult<row extends Record<string, unknown>> = {
    value: Partial<row>;
} | ValidationFailure;
export type TableValidate<row extends Record<string, unknown>> = (context: TableValidationContext<row>) => TableValidationResult<row>;
export type TableBeforeWriteContext<row extends Record<string, unknown>> = {
    operation: TableWriteOperation;
    tableName: string;
    value: Partial<row>;
};
export type TableBeforeWriteResult<row extends Record<string, unknown>> = {
    value: Partial<row>;
} | ValidationFailure;
export type TableBeforeWrite<row extends Record<string, unknown>> = (context: TableBeforeWriteContext<row>) => TableBeforeWriteResult<row>;
export type TableAfterWriteContext<row extends Record<string, unknown>> = {
    operation: TableWriteOperation;
    tableName: string;
    values: ReadonlyArray<Partial<row>>;
    affectedRows: number;
    insertId?: unknown;
};
export type TableAfterWrite<row extends Record<string, unknown>> = (context: TableAfterWriteContext<row>) => void;
export type TableBeforeDeleteContext = {
    tableName: string;
    where: ReadonlyArray<Predicate<string>>;
    orderBy: ReadonlyArray<OrderByClause>;
    limit?: number;
    offset?: number;
};
export type TableBeforeDeleteResult = void | ValidationFailure;
export type TableBeforeDelete = (context: TableBeforeDeleteContext) => TableBeforeDeleteResult;
export type TableAfterDeleteContext = {
    tableName: string;
    where: ReadonlyArray<Predicate<string>>;
    orderBy: ReadonlyArray<OrderByClause>;
    limit?: number;
    offset?: number;
    affectedRows: number;
};
export type TableAfterDelete = (context: TableAfterDeleteContext) => void;
export type TableAfterReadContext<row extends Record<string, unknown>> = {
    tableName: string;
    /**
     * The current row shape being returned. This may be a projection/partial row.
     */
    value: Partial<row>;
};
export type TableAfterReadResult<row extends Record<string, unknown>> = {
    value: Partial<row>;
} | ValidationFailure;
export type TableAfterRead<row extends Record<string, unknown>> = (context: TableAfterReadContext<row>) => TableAfterReadResult<row>;
type ColumnNameFromColumns<columns extends TableColumnsDefinition> = keyof columns & string;
type DefaultPrimaryKey<columns extends TableColumnsDefinition> = 'id' extends ColumnNameFromColumns<columns> ? readonly ['id'] : readonly ColumnNameFromColumns<columns>[];
type NormalizePrimaryKey<columns extends TableColumnsDefinition, primaryKey extends ColumnNameFromColumns<columns> | readonly ColumnNameFromColumns<columns>[] | undefined> = primaryKey extends readonly (infer column extends ColumnNameFromColumns<columns>)[] ? readonly [...column[]] : primaryKey extends ColumnNameFromColumns<columns> ? readonly [primaryKey] : DefaultPrimaryKey<columns>;
export type TimestampOptions = boolean | {
    createdAt?: string;
    updatedAt?: string;
};
export type TimestampConfig = {
    createdAt: string;
    updatedAt: string;
};
type TableMetadata<name extends string, columns extends TableColumnsDefinition, primaryKey extends readonly ColumnNameFromColumns<columns>[]> = {
    name: name;
    columns: columns;
    primaryKey: primaryKey;
    timestamps: TimestampConfig | null;
    columnDefinitions: {
        [column in keyof columns & string]: ColumnDefinition;
    };
    beforeWrite?: TableBeforeWrite<TableRowFromColumns<columns>>;
    afterWrite?: TableAfterWrite<TableRowFromColumns<columns>>;
    beforeDelete?: TableBeforeDelete;
    afterDelete?: TableAfterDelete;
    afterRead?: TableAfterRead<TableRowFromColumns<columns>>;
    validate?: TableValidate<TableRowFromColumns<columns>>;
};
export type ColumnReference<tableName extends string, columnName extends string> = ColumnReferenceLike<`${tableName}.${columnName}`> & {
    [columnMetadataKey]: {
        tableName: tableName;
        columnName: columnName;
        qualifiedName: `${tableName}.${columnName}`;
    };
};
export type AnyColumn = ColumnReference<string, string>;
export type ColumnReferenceForQualifiedName<qualifiedName extends string> = AnyColumn & {
    [columnMetadataKey]: {
        qualifiedName: qualifiedName;
    };
};
type TableColumnReferences<name extends string, columns extends TableColumnsDefinition> = {
    [column in keyof columns & string]: ColumnReference<name, column>;
};
type TableRowFromColumns<columns extends TableColumnsDefinition> = Pretty<{
    [column in keyof columns & string]: ColumnOutput<columns[column]>;
}>;
export type Table<name extends string, columns extends TableColumnsDefinition, primaryKey extends readonly ColumnNameFromColumns<columns>[]> = TableMetadataLike<name, columns, primaryKey, TimestampConfig | null> & {
    [tableMetadataKey]: TableMetadata<name, columns, primaryKey>;
} & TableColumnReferences<name, columns>;
export type AnyTable = TableMetadataLike<string, TableColumnsDefinition, readonly string[], TimestampConfig | null> & {
    [tableMetadataKey]: {
        name: string;
        columns: TableColumnsDefinition;
        primaryKey: readonly string[];
        timestamps: TimestampConfig | null;
        columnDefinitions: Record<string, ColumnDefinition>;
        beforeWrite?: unknown;
        afterWrite?: unknown;
        beforeDelete?: unknown;
        afterDelete?: unknown;
        afterRead?: unknown;
        validate?: TableValidate<Record<string, unknown>>;
    };
} & Record<string, unknown>;
export type TableName<table extends AnyTable> = table[typeof tableMetadataKey]['name'];
export type TableColumns<table extends AnyTable> = table[typeof tableMetadataKey]['columns'];
export type TablePrimaryKey<table extends AnyTable> = table[typeof tableMetadataKey]['primaryKey'];
export type TableTimestamps<table extends AnyTable> = table[typeof tableMetadataKey]['timestamps'];
export type TableRow<table extends AnyTable> = TableRowFromColumns<TableColumns<table>>;
export type TableRowWith<table extends AnyTable, loaded extends Record<string, unknown> = {}> = Pretty<TableRow<table> & loaded>;
export type TableColumnName<table extends AnyTable> = keyof TableColumns<table> & string;
export type QualifiedTableColumnName<table extends AnyTable> = `${TableName<table>}.${TableColumnName<table>}`;
export type TableColumnInput<table extends AnyTable> = ColumnInput<TableColumnName<table> | QualifiedTableColumnName<table>>;
export type TableReference<table extends AnyTable = AnyTable> = {
    kind: 'table';
    name: TableName<table>;
    columns: TableColumns<table>;
    primaryKey: TablePrimaryKey<table>;
    timestamps: TableTimestamps<table>;
};
/**
 * Creates a plain table reference snapshot from a table instance.
 * @param table Source table instance.
 * @returns Table metadata snapshot.
 */
export declare function getTableReference<table extends AnyTable>(table: table): TableReference<table>;
/**
 * Returns a table's SQL name.
 * @param table Source table instance.
 * @returns Table SQL name.
 */
export declare function getTableName<table extends AnyTable>(table: table): TableName<table>;
/**
 * Returns a table's column builder map.
 * @param table Source table instance.
 * @returns Table column builder map.
 */
export declare function getTableColumns<table extends AnyTable>(table: table): TableColumns<table>;
/**
 * Returns a table's resolved physical column definitions.
 * @param table Source table instance.
 * @returns Column definition map.
 */
export declare function getTableColumnDefinitions<table extends AnyTable>(table: table): {
    [column in keyof TableColumns<table> & string]: ColumnDefinition;
};
/**
 * Returns a table's optional write validator.
 * @param table Source table instance.
 * @returns Validation function or `undefined`.
 */
export declare function getTableValidator<table extends AnyTable>(table: table): TableValidate<TableRow<table>> | undefined;
/**
 * Returns a table's optional before-write lifecycle callback.
 * @param table Source table instance.
 * @returns Before-write callback or `undefined`.
 */
export declare function getTableBeforeWrite<table extends AnyTable>(table: table): TableBeforeWrite<TableRow<table>> | undefined;
/**
 * Returns a table's optional after-write lifecycle callback.
 * @param table Source table instance.
 * @returns After-write callback or `undefined`.
 */
export declare function getTableAfterWrite<table extends AnyTable>(table: table): TableAfterWrite<TableRow<table>> | undefined;
/**
 * Returns a table's optional before-delete lifecycle callback.
 * @param table Source table instance.
 * @returns Before-delete callback or `undefined`.
 */
export declare function getTableBeforeDelete<table extends AnyTable>(table: table): TableBeforeDelete | undefined;
/**
 * Returns a table's optional after-delete lifecycle callback.
 * @param table Source table instance.
 * @returns After-delete callback or `undefined`.
 */
export declare function getTableAfterDelete<table extends AnyTable>(table: table): TableAfterDelete | undefined;
/**
 * Returns a table's optional after-read lifecycle callback.
 * The callback receives the current read shape, which may be a projected partial row.
 * @param table Source table instance.
 * @returns After-read callback or `undefined`.
 */
export declare function getTableAfterRead<table extends AnyTable>(table: table): TableAfterRead<TableRow<table>> | undefined;
/**
 * Returns a table's primary key columns.
 * @param table Source table instance.
 * @returns Primary key columns.
 */
export declare function getTablePrimaryKey<table extends AnyTable>(table: table): TablePrimaryKey<table>;
/**
 * Returns a table's resolved timestamp configuration.
 * @param table Source table instance.
 * @returns Timestamp configuration or `null`.
 */
export declare function getTableTimestamps<table extends AnyTable>(table: table): TableTimestamps<table>;
export type OrderDirection = 'asc' | 'desc';
export type OrderByClause = {
    column: string;
    direction: OrderDirection;
};
export type RelationCardinality = 'one' | 'many';
export type RelationKind = 'hasMany' | 'hasOne' | 'belongsTo' | 'hasManyThrough';
export type RelationResult<relation extends AnyRelation> = relation extends Relation<any, infer target, infer cardinality, infer loaded> ? cardinality extends 'many' ? Array<TableRowWith<target, loaded>> : TableRowWith<target, loaded> | null : never;
export type RelationMapForTable<table extends AnyTable> = Record<string, Relation<table, AnyTable, RelationCardinality, any>>;
export type LoadedRelationMap<relations extends RelationMapForTable<any>> = Pretty<{
    [name in keyof relations]: RelationResult<relations[name]>;
}>;
export type KeySelector<table extends AnyTable> = (keyof TableRow<table> & string) | readonly (keyof TableRow<table> & string)[];
export type HasManyOptions<source extends AnyTable, target extends AnyTable> = {
    foreignKey?: KeySelector<target>;
    targetKey?: KeySelector<source>;
};
export type HasOneOptions<source extends AnyTable, target extends AnyTable> = {
    foreignKey?: KeySelector<target>;
    targetKey?: KeySelector<source>;
};
export type BelongsToOptions<source extends AnyTable, target extends AnyTable> = {
    foreignKey?: KeySelector<source>;
    targetKey?: KeySelector<target>;
};
export type HasManyThroughOptions<source extends AnyTable, target extends AnyTable> = {
    through: Relation<source, AnyTable, RelationCardinality, any>;
    throughForeignKey?: KeySelector<target>;
    throughTargetKey?: string | string[];
};
export type RelationModifiers<target extends AnyTable> = {
    where: Predicate[];
    orderBy: OrderByClause[];
    limit?: number;
    offset?: number;
    with: RelationMapForTable<target>;
};
export type ThroughRelationMetadata = {
    relation: AnyRelation;
    throughSourceKey: string[];
    throughTargetKey: string[];
};
export type Relation<source extends AnyTable, target extends AnyTable, cardinality extends RelationCardinality, loaded extends Record<string, unknown> = {}> = {
    kind: 'relation';
    relationKind: RelationKind;
    sourceTable: source;
    targetTable: target;
    cardinality: cardinality;
    sourceKey: string[];
    targetKey: string[];
    through?: ThroughRelationMetadata;
    modifiers: RelationModifiers<target>;
    where(input: WhereInput<TableColumnName<target> | QualifiedTableColumnName<target>>): Relation<source, target, cardinality, loaded>;
    orderBy(column: TableColumnInput<target>, direction?: OrderDirection): Relation<source, target, cardinality, loaded>;
    limit(value: number): Relation<source, target, cardinality, loaded>;
    offset(value: number): Relation<source, target, cardinality, loaded>;
    with<relations extends RelationMapForTable<target>>(relations: relations): Relation<source, target, cardinality, loaded & LoadedRelationMap<relations>>;
};
export type AnyRelation = Relation<AnyTable, AnyTable, RelationCardinality, any>;
export type CreateTableOptions<name extends string, columns extends TableColumnsDefinition, primaryKey extends ColumnNameFromColumns<columns> | readonly ColumnNameFromColumns<columns>[] | undefined> = {
    name: name;
    columns: columns;
    primaryKey?: primaryKey;
    timestamps?: TimestampOptions;
    beforeWrite?: TableBeforeWrite<TableRowFromColumns<columns>>;
    afterWrite?: TableAfterWrite<TableRowFromColumns<columns>>;
    beforeDelete?: TableBeforeDelete;
    afterDelete?: TableAfterDelete;
    afterRead?: TableAfterRead<TableRowFromColumns<columns>>;
    validate?: TableValidate<TableRowFromColumns<columns>>;
};
/**
 * Creates a lifecycle/validation failure result with one or more issues.
 * @param messageOrIssues Either a single issue message or an array of issues.
 * @param path Optional issue path when passing a message.
 * @returns A `{ issues }` result object for `validate` and lifecycle callbacks.
 * @example
 * ```ts
 * import { column as c, fail, table } from 'remix/data-table'
 *
 * let users = table({
 *   name: 'users',
 *   columns: {
 *     id: c.integer(),
 *     email: c.varchar(255),
 *   },
 *   validate({ value }) {
 *     if (!value.email) {
 *       return fail('Email is required', ['email'])
 *     }
 *
 *     return { value }
 *   },
 * })
 * ```
 */
export declare function fail(message: string, path?: Array<string | number>): ValidationFailure;
export declare function fail(issues: ReadonlyArray<ValidationIssue>): ValidationFailure;
/**
 * Creates a table object with symbol-backed metadata and direct column references.
 * @param options Table declaration options.
 * @returns A frozen table object.
 * @example
 * ```ts
 * import { column as c, table } from 'remix/data-table'
 *
 * let users = table({
 *   name: 'users',
 *   columns: {
 *     id: c.integer(),
 *     email: c.varchar(255),
 *   },
 *   primaryKey: 'id',
 * })
 * ```
 */
export declare function table<name extends string, columns extends TableColumnsDefinition, primaryKey extends ColumnNameFromColumns<columns> | readonly ColumnNameFromColumns<columns>[] | undefined = undefined>(options: CreateTableOptions<name, columns, primaryKey>): Table<name, columns, NormalizePrimaryKey<columns, primaryKey>>;
/**
 * Defines a one-to-many relation from `source` to `target`.
 * @param source Source table.
 * @param target Target table.
 * @param relationOptions Relation key configuration.
 * @returns A relation descriptor.
 */
export declare function hasMany<source extends AnyTable, target extends AnyTable>(source: source, target: target, relationOptions?: HasManyOptions<source, target>): Relation<source, target, 'many'>;
/**
 * Defines a one-to-one relation from `source` to `target` where the foreign key lives on `target`.
 * @param source Source table.
 * @param target Target table.
 * @param relationOptions Relation key configuration.
 * @returns A relation descriptor.
 */
export declare function hasOne<source extends AnyTable, target extends AnyTable>(source: source, target: target, relationOptions?: HasOneOptions<source, target>): Relation<source, target, 'one'>;
/**
 * Defines a one-to-one relation from `source` to `target`.
 * @param source Source table.
 * @param target Target table.
 * @param relationOptions Relation key configuration.
 * @returns A relation descriptor.
 */
export declare function belongsTo<source extends AnyTable, target extends AnyTable>(source: source, target: target, relationOptions?: BelongsToOptions<source, target>): Relation<source, target, 'one'>;
/**
 * Defines a one-to-many relation from `source` to `target` through an intermediate relation.
 * @param source Source table.
 * @param target Target table.
 * @param relationOptions Through relation configuration.
 * @returns A relation descriptor.
 */
export declare function hasManyThrough<source extends AnyTable, target extends AnyTable>(source: source, target: target, relationOptions: HasManyThroughOptions<source, target>): Relation<source, target, 'many'>;
/**
 * Convenience helper for standard snake_case timestamp columns.
 * @returns Column-builder map for `created_at`/`updated_at`.
 */
export declare function timestamps(): Record<'created_at' | 'updated_at', ColumnBuilder<Date | string | number>>;
export type PrimaryKeyInput<table extends AnyTable> = TablePrimaryKey<table> extends readonly [infer column extends string] ? column extends keyof TableColumns<table> & string ? ColumnBuilderInput<TableColumns<table>[column]> : never : Pretty<{
    [column in TablePrimaryKey<table>[number] & keyof TableColumns<table> & string]: ColumnBuilderInput<TableColumns<table>[column]>;
}>;
/**
 * Normalizes a primary-key input into an object keyed by primary-key columns.
 * @param table Source table.
 * @param value Primary-key input value.
 * @returns Primary-key object.
 */
export declare function getPrimaryKeyObject<table extends AnyTable>(table: table, value: PrimaryKeyInput<table>): Partial<TableRow<table>>;
/**
 * Builds a stable key for a row tuple.
 * @param row Source row.
 * @param columns Columns included in the tuple.
 * @returns Stable tuple key.
 */
export declare function getCompositeKey(row: Record<string, unknown>, columns: readonly string[]): string;
/**
 * Serializes values into stable string representations for key generation.
 * @param value Value to serialize.
 * @returns Stable serialized value.
 */
export declare function stableSerialize(value: unknown): string;
//# sourceMappingURL=table.d.ts.map