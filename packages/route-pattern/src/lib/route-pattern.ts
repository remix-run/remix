import type { Params } from './params.ts'
import type { Optional, TokenList, SearchConstraints } from './parse.ts'
import { parse, parseSearch, parseSearchConstraints } from './parse.ts'

export interface RoutePatternOptions {
  /**
   * Whether to ignore case when matching URL pathnames.
   */
  ignoreCase?: boolean
}

/**
 * A pattern for matching URLs.
 */
export class RoutePattern<T extends string> {
  /**
   * The source string that was used to create this pattern.
   */
  readonly source: T
  /**
   * Whether to ignore case when matching URL pathnames.
   */
  readonly ignoreCase: boolean

  readonly #matcher: RegExp
  readonly #matchOrigin: boolean
  readonly #paramNames: Array<string>
  readonly #searchConstraints: SearchConstraints | null

  constructor(source: T | RoutePattern<T>, options?: RoutePatternOptions) {
    this.source = typeof source === 'string' ? source : source.source
    this.ignoreCase = options?.ignoreCase === true

    let { protocol, hostname, port, pathname, search } = parse(this.source)

    this.#matchOrigin = protocol !== undefined || hostname !== undefined || port !== undefined
    this.#paramNames = []

    if (this.#matchOrigin) {
      let protocolSource = protocol
        ? tokensToRegExpSource(protocol, /.*/, this.#paramNames, true)
        : `[^:]+`
      let hostnameSource = hostname
        ? tokensToRegExpSource(hostname, /[^.]+?/, this.#paramNames, true)
        : `[^/:]+`
      let portSource = port !== undefined ? `:${regexpEscape(port)}` : `(?::[0-9]+)?`
      let pathnameSource = pathname
        ? tokensToRegExpSource(pathname, /[^/]+?/, this.#paramNames, this.ignoreCase)
        : ''

      this.#matcher = new RegExp(
        `^${protocolSource}://${hostnameSource}${portSource}/${pathnameSource}$`,
      )
    } else {
      let pathnameSource = pathname
        ? tokensToRegExpSource(pathname, /[^/]+?/, this.#paramNames, this.ignoreCase)
        : ''

      this.#matcher = new RegExp(`^/${pathnameSource}$`)
    }

    if (search) {
      this.#searchConstraints = parseSearchConstraints(search)
    } else {
      this.#searchConstraints = null
    }
  }

  /**
   * Match a URL against this pattern.
   *
   * @param url The URL to match
   * @returns The parameters if the URL matches this pattern, `null` otherwise
   */
  match(url: URL | string): RouteMatch<T> | null {
    if (typeof url === 'string') url = new URL(url)

    let pathname = this.ignoreCase ? url.pathname.toLowerCase() : url.pathname
    let match = this.#matcher.exec(
      this.#matchOrigin
        ? `${url.protocol.slice(0, -1)}://${url.hostname}${url.port ? `:${url.port}` : ''}${pathname}`
        : pathname,
    )
    if (match === null) return null

    // Map positional capture groups to parameter names in source order
    let params = {} as any
    for (let i = 0; i < this.#paramNames.length; i++) {
      let paramName = this.#paramNames[i]
      params[paramName] = match[i + 1]
    }

    if (this.#searchConstraints && !matchSearch(url.search, this.#searchConstraints)) {
      return null
    }

    return { url, params }
  }

  /**
   * Test if a URL matches this pattern.
   *
   * @param url The URL to test
   * @returns `true` if the URL matches this pattern, `false` otherwise
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

function tokensToRegExpSource(
  tokens: TokenList,
  paramRegExp: RegExp,
  paramNames: string[],
  forceLowerCase: boolean,
) {
  let source: string = tokens
    .map((token) => {
      if (token.type === 'variable') {
        paramNames.push(token.name)
        return `(${paramRegExp.source})`
      }
      if (token.type === 'wildcard') {
        if (!token.name) return `(?:.*)`
        paramNames.push(token.name)
        return `(.*)`
      }
      if (token.type === 'enum') {
        return `(?:${token.members.map((member) => regexpEscape(forceLowerCase ? member.toLowerCase() : member)).join('|')})`
      }
      if (token.type === 'text') {
        return regexpEscape(forceLowerCase ? token.value.toLowerCase() : token.value)
      }

      token satisfies Optional

      // token.type === 'optional'
      return `(?:${tokensToRegExpSource(token.tokens, paramRegExp, paramNames, forceLowerCase)})?`
    })
    .join('')

  return source
}

function regexpEscape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function matchSearch(search: string, constraints: SearchConstraints): boolean {
  let { namesWithoutAssignment, namesWithAssignment, valuesByKey } = parseSearch(search)

  for (let [key, constraint] of constraints) {
    let hasAssigned = namesWithAssignment.has(key)
    let hasBare = namesWithoutAssignment.has(key)
    let values = valuesByKey.get(key)

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
