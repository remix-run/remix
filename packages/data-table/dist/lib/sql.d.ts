/**
 * Parameterized SQL payload.
 *
 * The `text` may contain positional placeholders (`?`) or dialect-native
 * placeholders (for example `$1`, `$2`) depending on compiler stage.
 */
export type SqlStatement = {
    text: string;
    values: unknown[];
};
/**
 * Tagged-template helper for building parameterized SQL statements.
 * @param strings Template string parts.
 * @param values Interpolated values or nested {@link SqlStatement} values.
 * @returns A normalized {@link SqlStatement}.
 * @example
 * ```ts
 * import { sql } from 'remix/data-table'
 *
 * let email = 'user@example.com'
 * let statement = sql`select * from users where email = ${email}`
 * // => { text: 'select * from users where email = ?', values: ['user@example.com'] }
 * ```
 */
export declare function sql(strings: TemplateStringsArray, ...values: unknown[]): SqlStatement;
/**
 * Returns `true` when a value matches the {@link SqlStatement} shape.
 * @param value Value to inspect.
 * @returns Whether the value is a {@link SqlStatement} object.
 */
export declare function isSqlStatement(value: unknown): value is SqlStatement;
/**
 * Creates a SQL statement from raw text and values.
 * @param text SQL text containing placeholders expected by the target adapter.
 * @param values Placeholder values.
 * @returns A normalized SQL statement.
 * @example
 * ```ts
 * import { rawSql } from 'remix/data-table'
 *
 * let statement = rawSql('select * from users where id = ?', [1])
 * ```
 */
export declare function rawSql(text: string, values?: unknown[]): SqlStatement;
//# sourceMappingURL=sql.d.ts.map