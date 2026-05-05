import type { PartPattern, PartPatternToken, RoutePattern } from './route-pattern.ts'
import type { Join } from './types/join.ts'

/**
 * Join two route patterns.
 *
 * Origin parts (`protocol`, `hostname`, `port`) from `b` override `a` when present.
 * Pathnames are concatenated with a separator inserted between them as needed.
 * Search constraints from both patterns are merged.
 *
 * The result carries `Join<a, b>` as its source brand so downstream APIs
 * (e.g. `toHref`) infer typed params from the joined pattern.
 */
export function joinPatterns<a extends string, b extends string>(
  a: RoutePattern<a>,
  b: RoutePattern<b>,
): RoutePattern<Join<a, b>> {
  return {
    protocol: b.protocol ?? a.protocol,
    hostname: b.hostname ?? a.hostname,
    port: b.port ?? a.port,
    pathname: joinPathname(a.pathname, b.pathname),
    search: joinSearch(a.search, b.search),
  }
}

/**
 * Join two pathname parts, inserting a separator between them as needed.
 *
 * Trailing separator is stripped from `a`; leading separator is added to `b` if absent.
 *
 * ```text
 * 'a'   + 'b'   -> 'a/b'
 * 'a/'  + 'b'   -> 'a/b'
 * 'a'   + '/b'  -> 'a/b'
 * 'a/'  + '/b'  -> 'a/b'
 * '(a)' + '(b)' -> '(a)/(b)'
 * '(a/)'+ '(b)' -> '(a)/(b)'
 * '(a)' +'(/b)' -> '(a)(/b)'
 * '(a/)'+'(/b)' -> '(a)(/b)'
 * ```
 */
function joinPathname(a: PartPattern, b: PartPattern): PartPattern {
  if (a.tokens.length === 0) return b
  if (b.tokens.length === 0) return a

  let tokens: Array<PartPatternToken> = []

  // strip `a`'s trailing separator (only optionals after it)
  let aLastNonOptionalIndex = a.tokens.findLastIndex(
    (token) => token.type !== '(' && token.type !== ')',
  )
  let aLastNonOptional = a.tokens[aLastNonOptionalIndex]
  let aHasTrailingSeparator = aLastNonOptional?.type === 'separator'

  a.tokens.forEach((token, index) => {
    if (index === aLastNonOptionalIndex && token.type === 'separator') return
    tokens.push(token)
  })

  // add separator if `b` has no leading one (only optionals before it)
  let bFirstNonOptional = b.tokens.find((token) => token.type !== '(' && token.type !== ')')
  let needsSeparator = bFirstNonOptional === undefined || bFirstNonOptional.type !== 'separator'
  if (needsSeparator) tokens.push({ type: 'separator' })

  let tokenOffset = tokens.length
  b.tokens.forEach((token) => tokens.push(token))

  let optionals = new Map<number, number>()
  for (let [begin, end] of a.optionals) {
    if (aHasTrailingSeparator) {
      // one less token before this optional since trailing slash token was omitted
      if (begin > aLastNonOptionalIndex) begin -= 1
      if (end > aLastNonOptionalIndex) end -= 1
    }
    optionals.set(begin, end)
  }
  for (let [begin, end] of b.optionals) {
    optionals.set(tokenOffset + begin, tokenOffset + end)
  }

  return { tokens, optionals, type: 'pathname' }
}

/**
 * Merge two search constraint maps.
 *
 * ```text
 * '?a'   + '?b'   -> '?a&b'
 * '?a=1' + '?a=2' -> '?a=1&a=2'
 * '?a=1' + '?b=2' -> '?a=1&b=2'
 * ''     + '?a'   -> '?a'
 * ```
 */
function joinSearch(a: RoutePattern['search'], b: RoutePattern['search']): RoutePattern['search'] {
  let result = new Map<string, Set<string>>()

  for (let [name, values] of a) {
    result.set(name, new Set(values))
  }

  for (let [name, values] of b) {
    let current = result.get(name)
    if (current === undefined) {
      result.set(name, new Set(values))
      continue
    }
    for (let value of values) {
      current.add(value)
    }
  }

  return result
}
