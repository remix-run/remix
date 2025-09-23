import type { Token, SearchConstraints, ParseResult, ParsedPattern } from './parse.ts'

export function stringify(parsed: ParseResult): string {
  let str = ''

  if (parsed.hostname != null) {
    let protocol = parsed.protocol != null ? stringifyTokens(parsed.protocol) : ''
    let hostname = parsed.hostname != null ? stringifyTokens(parsed.hostname, '.') : ''
    let port = parsed.port != null ? `:${parsed.port}` : ''
    str += `${protocol}://${hostname}${port}`
  }

  if (parsed.pathname != null) {
    let pathname = stringifyTokens(parsed.pathname, '/')
    if (pathname !== '') {
      str += `/${pathname}`
    }
  }

  if (parsed.search != null) {
    let search = stringifySearchConstraints(parsed.search)
    if (search !== '') {
      str += `?${search}`
    }
  }

  return str
}

export function stringifyTokens(tokens: Token[], sep = ''): string {
  let result = ''

  for (let i = 0; i < tokens.length; i++) {
    let token = tokens[i]
    if (token.type === 'variable') {
      result += `:${token.name}`
    } else if (token.type === 'wildcard') {
      result += `*${token.name ?? ''}`
    } else if (token.type === 'enum') {
      result += `{${token.members.join(',')}}`
    } else if (token.type === 'text') {
      result += token.value
    } else if (token.type === 'separator') {
      result += sep
    } else if (token.type === 'optional') {
      result += `(${stringifyTokens(token.tokens, sep)})`
    }
  }

  return result
}

export function stringifySearchConstraints(search: SearchConstraints): string {
  let parts: string[] = []

  for (let [key, value] of search.entries()) {
    if (value.allowBare && !value.requireAssignment) {
      // Parameter can appear without assignment (e.g., just "debug")
      parts.push(key)
    } else if (value.requiredValues && value.requiredValues.size > 0) {
      // Parameter has specific required values - create separate entries for each value
      for (let requiredValue of value.requiredValues) {
        parts.push(`${key}=${requiredValue}`)
      }
    } else if (value.requireAssignment) {
      // Parameter requires assignment but no specific values
      parts.push(`${key}=`)
    }
  }

  return parts.join('&')
}

// prettier-ignore
export type Stringify<T extends ParsedPattern> =
  T['hostname'] extends Token[] ?
    `${StringifyTokens<T['protocol']>}://${StringifyTokens<T['hostname'], '.'>}${StringifyPort<T['port']>}${StringifyPathname<T['pathname']>}${StringifySearch<T['search']>}` :
    T['pathname'] extends Token[] ?
      `${StringifyPathname<T['pathname']>}${StringifySearch<T['search']>}` :
      StringifySearch<T['search']>

export type StringifyPort<T extends string | undefined> = T extends string ? `:${T}` : ''

// prettier-ignore
type StringifyPathname<T extends Token[] | undefined> =
  T extends undefined ? '' :
  StringifyTokens<T, '/'> extends infer S extends string ?
    S extends '' ? '' :
    `/${S}` :
  never

export type StringifySearch<T extends string | undefined> = T extends string ? `?${T}` : ''

// prettier-ignore
export type StringifyTokens<T extends Token[] | undefined, Sep extends string = ''> =
  T extends undefined ? '' :
  T extends [] ? '' :
  T extends [infer Head extends Token, ...infer Tail extends Token[]] ?
    `${StringifyToken<Head, Sep>}${StringifyTokens<Tail, Sep>}` :
    never

// prettier-ignore
type StringifyToken<T extends Token, Sep extends string = ''> =
  T extends { type: 'text', value: infer V extends string } ? V :
  T extends { type: 'variable', name: infer N extends string } ? `:${N}` :
  T extends { type: 'wildcard', name: infer N extends string } ? `*${N}` :
  T extends { type: 'wildcard' } ? '*' :
  T extends { type: 'enum', members: infer M extends string[] } ? `{${JoinStringArray<M, ','>}}` :
  T extends { type: 'separator' } ? Sep :
  T extends { type: 'optional', tokens: infer Tokens extends Token[] } ? `(${StringifyTokens<Tokens, Sep>})` :
  never

// prettier-ignore
type JoinStringArray<T extends string[], S extends string> =
  T extends [] ? '' :
  T extends [infer Head extends string] ? Head :
  T extends [infer Head extends string, ...infer Tail extends string[]] ?
    `${Head}${S}${JoinStringArray<Tail, S>}` :
    never
