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
    str += startsWithSeparator(parsed.pathname) ? pathname : `/${pathname}`
  } else {
    str += '/'
  }

  if (parsed.search) {
    str += `?${parsed.search}`
  } else if (parsed.searchConstraints != null) {
    let search = stringifySearchConstraints(parsed.searchConstraints)
    if (search !== '') {
      str += `?${search}`
    }
  }

  return str
}

export function startsWithSeparator(tokens: Token[]): boolean {
  if (tokens.length === 0) return false

  let firstToken = tokens[0]
  if (firstToken.type === 'separator') return true

  // Check if it starts with an optional that contains a separator
  if (firstToken.type === 'optional' && firstToken.tokens && firstToken.tokens.length > 0) {
    return startsWithSeparator(firstToken.tokens)
  }

  return false
}

export function stringifyTokens(tokens: Token[], sep = ''): string {
  let str = ''

  for (let i = 0; i < tokens.length; i++) {
    let token = tokens[i]
    if (token.type === 'variable') {
      str += `:${token.name}`
    } else if (token.type === 'wildcard') {
      str += `*${token.name ?? ''}`
    } else if (token.type === 'text') {
      str += token.value
    } else if (token.type === 'separator') {
      str += sep
    } else if (token.type === 'optional') {
      str += `(${stringifyTokens(token.tokens, sep)})`
    }
  }

  return str
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
    `${StringifyTokens<T['protocol'], ''>}://${StringifyTokens<T['hostname'], '.'>}${StringifyPort<T['port']>}${StringifyPathname<T['pathname']>}${StringifySearch<T['search']>}` :
    `${StringifyPathname<T['pathname']>}${StringifySearch<T['search']>}`

// prettier-ignore
type StringifyTokens<T extends Token[] | undefined, Sep extends string> =
  T extends undefined ? '' :
  T extends [] ? '' :
  T extends [infer Head extends Token, ...infer Tail extends Token[]] ?
    `${StringifyToken<Head, Sep>}${StringifyTokens<Tail, Sep>}` :
    never

// prettier-ignore
type StringifyToken<T extends Token, Sep extends string> =
  T extends { type: 'text', value: infer V extends string } ? V :
  T extends { type: 'variable', name: infer N extends string } ? `:${N}` :
  T extends { type: 'wildcard', name: infer N extends string } ? `*${N}` :
  T extends { type: 'wildcard' } ? '*' :
  T extends { type: 'separator' } ? Sep :
  T extends { type: 'optional', tokens: infer Tokens extends Token[] } ? `(${StringifyTokens<Tokens, Sep>})` :
  never

// prettier-ignore
type StringifyPathname<T extends Token[] | undefined> =
  T extends undefined ? '/' :
  T extends [] ? '/' :
  T extends Token[] ?
    StartsWithSeparator<T> extends true ?
      `${StringifyTokens<T, '/'>}` :
      `/${StringifyTokens<T, '/'>}` :
    never

type StringifyPort<T extends string | undefined> = T extends string ? `:${T}` : ''

type StringifySearch<T extends string | undefined> = T extends string ? `?${T}` : ''

// prettier-ignore
export type StartsWithSeparator<T extends Token[]> =
  T extends [] ? false :
  T extends [{ type: 'separator' }, ...any] ? true :
  T extends [{ type: 'optional', tokens: infer Tokens extends Token[] }, ...any] ?
    StartsWithSeparator<Tokens> :
    false
