import type { Params } from './params.ts'
import type { Part } from './parse.types.ts'
import { parse } from './parse.ts'

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
  readonly #requiredSearchParams: Map<string, Set<string>> | null

  constructor(source: T | RoutePattern<T>, options?: RoutePatternOptions) {
    this.source = typeof source === 'string' ? source : source.source
    this.ignoreCase = options?.ignoreCase === true

    let { protocol, hostname, port, pathname, searchParams } = parse(this.source)

    this.#matchOrigin = protocol !== undefined || hostname !== undefined || port !== undefined
    this.#paramNames = []

    if (this.#matchOrigin) {
      let protocolSource = protocol
        ? partToRegExpSource(protocol, /.*/, this.#paramNames, true)
        : `[^:]+`
      let hostnameSource = hostname
        ? partToRegExpSource(hostname, /[^.]+/, this.#paramNames, true)
        : `[^/:]+`
      let portSource = port !== undefined ? `:${regexpEscape(port)}` : `(?::[0-9]+)?`
      let pathnameSource = pathname
        ? partToRegExpSource(pathname, /[^/]+/, this.#paramNames, this.ignoreCase)
        : ''

      this.#matcher = new RegExp(
        `^${protocolSource}://${hostnameSource}${portSource}/${pathnameSource}$`,
      )
    } else {
      let pathnameSource = pathname
        ? partToRegExpSource(pathname, /[^/]+/, this.#paramNames, this.ignoreCase)
        : ''

      this.#matcher = new RegExp(`^/${pathnameSource}$`)
    }

    if (searchParams) {
      let required = new Map<string, Set<string>>()
      for (let [key, value] of searchParams.entries()) {
        let set = required.get(key)
        if (!set) {
          set = new Set<string>()
          required.set(key, set)
        }
        set.add(value)
      }
      this.#requiredSearchParams = required
    } else {
      this.#requiredSearchParams = null
    }
  }

  /**
   * Match a URL against this pattern.
   *
   * @param url The URL to match
   * @returns The parameters if the URL matches this pattern, `null` otherwise
   */
  match(url: URL | string): Match<T> | null {
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

    if (this.#requiredSearchParams) {
      // Build an index of the URL's query once for O(1) membership checks
      let valuesByKey = new Map<string, Set<string>>()
      for (let [k, v] of url.searchParams) {
        let set = valuesByKey.get(k)
        if (!set) {
          set = new Set<string>()
          valuesByKey.set(k, set)
        }
        set.add(v)
      }

      for (let [key, requiredValues] of this.#requiredSearchParams) {
        let set = valuesByKey.get(key)
        if (!set) return null
        for (let value of requiredValues) {
          if (!set.has(value)) return null
        }
      }
    }

    return {
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port,
      pathname: url.pathname,
      searchParams: url.searchParams,
      params,
    }
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

export interface Match<T extends string> {
  /**
   * The protocol of the URL that was matched.
   */
  protocol: string
  /**
   * The hostname of the URL that was matched.
   */
  hostname: string
  /**
   * The port of the URL that was matched.
   */
  port: string
  /**
   * The pathname of the URL that was matched.
   */
  pathname: string
  /**
   * The params that were extracted from the URL's search/query string.
   */
  searchParams: URLSearchParams
  /**
   * The parameters that were extracted from the URL protocol, hostname, and/or pathname.
   */
  params: Params<T>
}

function partToRegExpSource(
  part: Part,
  paramRegExp: RegExp,
  paramNames: string[],
  forceLowerCase: boolean,
) {
  let source: string = part
    .map((node) => {
      if (node.type === 'variable') {
        paramNames.push(node.name)
        return `(${paramRegExp.source})`
      }
      if (node.type === 'wildcard') {
        if (!node.name) return `(?:.*)`
        paramNames.push(node.name)
        return `(.*)`
      }
      if (node.type === 'enum') {
        return `(?:${node.members.map((member) => regexpEscape(forceLowerCase ? member.toLowerCase() : member)).join('|')})`
      }
      if (node.type === 'text') {
        return regexpEscape(forceLowerCase ? node.value.toLowerCase() : node.value)
      }
      if (node.type === 'optional') {
        return `(?:${partToRegExpSource(node.nodes, paramRegExp, paramNames, forceLowerCase)})?`
      }

      throw new Error(`Node with unknown type: ${node}`)
    })
    .join('')

  return source
}

function regexpEscape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
