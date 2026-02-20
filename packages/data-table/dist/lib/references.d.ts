/**
 * Symbol key used to store non-enumerable table metadata.
 */
export declare const tableMetadataKey: unique symbol;
/**
 * Symbol key used to store non-enumerable column metadata.
 */
export declare const columnMetadataKey: unique symbol;
type UnknownTableMetadata<name extends string = string, columns extends Record<string, unknown> = Record<string, unknown>, primaryKey extends readonly string[] = readonly string[], timestamps = unknown> = {
    name: name;
    columns: columns;
    primaryKey: primaryKey;
    timestamps: timestamps;
};
export type TableMetadataLike<name extends string = string, columns extends Record<string, unknown> = Record<string, unknown>, primaryKey extends readonly string[] = readonly string[], timestamps = unknown> = {
    [tableMetadataKey]: UnknownTableMetadata<name, columns, primaryKey, timestamps>;
};
export type ColumnReferenceLike<qualifiedName extends string = string> = {
    kind: 'column';
    [columnMetadataKey]: {
        tableName: string;
        columnName: string;
        qualifiedName: qualifiedName;
        schema: unknown;
    };
};
export type ColumnInput<qualifiedName extends string = string> = qualifiedName | ColumnReferenceLike<qualifiedName>;
export type NormalizeColumnInput<input> = input extends ColumnReferenceLike<infer qualifiedName> ? qualifiedName : input;
/**
 * Returns `true` when a value is a `data-table` column reference.
 * @param value Value to inspect.
 * @returns Whether the value is a column reference object.
 */
export declare function isColumnReference(value: unknown): value is ColumnReferenceLike;
/**
 * Normalizes string/column-reference inputs to a qualified column name.
 * @param input Column name or column reference.
 * @returns The normalized qualified column name.
 */
export declare function normalizeColumnInput<input extends string | ColumnReferenceLike>(input: input): NormalizeColumnInput<input>;
export {};
//# sourceMappingURL=references.d.ts.map