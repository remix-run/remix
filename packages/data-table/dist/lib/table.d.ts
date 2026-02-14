import type { Predicate, WhereInput } from './operators.ts';
import type { Pretty } from './types.ts';
export type DataSchema<input = unknown, output = input> = {
    '~standard': {
        version: number;
        vendor: string;
        validate(value: unknown, options?: unknown): {
            value: output;
        } | {
            issues: ReadonlyArray<unknown>;
        };
    };
};
export type ColumnSchemas = Record<string, DataSchema<any, any>>;
export type InferSchemaOutput<schema> = schema extends DataSchema<any, infer output> ? output : never;
export type TableRow<table extends AnyTable> = Pretty<{
    [column in keyof table['columns']]: InferSchemaOutput<table['columns'][column]>;
}>;
export type TableRowWithLoaded<table extends AnyTable, loaded extends Record<string, unknown> = {}> = Pretty<TableRow<table> & loaded>;
export type OrderDirection = 'asc' | 'desc';
export type OrderByClause = {
    column: string;
    direction: OrderDirection;
};
type ColumnNameFromColumns<columns extends ColumnSchemas> = keyof columns & string;
type DefaultPrimaryKey<columns extends ColumnSchemas> = 'id' extends ColumnNameFromColumns<columns> ? readonly ['id'] : readonly ColumnNameFromColumns<columns>[];
type NormalizePrimaryKey<columns extends ColumnSchemas, primaryKey extends ColumnNameFromColumns<columns> | readonly ColumnNameFromColumns<columns>[] | undefined> = primaryKey extends readonly (infer column extends ColumnNameFromColumns<columns>)[] ? readonly [...column[]] : primaryKey extends ColumnNameFromColumns<columns> ? readonly [primaryKey] : DefaultPrimaryKey<columns>;
export type RelationCardinality = 'one' | 'many';
export type RelationKind = 'hasMany' | 'hasOne' | 'belongsTo' | 'hasManyThrough';
export type RelationResult<relation extends AnyRelation> = relation extends Relation<any, infer target, infer cardinality, infer loaded> ? cardinality extends 'many' ? Array<TableRowWithLoaded<target, loaded>> : TableRowWithLoaded<target, loaded> | null : never;
export type RelationMapForTable<table extends AnyTable> = Record<string, Relation<table, AnyTable, RelationCardinality, any>>;
export type LoadedRelationMap<relations extends RelationMapForTable<any>> = Pretty<{
    [name in keyof relations]: RelationResult<relations[name]>;
}>;
export type TableReference<table extends AnyTable = AnyTable> = Pretty<Pick<table, 'kind' | 'name' | 'columns' | 'primaryKey' | 'timestamps'>>;
export type KeySelector<table extends AnyTable> = (keyof TableRow<table> & string) | readonly (keyof TableRow<table> & string)[];
export type HasManyOptions<source extends AnyTable, target extends AnyTable> = {
    name?: string;
    foreignKey?: KeySelector<target>;
    targetKey?: KeySelector<source>;
};
export type HasOneOptions<source extends AnyTable, target extends AnyTable> = {
    name?: string;
    foreignKey?: KeySelector<target>;
    targetKey?: KeySelector<source>;
};
export type BelongsToOptions<source extends AnyTable, target extends AnyTable> = {
    name?: string;
    foreignKey?: KeySelector<source>;
    targetKey?: KeySelector<target>;
};
export type HasManyThroughOptions<source extends AnyTable, target extends AnyTable> = {
    name?: string;
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
    name: string;
    sourceTable: source;
    targetTable: target;
    cardinality: cardinality;
    sourceKey: string[];
    targetKey: string[];
    through?: ThroughRelationMetadata;
    modifiers: RelationModifiers<target>;
    where(input: WhereInput<keyof TableRow<target> & string>): Relation<source, target, cardinality, loaded>;
    orderBy(column: keyof TableRow<target> & string, direction?: OrderDirection): Relation<source, target, cardinality, loaded>;
    limit(value: number): Relation<source, target, cardinality, loaded>;
    offset(value: number): Relation<source, target, cardinality, loaded>;
    with<relations extends RelationMapForTable<target>>(relations: relations): Relation<source, target, cardinality, loaded & LoadedRelationMap<relations>>;
};
export type TimestampOptions = boolean | {
    createdAt?: string;
    updatedAt?: string;
};
export type TimestampConfig = {
    createdAt: string;
    updatedAt: string;
};
export type Table<name extends string, columns extends ColumnSchemas, primaryKey extends readonly ColumnNameFromColumns<columns>[]> = {
    kind: 'table';
    name: name;
    columns: columns;
    primaryKey: primaryKey;
    timestamps: TimestampConfig | null;
    hasMany<target extends AnyTable>(target: target, options?: HasManyOptions<Table<name, columns, primaryKey>, target>): Relation<Table<name, columns, primaryKey>, target, 'many'>;
    hasOne<target extends AnyTable>(target: target, options?: HasOneOptions<Table<name, columns, primaryKey>, target>): Relation<Table<name, columns, primaryKey>, target, 'one'>;
    belongsTo<target extends AnyTable>(target: target, options?: BelongsToOptions<Table<name, columns, primaryKey>, target>): Relation<Table<name, columns, primaryKey>, target, 'one'>;
    hasManyThrough<target extends AnyTable>(target: target, options: HasManyThroughOptions<Table<name, columns, primaryKey>, target>): Relation<Table<name, columns, primaryKey>, target, 'many'>;
};
export type AnyTable = Table<string, ColumnSchemas, readonly string[]>;
export type AnyRelation = Relation<AnyTable, AnyTable, RelationCardinality, any>;
export type CreateTableOptions<name extends string, columns extends ColumnSchemas, primaryKey extends ColumnNameFromColumns<columns> | readonly ColumnNameFromColumns<columns>[] | undefined> = {
    name: name;
    columns: columns;
    primaryKey?: primaryKey;
    timestamps?: TimestampOptions;
};
export declare function createTable<name extends string, columns extends ColumnSchemas, primaryKey extends ColumnNameFromColumns<columns> | readonly ColumnNameFromColumns<columns>[] | undefined = undefined>(options: CreateTableOptions<name, columns, primaryKey>): Table<name, columns, NormalizePrimaryKey<columns, primaryKey>>;
export declare function timestampSchema(): DataSchema<unknown, Date | string | number>;
export declare function timestamps(schema?: DataSchema<any, any>): Record<'created_at' | 'updated_at', DataSchema<any, any>>;
export type PrimaryKeyInput<table extends AnyTable> = table['primaryKey'] extends readonly [
    infer column extends string
] ? TableRow<table>[column] : Pretty<{
    [column in table['primaryKey'][number] & keyof TableRow<table>]: TableRow<table>[column];
}>;
export declare function getPrimaryKeyObject<table extends AnyTable>(table: table, value: PrimaryKeyInput<table>): Partial<TableRow<table>>;
export declare function getCompositeKey(row: Record<string, unknown>, columns: readonly string[]): string;
export declare function stableSerialize(value: unknown): string;
export {};
//# sourceMappingURL=table.d.ts.map