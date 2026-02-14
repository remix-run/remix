/**
 * Parameterized SQL payload with positional `?` placeholders.
 */
export type SqlStatement = {
  text: string
  values: unknown[]
}

/**
 * Tagged-template helper for building parameterized SQL statements.
 * @param strings Template string parts.
 * @param values Interpolated values or nested `SqlStatement` values.
 * @returns A normalized SQL statement.
 */
export function sql(strings: TemplateStringsArray, ...values: unknown[]): SqlStatement {
  let text = ''
  let parameters: unknown[] = []
  let index = 0

  while (index < strings.length) {
    text += strings[index]

    if (index < values.length) {
      let value = values[index]

      if (isSqlStatement(value)) {
        text += value.text
        parameters.push(...value.values)
      } else {
        text += '?'
        parameters.push(value)
      }
    }

    index += 1
  }

  return {
    text,
    values: parameters,
  }
}

/**
 * Returns `true` when a value matches the `SqlStatement` shape.
 * @param value Value to inspect.
 * @returns Whether the value is a SQL statement object.
 */
export function isSqlStatement(value: unknown): value is SqlStatement {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  let statement = value as { text?: unknown; values?: unknown }

  return typeof statement.text === 'string' && Array.isArray(statement.values)
}

/**
 * Creates a SQL statement from raw text and values.
 * @param text SQL text containing `?` placeholders.
 * @param values Placeholder values.
 * @returns A normalized SQL statement.
 */
export function rawSql(text: string, values: unknown[] = []): SqlStatement {
  return { text, values }
}
