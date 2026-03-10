/**
 * Internal brand symbol used to distinguish genuine `SqlStatement` objects
 * (produced by `sql\`...\`` or `rawSql()`) from arbitrary plain objects that
 * happen to share the same shape.  The symbol is intentionally NOT exported so
 * that user-land objects cannot accidentally or maliciously forge it.
 */
declare const sqlStatementBrand: unique symbol;
/**
 * Parameterized SQL payload.
 *
 * The `text` may contain positional placeholders (`?`) or dialect-native
 * placeholders (for example `$1`, `$2`) depending on compiler stage.
 *
 * Always construct values with `sql\`...\`` or `rawSql()` — only objects
 * produced by those helpers carry the internal brand that makes them
 * composable inside `sql\`...\`` template literals.
 */
export type SqlStatement = {
    text: string;
    values: unknown[];
    readonly [sqlStatementBrand]?: true;
};
/**
 * Tagged-template helper for building parameterized SQL statements.
 * @param strings Template string parts.
 * @param values Interpolated values or nested `SqlStatement` values.
 * @returns A normalized SQL statement.
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
 * Returns `true` when a value is a branded `SqlStatement` produced by
 * `sql\`...\`` or `rawSql()`.  Plain objects that merely share the
 * `{ text, values }` shape are intentionally rejected to prevent
 * user-controlled data from being interpolated as raw SQL.
 * @param value Value to inspect.
 * @returns Whether the value is a branded SQL statement object.
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
export {};
//# sourceMappingURL=sql.d.ts.map