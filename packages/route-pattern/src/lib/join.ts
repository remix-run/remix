import { parse } from './parse.ts'
import type { Parse, ParsedPattern } from './parse.ts'
import type { ParseResult, SearchConstraints, Token } from './parse.ts'
import { stringifyTokens, stringifySearchConstraints } from './stringify.ts'
import type { StringifyTokens, StringifyPort, StringifySearch } from './stringify.ts'

export function join<B extends string, T extends string>(base: B, input: T): Join<B, T> {
  if (input === '' || input === '/') return base as Join<B, T>
  if (base === '') return input as Join<B, T>
  if (base === '/' && input === '/') return '/' as Join<B, T>

  let a = parse(base)
  let b = parse(input)

  let tokens: ParseResult = {
    protocol: undefined,
    hostname: undefined,
    port: undefined,
    pathname: undefined,
    search: undefined,
  }

  // Origin (protocol, hostname, port): input overrides base
  if (b.hostname != null) {
    tokens.protocol = b.protocol
    tokens.hostname = b.hostname
    tokens.port = b.port
  } else if (a.hostname != null) {
    tokens.protocol = a.protocol
    tokens.hostname = a.hostname
    tokens.port = a.port
  }

  tokens.pathname = joinPathnames(a.pathname, b.pathname)
  tokens.search = joinSearchConstraints(a.search, b.search)

  let str = ''

  if (tokens.hostname != null) {
    let protocol = tokens.protocol != null ? stringifyTokens(tokens.protocol) : ''
    let hostname = stringifyTokens(tokens.hostname, '.')
    let port = tokens.port != null ? `:${tokens.port}` : ''
    str += `${protocol}://${hostname}${port}`
  }

  if (tokens.pathname != null) {
    let pathname = stringifyTokens(tokens.pathname, '/')
    if (pathname !== '') {
      // Only add leading slash if base starts with '/' OR there's an origin
      // BUT not if the pathname already starts with a slash (including inside optionals)
      let needsLeadingSlash =
        (base.startsWith('/') || tokens.hostname != null) && !startsWithSeparator(tokens.pathname)
      str += needsLeadingSlash ? `/${pathname}` : pathname
    }
  }

  if (tokens.search != null) {
    let search = stringifySearchConstraints(tokens.search)
    if (search !== '') {
      str += `?${search}`
    }
  }

  return str as Join<B, T>
}

function joinPathnames(a: Token[] | undefined, b: Token[] | undefined): Token[] | undefined {
  if (b == null) return a
  if (a == null || a.length === 0) return b

  let tokens = [...a]

  // Remove trailing separator from base if present
  if (tokens.length > 0 && tokens[tokens.length - 1].type === 'separator') {
    tokens.pop()
  }

  // Check if input starts with a separator (including inside optionals)
  let inputStartsWithSeparator = startsWithSeparator(b)

  // Only add separator between base and input if input doesn't start with one
  if (!inputStartsWithSeparator) {
    tokens.push({ type: 'separator' })
  }

  // Add input pathname
  tokens.push(...b)

  return tokens
}

function startsWithSeparator(tokens: Token[]): boolean {
  if (tokens.length === 0) return false

  let firstToken = tokens[0]
  if (firstToken.type === 'separator') return true

  // Check if it starts with an optional that contains a separator
  if (firstToken.type === 'optional' && firstToken.tokens && firstToken.tokens.length > 0) {
    return startsWithSeparator(firstToken.tokens)
  }

  return false
}

function joinSearchConstraints(
  baseSearch: SearchConstraints | undefined,
  inputSearch: SearchConstraints | undefined,
): SearchConstraints | undefined {
  if (inputSearch == null) return baseSearch
  if (baseSearch == null) return inputSearch

  // Merge the two search constraint maps
  let merged = new Map(baseSearch)

  for (let [key, inputConstraint] of inputSearch.entries()) {
    let baseConstraint = merged.get(key)
    if (baseConstraint == null) {
      merged.set(key, inputConstraint)
    } else {
      // Merge constraints for the same key
      let mergedConstraint = {
        requireAssignment: baseConstraint.requireAssignment || inputConstraint.requireAssignment,
        allowBare: baseConstraint.allowBare && inputConstraint.allowBare,
        requiredValues: undefined as Set<string> | undefined,
      }

      // Merge required values
      if (baseConstraint.requiredValues || inputConstraint.requiredValues) {
        mergedConstraint.requiredValues = new Set([
          ...(baseConstraint.requiredValues || []),
          ...(inputConstraint.requiredValues || []),
        ])
      }

      merged.set(key, mergedConstraint)
    }
  }

  return merged
}

// prettier-ignore
export type Join<A extends string, B extends string> =
  B extends '' ? A :
  A extends '' ? B :
  B extends '/' ? A :
  _Join<Parse<A>, Parse<B>, HasLeadingSlash<A>>

type HasLeadingSlash<T extends string> = T extends `/${string}` ? true : false

// prettier-ignore
type _Join<
  A extends ParsedPattern,
  B extends ParsedPattern,
  LeadingSlash extends boolean
> = JoinStringify<{
  protocol: JoinOriginField<A, B, 'protocol'>
  hostname: JoinOriginField<A, B, 'hostname'>
  port: JoinOriginField<A, B, 'port'>
  pathname: JoinPathnames<A['pathname'], B['pathname']>
  search: JoinSearch<A['search'], B['search']>
}, LeadingSlash>

// prettier-ignore
type JoinOriginField<
  A extends ParsedPattern,
  B extends ParsedPattern,
  Field extends 'protocol' | 'hostname' | 'port'
> = B['hostname'] extends Token[] ? B[Field] : A[Field]

// prettier-ignore
type JoinPathnames<
  A extends Token[] | undefined,
  B extends Token[] | undefined
> = B extends undefined ? A :
    A extends undefined ? B :
    A extends [] ? B :
    A extends Token[] ?
      B extends Token[] ? JoinPathnameTokens<RemoveTrailingSeparator<A>, B> : never :
      never

// prettier-ignore
type RemoveTrailingSeparator<T extends Token[]> =
  T extends [...infer Rest extends Token[], { type: 'separator' }] ? Rest : T

// prettier-ignore
type JoinPathnameTokens<
  Base extends Token[],
  Input extends Token[]
> = StartsWithSeparator<Input> extends true ?
    [...Base, ...Input] :
    [...Base, { type: 'separator' }, ...Input]

// prettier-ignore
type StartsWithSeparator<T extends Token[]> =
  T extends [] ? false :
  T extends [{ type: 'separator' }, ...any] ? true :
  T extends [{ type: 'optional', tokens: infer Tokens extends Token[] }, ...any] ?
    StartsWithSeparator<Tokens> :
    false

// prettier-ignore
type JoinSearch<
  A extends string | undefined,
  B extends string | undefined
> = B extends undefined ? A :
    A extends undefined ? B :
    `${A}&${B}`

// Custom stringify for join that handles leading slash logic correctly
// prettier-ignore
type JoinStringify<T extends ParsedPattern, LeadingSlash extends boolean> =
  T['hostname'] extends Token[] ?
    `${StringifyTokens<T['protocol']>}://${StringifyTokens<T['hostname'], '.'>}${StringifyPort<T['port']>}${JoinStringifyPathname<T['pathname'], true>}${StringifySearch<T['search']>}` :
    T['pathname'] extends Token[] ?
      `${JoinStringifyPathname<T['pathname'], LeadingSlash>}${StringifySearch<T['search']>}` :
      StringifySearch<T['search']>

// Custom pathname stringify that conditionally adds leading slash
// prettier-ignore
type JoinStringifyPathname<T extends Token[] | undefined, NeedsLeadingSlash extends boolean> =
  T extends undefined ? '' :
  T extends Token[] ?
    StringifyTokens<T, '/'> extends infer S extends string ?
      S extends '' ? '' :
      NeedsLeadingSlash extends true ?
        StartsWithSeparator<T> extends true ? S : `/${S}` :
        S :
    never :
  never
