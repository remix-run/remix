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
export function sql(strings, ...values) {
    let text = '';
    let parameters = [];
    let index = 0;
    while (index < strings.length) {
        text += strings[index];
        if (index < values.length) {
            let value = values[index];
            if (isSqlStatement(value)) {
                text += value.text;
                parameters.push(...value.values);
            }
            else {
                text += '?';
                parameters.push(value);
            }
        }
        index += 1;
    }
    return {
        text,
        values: parameters,
    };
}
/**
 * Returns `true` when a value matches the `SqlStatement` shape.
 * @param value Value to inspect.
 * @returns Whether the value is a SQL statement object.
 */
export function isSqlStatement(value) {
    if (typeof value !== 'object' || value === null) {
        return false;
    }
    let statement = value;
    return typeof statement.text === 'string' && Array.isArray(statement.values);
}
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
export function rawSql(text, values = []) {
    return { text, values };
}
