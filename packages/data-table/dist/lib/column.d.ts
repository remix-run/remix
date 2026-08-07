import type { ColumnDefinition, ForeignKeyAction, IdentityOptions } from './adapter.ts';
/**
 * Chainable builder used to describe physical column definitions.
 */
export declare class ColumnBuilder<output = unknown> {
    #private;
    constructor(definition: ColumnDefinition);
    /**
     * Marks the column as nullable.
     * @returns The column builder with `null` added to its output type.
     */
    nullable(): ColumnBuilder<output | null>;
    /**
     * Marks the column as non-nullable.
     * @returns The column builder with `null` removed from its output type.
     */
    notNull(): ColumnBuilder<Exclude<output, null>>;
    /**
     * Sets a literal default value for the column.
     * @param value Default value to apply when the column is omitted.
     * @returns The column builder.
     */
    default(value: unknown): ColumnBuilder<output>;
    /**
     * Sets the column default to the current timestamp at write time.
     * @returns The column builder.
     */
    defaultNow(): ColumnBuilder<output>;
    /**
     * Sets a raw SQL expression as the column default.
     * @param expression SQL expression used as the default value.
     * @returns The column builder.
     */
    defaultSql(expression: string): ColumnBuilder<output>;
    /**
     * Marks the column as part of the primary key.
     * @returns The column builder.
     */
    primaryKey(): ColumnBuilder<output>;
    /**
     * Marks the column as unique.
     * @param name Optional constraint name.
     * @returns The column builder.
     */
    unique(name?: string): ColumnBuilder<output>;
    /**
     * Adds a foreign-key reference for the column.
     * @param table Referenced table name.
     * @param name Constraint name.
     * @returns The column builder.
     */
    references(table: string, name: string): ColumnBuilder<output>;
    /**
     * Adds a foreign-key reference for the column.
     * @param table Referenced table name.
     * @param columns Referenced column list.
     * @param name Constraint name.
     * @returns The column builder.
     */
    references(table: string, columns: string | string[], name: string): ColumnBuilder<output>;
    /**
     * Sets the foreign-key action used when the referenced row is deleted.
     * @param action Delete action to apply.
     * @returns The column builder.
     */
    onDelete(action: ForeignKeyAction): ColumnBuilder<output>;
    /**
     * Sets the foreign-key action used when the referenced row is updated.
     * @param action Update action to apply.
     * @returns The column builder.
     */
    onUpdate(action: ForeignKeyAction): ColumnBuilder<output>;
    /**
     * Adds a check constraint for the column.
     * @param expression SQL check expression.
     * @param name Constraint name.
     * @returns The column builder.
     */
    check(expression: string, name: string): ColumnBuilder<output>;
    /**
     * Adds a database comment for the column.
     * @param text Comment text.
     * @returns The column builder.
     */
    comment(text: string): ColumnBuilder<output>;
    /**
     * Marks the column as computed from a SQL expression.
     * @param expression SQL expression for the computed value.
     * @param options Computed-column options.
     * @param options.stored Whether the computed column should be stored instead of virtual.
     * @returns The column builder.
     */
    computed(expression: string, options?: {
        stored?: boolean;
    }): ColumnBuilder<output>;
    /**
     * Marks the column as unsigned when the dialect supports it.
     * @returns The column builder.
     */
    unsigned(): ColumnBuilder<output>;
    /**
     * Marks the column as auto-incrementing when the dialect supports it.
     * @returns The column builder.
     */
    autoIncrement(): ColumnBuilder<output>;
    /**
     * Configures an identity column strategy when the dialect supports it.
     * @param options Identity sequence options.
     * @returns The column builder.
     */
    identity(options?: IdentityOptions): ColumnBuilder<output>;
    /**
     * Sets the collation for the column.
     * @param name Collation name.
     * @returns The column builder.
     */
    collate(name: string): ColumnBuilder<output>;
    /**
     * Sets the character set for the column.
     * @param name Character set name.
     * @returns The column builder.
     */
    charset(name: string): ColumnBuilder<output>;
    /**
     * Sets the column length.
     * @param value Maximum length value.
     * @returns The column builder.
     */
    length(value: number): ColumnBuilder<output>;
    /**
     * Sets numeric precision and optional scale for the column.
     * @param value Precision value.
     * @param scale Optional scale value.
     * @returns The column builder.
     */
    precision(value: number, scale?: number): ColumnBuilder<output>;
    /**
     * Sets numeric scale for the column.
     * @param value Scale value.
     * @returns The column builder.
     */
    scale(value: number): ColumnBuilder<output>;
    /**
     * Enables or disables timezone support for time-based columns.
     * @param enabled Whether timezone support should be enabled.
     * @returns The column builder.
     */
    timezone(enabled?: boolean): ColumnBuilder<output>;
    /**
     * Builds the immutable column definition.
     * @returns A normalized column definition.
     */
    build(): ColumnDefinition;
}
/** Resolves the runtime output type from a column builder. */
export type ColumnOutput<column extends ColumnBuilder<any>> = column extends ColumnBuilder<infer output> ? output : never;
/** Input type accepted when writing values for a column builder. */
export type ColumnInput<column extends ColumnBuilder<any>> = ColumnOutput<column>;
/**
 * Public constructor namespace for column builders.
 */
export type ColumnNamespace = {
    varchar(length: number): ColumnBuilder<string>;
    text(): ColumnBuilder<string>;
    integer(): ColumnBuilder<number>;
    bigint(): ColumnBuilder;
    decimal(precision: number, scale: number): ColumnBuilder<number>;
    boolean(): ColumnBuilder<boolean>;
    uuid(): ColumnBuilder<string>;
    date(): ColumnBuilder;
    time(options?: {
        precision?: number;
        withTimezone?: boolean;
    }): ColumnBuilder;
    timestamp(options?: {
        precision?: number;
        withTimezone?: boolean;
    }): ColumnBuilder;
    json(): ColumnBuilder;
    binary(length?: number): ColumnBuilder;
    enum<values extends readonly string[]>(values: values): ColumnBuilder<values[number]>;
};
/**
 * Chainable column builder namespace.
 * @example
 * ```ts
 * import { column as c } from 'remix/data-table'
 *
 * let email = c.varchar(255).notNull().unique('users_email_uq')
 * ```
 */
export declare const column: ColumnNamespace;
//# sourceMappingURL=column.d.ts.map