/**
 * Parameterized SQL payload.
 *
 * The `text` may contain positional placeholders (`?`) or dialect-native
 * placeholders (for example `$1`, `$2`) depending on compiler stage.
 * Use {@link sql} or {@link rawSql} to create statements for nested composition.
 */
export type SqlStatement = {
  /** SQL text containing placeholders. */
  text: string
  /** Values to bind to the placeholders. */
  values: unknown[]
}

// Track template fragments separately from structural driver statements.
const sqlStatements = new WeakSet<SqlStatement>()

/**
 * Tagged-template helper for building parameterized SQL statements.
 *
 * Nested statements created by this module's {@link sql} or {@link rawSql} are
 * composed with their parameter values in order. Arrays expand into a
 * parenthesized, comma-separated list with one entry per item, for use with
 * `in`. Other interpolated values become parameters.
 *
 * @param strings Template string parts.
 * @param values Interpolated data, arrays of data, or nested statements created by {@link sql} or {@link rawSql}.
 * @returns A normalized {@link SqlStatement}.
 * @example
 * ```ts
 * import { sql } from 'remix/data-table'
 *
 * let email = 'user@example.com'
 * let statement = sql`select * from users where email = ${email}`
 * // => { text: 'select * from users where email = ?', values: ['user@example.com'] }
 *
 * let ids = [1, 2]
 * let list = sql`select * from users where id in ${ids}`
 * // => { text: 'select * from users where id in (?, ?)', values: [1, 2] }
 * ```
 */
export function sql(strings: TemplateStringsArray, ...values: unknown[]): SqlStatement {
  let text = ''
  let parameters: unknown[] = []
  let index = 0

  function interpolate(value: unknown): string {
    if (isSqlStatement(value) && sqlStatements.has(value)) {
      parameters.push(...value.values)
      return value.text
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        throw new TypeError('Cannot interpolate an empty array into SQL')
      }

      return '(' + value.map(interpolate).join(', ') + ')'
    }

    parameters.push(value)
    return '?'
  }

  while (index < strings.length) {
    text += strings[index]

    if (index < values.length) {
      text += interpolate(values[index])
    }

    index += 1
  }

  return rawSql(text, parameters)
}

/**
 * Returns `true` when a value matches the {@link SqlStatement} shape.
 * @param value Value to inspect.
 * @returns Whether the value is a {@link SqlStatement} object.
 */
export function isSqlStatement(value: unknown): value is SqlStatement {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  let statement = value as { text?: unknown; values?: unknown }

  return typeof statement.text === 'string' && Array.isArray(statement.values)
}

/**
 * Creates a composable SQL statement from text and parameter values.
 *
 * The text is used as supplied. Pass dynamic data through `values` or
 * {@link sql} interpolation.
 *
 * @param text SQL text containing placeholders expected by the target database.
 * @param values Placeholder values.
 * @returns A normalized SQL statement.
 * @example
 * ```ts
 * import { rawSql } from 'remix/data-table'
 *
 * let statement = rawSql('select * from users where id = ?', [1])
 * ```
 */
export function rawSql(text: string, values: unknown[] = []): SqlStatement {
  let statement = { text, values }
  sqlStatements.add(statement)
  return statement
}
