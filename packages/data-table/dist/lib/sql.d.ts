/**
 * Parameterized SQL payload with positional `?` placeholders.
 */
export type SqlStatement = {
    text: string;
    values: unknown[];
};
/**
 * Tagged-template helper for building parameterized SQL statements.
 * @param strings Template string parts.
 * @param values Interpolated values or nested `SqlStatement` values.
 * @returns A normalized SQL statement.
 */
export declare function sql(strings: TemplateStringsArray, ...values: unknown[]): SqlStatement;
/**
 * Returns `true` when a value matches the `SqlStatement` shape.
 * @param value Value to inspect.
 * @returns Whether the value is a SQL statement object.
 */
export declare function isSqlStatement(value: unknown): value is SqlStatement;
/**
 * Creates a SQL statement from raw text and values.
 * @param text SQL text containing `?` placeholders.
 * @param values Placeholder values.
 * @returns A normalized SQL statement.
 */
export declare function rawSql(text: string, values?: unknown[]): SqlStatement;
//# sourceMappingURL=sql.d.ts.map