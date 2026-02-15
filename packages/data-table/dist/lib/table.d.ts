import type { InferOutput, Issue, ParseOptions, Schema } from '@remix-run/data-schema';
import type { Predicate, WhereInput } from './operators.ts';
import { columnMetadataKey, tableMetadataKey } from './references.ts';
import type { ColumnInput, ColumnReferenceLike, TableMetadataLike } from './references.ts';
import type { Pretty } from './types.ts';
/**
 * Symbol key used to store non-enumerable table metadata.
 */
export { columnMetadataKey, tableMetadataKey } from './references.ts';
/**
 * Mapping of column names to schemas.
 */
export type ColumnSchemas = Record<string, Schema<any, any>>;
type ColumnNameFromColumns<columns extends ColumnSchemas> = keyof columns & string;
type DefaultPrimaryKey<columns extends ColumnSchemas> = 'id' extends ColumnNameFromColumns<columns> ? readonly ['id'] : readonly ColumnNameFromColumns<columns>[];
type NormalizePrimaryKey<columns extends ColumnSchemas, primaryKey extends ColumnNameFromColumns<columns> | readonly ColumnNameFromColumns<columns>[] | undefined> = primaryKey extends readonly (infer column extends ColumnNameFromColumns<columns>)[] ? readonly [...column[]] : primaryKey extends ColumnNameFromColumns<columns> ? readonly [primaryKey] : DefaultPrimaryKey<columns>;
export type TimestampOptions = boolean | {
    createdAt?: string;
    updatedAt?: string;
};
export type TimestampConfig = {
    createdAt: string;
    updatedAt: string;
};
type TableMetadata<name extends string, columns extends ColumnSchemas, primaryKey extends readonly ColumnNameFromColumns<columns>[]> = {
    name: name;
    columns: columns;
    primaryKey: primaryKey;
    timestamps: TimestampConfig | null;
};
export type ColumnReference<tableName extends string, columnName extends string, schema extends Schema<any, any>> = ColumnReferenceLike<`${tableName}.${columnName}`> & {
    [columnMetadataKey]: {
        tableName: tableName;
        columnName: columnName;
        qualifiedName: `${tableName}.${columnName}`;
        schema: schema;
    };
};
export type AnyColumn = ColumnReference<string, string, Schema<any, any>>;
export type ColumnReferenceForQualifiedName<qualifiedName extends string> = AnyColumn & {
    [columnMetadataKey]: {
        qualifiedName: qualifiedName;
    };
};
type TableColumnReferences<name extends string, columns extends ColumnSchemas> = {
    [column in keyof columns & string]: ColumnReference<name, column, columns[column]>;
};
type TableParseOutput<columns extends ColumnSchemas> = Partial<{
    [column in keyof columns & string]: InferOutput<columns[column]>;
}>;
export type Table<name extends string, columns extends ColumnSchemas, primaryKey extends readonly ColumnNameFromColumns<columns>[]> = TableMetadataLike<name, columns, primaryKey, TimestampConfig | null> & {
    [tableMetadataKey]: TableMetadata<name, columns, primaryKey>;
    '~standard': Schema<unknown, TableParseOutput<columns>>['~standard'];
} & TableColumnReferences<name, columns>;
export type AnyTable = TableMetadataLike<string, ColumnSchemas, readonly string[], TimestampConfig | null> & {
    [tableMetadataKey]: {
        name: string;
        columns: ColumnSchemas;
        primaryKey: readonly string[];
        timestamps: TimestampConfig | null;
    };
    '~standard': Schema<unknown, Partial<Record<string, unknown>>>['~standard'];
} & Record<string, unknown>;
export type TableName<table extends AnyTable> = table[typeof tableMetadataKey]['name'];
export type TableColumns<table extends AnyTable> = table[typeof tableMetadataKey]['columns'];
export type TablePrimaryKey<table extends AnyTable> = table[typeof tableMetadataKey]['primaryKey'];
export type TableTimestamps<table extends AnyTable> = table[typeof tableMetadataKey]['timestamps'];
export type TableRow<table extends AnyTable> = Pretty<{
    [column in keyof TableColumns<table> & string]: InferOutput<TableColumns<table>[column]>;
}>;
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
 * Returns a table's schema map.
 * @param table Source table instance.
 * @returns Table schema map.
 */
export declare function getTableColumns<table extends AnyTable>(table: table): TableColumns<table>;
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
export type CreateTableOptions<name extends string, columns extends ColumnSchemas, primaryKey extends ColumnNameFromColumns<columns> | readonly ColumnNameFromColumns<columns>[] | undefined> = {
    name: name;
    columns: columns;
    primaryKey?: primaryKey;
    timestamps?: TimestampOptions;
};
export declare function validatePartialRow<table extends AnyTable>(table: table, value: unknown, options?: ParseOptions): {
    value: Partial<TableRow<table>>;
} | {
    issues: ReadonlyArray<Issue>;
};
/**
 * Creates a table object with symbol-backed metadata and direct column references.
 * @param options Table declaration options.
 * @returns A frozen table object.
 */
export declare function createTable<name extends string, columns extends ColumnSchemas, primaryKey extends ColumnNameFromColumns<columns> | readonly ColumnNameFromColumns<columns>[] | undefined = undefined>(options: CreateTableOptions<name, columns, primaryKey>): Table<name, columns, NormalizePrimaryKey<columns, primaryKey>>;
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
 * Creates a schema that accepts `Date`, string, and numeric timestamp inputs.
 * @returns Timestamp schema for generated timestamp helpers.
 */
export declare function timestampSchema(): Schema<unknown, Date | string | number>;
/**
 * Convenience helper for standard snake_case timestamp columns.
 * @param schema Schema used for both timestamp columns.
 * @returns Column schema map for `created_at`/`updated_at`.
 */
export declare function timestamps(schema?: Schema<any, any>): Record<'created_at' | 'updated_at', Schema<any, any>>;
export type PrimaryKeyInput<table extends AnyTable> = TablePrimaryKey<table> extends readonly [infer column extends string] ? TableRow<table>[column] : Pretty<{
    [column in TablePrimaryKey<table>[number] & keyof TableRow<table>]: TableRow<table>[column];
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