import type { ColumnDefinition, ForeignKeyAction, IdentityOptions } from './adapter.ts';
/**
 * Chainable builder used to describe physical column definitions.
 */
export declare class ColumnBuilder<output = unknown> {
    #private;
    constructor(definition: ColumnDefinition);
    nullable(): ColumnBuilder<output | null>;
    notNull(): ColumnBuilder<Exclude<output, null>>;
    default(value: unknown): ColumnBuilder<output>;
    defaultNow(): ColumnBuilder<output>;
    defaultSql(expression: string): ColumnBuilder<output>;
    primaryKey(): ColumnBuilder<output>;
    unique(name?: string): ColumnBuilder<output>;
    references(table: string, name: string): ColumnBuilder<output>;
    references(table: string, columns: string | string[], name: string): ColumnBuilder<output>;
    onDelete(action: ForeignKeyAction): ColumnBuilder<output>;
    onUpdate(action: ForeignKeyAction): ColumnBuilder<output>;
    check(expression: string, name: string): ColumnBuilder<output>;
    comment(text: string): ColumnBuilder<output>;
    computed(expression: string, options?: {
        stored?: boolean;
    }): ColumnBuilder<output>;
    unsigned(): ColumnBuilder<output>;
    autoIncrement(): ColumnBuilder<output>;
    identity(options?: IdentityOptions): ColumnBuilder<output>;
    collate(name: string): ColumnBuilder<output>;
    charset(name: string): ColumnBuilder<output>;
    length(value: number): ColumnBuilder<output>;
    precision(value: number, scale?: number): ColumnBuilder<output>;
    scale(value: number): ColumnBuilder<output>;
    timezone(enabled?: boolean): ColumnBuilder<output>;
    build(): ColumnDefinition;
}
export type ColumnOutput<column extends ColumnBuilder<any>> = column extends ColumnBuilder<infer output> ? output : never;
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
export declare let column: ColumnNamespace;
//# sourceMappingURL=column.d.ts.map