export type SqlStatement = {
  text: string
  values: unknown[]
}

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

export function isSqlStatement(value: unknown): value is SqlStatement {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  let statement = value as { text?: unknown; values?: unknown }

  return typeof statement.text === 'string' && Array.isArray(statement.values)
}

export function rawSql(text: string, values: unknown[] = []): SqlStatement {
  return { text, values }
}
