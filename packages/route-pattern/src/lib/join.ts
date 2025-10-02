import type { Parse, ParsedPattern, ParseResult, Separator, Token } from './parse.ts'
import type { SearchConstraints } from './search-constraints.ts'
import { stringify, startsWithSeparator } from './stringify.ts'
import type { Stringify, StartsWithSeparator } from './stringify.ts'

export function join(a: ParseResult, b: ParseResult): string {
  let { protocol, hostname, port } = b.hostname != null ? b : a
  let pathname = joinPathnames(a.pathname, b.pathname)
  let searchConstraints = joinSearchConstraints(a.searchConstraints, b.searchConstraints)

  return stringify({
    protocol,
    hostname,
    port,
    pathname,
    searchConstraints,
  })
}

function joinPathnames(a: Token[] | undefined, b: Token[] | undefined): Token[] | undefined {
  if (b == null || b.length === 0) return a
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

export type Join<A extends string, B extends string> = _Join<Parse<A>, Parse<B>>

type _Join<A extends ParsedPattern, B extends ParsedPattern> = Stringify<{
  protocol: JoinOriginField<A, B, 'protocol'>
  hostname: JoinOriginField<A, B, 'hostname'>
  port: JoinOriginField<A, B, 'port'>
  pathname: JoinPathnames<A['pathname'], B['pathname']>
  search: JoinSearch<A['search'], B['search']>
}>

// prettier-ignore
type JoinOriginField<
  A extends ParsedPattern,
  B extends ParsedPattern,
  Field extends 'protocol' | 'hostname' | 'port'
> = B['hostname'] extends Token[] ? B[Field] : A[Field]

// prettier-ignore
type JoinPathnames<A extends Token[] | undefined, B extends Token[] | undefined> =
  B extends undefined ? A :
  B extends [] ? A :
  A extends undefined ? B :
  A extends [] ? B :
  A extends Token[] ?
    B extends Token[] ? JoinPathnameTokens<RemoveTrailingSeparator<A>, B> :
    never :
  never

// prettier-ignore
type RemoveTrailingSeparator<T extends Token[]> =
  T extends [...infer Rest extends Token[], Separator] ? Rest : T

// prettier-ignore
type JoinPathnameTokens<
  A extends Token[],
  B extends Token[]
> = StartsWithSeparator<B> extends true ?
    [...A, ...B] :
    [...A, Separator, ...B]

// prettier-ignore
type JoinSearch<
  A extends string | undefined,
  B extends string | undefined
> = B extends undefined ? A :
    A extends undefined ? B :
    `${A}&${B}`
