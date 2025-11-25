import { formatHref, type HrefBuilderArgs } from './href.ts'
import { join, type Join } from './join.ts'
import type { Params } from './params.ts'
import { parse, type Token, type ParseResult } from './parse.ts'
import { parseSearch, type SearchConstraints } from './search-constraints.ts'

export interface RoutePatternOptions {
  /**
   * Whether to ignore case when matching URL pathnames.
   */
  ignoreCase?: boolean
}

/**
 * A pattern for matching URLs.
 */
export class RoutePattern<T extends string = string> {
  /**
   * The source string that was used to create this pattern.
   */
  readonly source: T
  /**
   * Whether to ignore case when matching URL pathnames.
   */
  readonly ignoreCase: boolean

  #parsed: ParseResult
  #compiled: CompileResult | undefined

  /**
   * @param source The source pattern string or another `RoutePattern` to copy
   * @param options Options for the pattern
   */
  constructor(source: T | RoutePattern<T>, options?: RoutePatternOptions) {
    this.source = typeof source === 'string' ? source : source.source
    this.ignoreCase = options?.ignoreCase === true
    this.#parsed = parse(this.source)
  }

  /**
   * Generate a href (URL) for this pattern.
   *
   * @param args The parameters and optional search params
   * @return The href
   */
  href(...args: HrefBuilderArgs<T>): string {
    return formatHref(this.#parsed, ...(args as any))
  }

  /**
   * Join this pattern with another pattern. This is useful when building a pattern relative to a
   * base pattern.
   *
   * Note: The returned pattern will use the same options as this pattern.
   *
   * @param input The pattern to join with
   * @return The joined pattern
   */
  join<P extends string>(input: P | RoutePattern<P>): RoutePattern<Join<T, P>> {
    let parsedInput = parse(typeof input === 'string' ? input : input.source)
    return new RoutePattern(join(this.#parsed, parsedInput) as Join<T, P>, {
      ignoreCase: this.ignoreCase,
    })
  }

  /**
   * Match a URL against this pattern.
   *
   * @param url The URL to match
   * @return The match result, or `null` if the URL doesn't match
   */
  match(url: URL | string): RouteMatch<T> | null {
    if (typeof url === 'string') url = new URL(url)

    let { matchOrigin, matcher, paramNames } = this.#compile()

    let pathname = this.ignoreCase ? url.pathname.toLowerCase() : url.pathname
    let match = matcher.exec(matchOrigin ? `${url.origin}${pathname}` : pathname)
    if (match === null) return null

    // Map positional capture groups to parameter names in source order
    let params = {} as any
    for (let i = 0; i < paramNames.length; i++) {
      let paramName = paramNames[i]
      params[paramName] = match[i + 1]
    }

    if (
      this.#parsed.searchConstraints != null &&
      !matchSearch(url.search, this.#parsed.searchConstraints)
    ) {
      return null
    }

    return { url, params }
  }

  #compile(): CompileResult {
    if (this.#compiled) return this.#compiled
    this.#compiled = compilePattern(this.#parsed, this.ignoreCase)
    return this.#compiled
  }

  /**
   * Test if a URL matches this pattern.
   *
   * @param url The URL to test
   * @return `true` if the URL matches this pattern, `false` otherwise
   */
  test(url: URL | string): boolean {
    return this.match(url) !== null
  }

  toString() {
    return this.source
  }
}

export interface RouteMatch<T extends string> {
  /**
   * The parameters that were extracted from the URL protocol, hostname, and/or pathname.
   */
  readonly params: Params<T>
  /**
   * The URL that was matched.
   */
  readonly url: URL
}

interface CompileResult {
  matchOrigin: boolean
  matcher: RegExp
  paramNames: string[]
}

function compilePattern(parsed: ParseResult, ignoreCase: boolean): CompileResult {
  let { protocol, hostname, port, pathname } = parsed

  let matchOrigin = hostname !== undefined
  let matcher: RegExp
  let paramNames: string[] = []

  if (matchOrigin) {
    let protocolSource = protocol
      ? tokensToRegExpSource(protocol, '', '.*', paramNames, true)
      : '[^:]+'
    let hostnameSource = hostname
      ? tokensToRegExpSource(hostname, '.', '[^.]+?', paramNames, true)
      : '[^/:]+'
    let portSource = port !== undefined ? `:${regexpEscape(port)}` : '(?::[0-9]+)?'
    let pathnameSource = pathname
      ? tokensToRegExpSource(pathname, '/', '[^/]+?', paramNames, ignoreCase)
      : ''

    matcher = new RegExp(`^${protocolSource}://${hostnameSource}${portSource}/${pathnameSource}$`)
  } else {
    let pathnameSource = pathname
      ? tokensToRegExpSource(pathname, '/', '[^/]+?', paramNames, ignoreCase)
      : ''

    matcher = new RegExp(`^/${pathnameSource}$`)
  }

  return { matchOrigin, matcher, paramNames }
}

function tokensToRegExpSource(
  tokens: Token[],
  sep: string,
  paramRegExpSource: string,
  paramNames: string[],
  forceLowerCase: boolean,
): string {
  let source = ''

  for (let token of tokens) {
    if (token.type === 'variable') {
      paramNames.push(token.name)
      source += `(${paramRegExpSource})`
    } else if (token.type === 'wildcard') {
      if (token.name) {
        paramNames.push(token.name)
        source += `(.*)`
      } else {
        source += `(?:.*)`
      }
    } else if (token.type === 'text') {
      source += regexpEscape(forceLowerCase ? token.value.toLowerCase() : token.value)
    } else if (token.type === 'separator') {
      source += regexpEscape(sep)
    } else if (token.type === 'optional') {
      source += `(?:${tokensToRegExpSource(token.tokens, sep, paramRegExpSource, paramNames, forceLowerCase)})?`
    }
  }

  return source
}

function regexpEscape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function matchSearch(search: string, constraints: SearchConstraints): boolean {
  let { namesWithoutAssignment, namesWithAssignment, valuesByKey } = parseSearch(search)

  for (let [key, constraint] of constraints) {
    let hasAssigned = namesWithAssignment.has(key),
      hasBare = namesWithoutAssignment.has(key),
      values = valuesByKey.get(key)

    if (constraint.requiredValues && constraint.requiredValues.size > 0) {
      if (!values) return false
      for (let value of constraint.requiredValues) {
        if (!values.has(value)) return false
      }
      continue
    }

    if (constraint.requireAssignment) {
      if (!hasAssigned) return false
      continue
    }

    if (!(hasAssigned || hasBare)) return false
  }

  return true
}
