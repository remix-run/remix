import type { Ast } from './parse.ts'
import type { Part } from './parse.types.ts'
import { parse } from './parse.ts'

type Params = Record<string, string | undefined>
type Match = { params: Params }

/**
 * A pattern for matching URLs.
 */
export class RoutePattern {
  /**
   * The source string that was used to create this pattern.
   */
  readonly source: string

  readonly #ast: Ast
  readonly #protocolMatcher: RegExp
  readonly #hostnameMatcher: RegExp
  readonly #pathnameMatcher: RegExp

  constructor(source: string | RoutePattern) {
    this.source = typeof source === 'string' ? source : source.source
    this.#ast = parse(this.source)
    this.#protocolMatcher = partToRegExp(this.#ast.protocol, { param: /.*/ }) ?? /^.*$/
    this.#hostnameMatcher = partToRegExp(this.#ast.hostname, { param: /[^.]+/ }) ?? /^.*$/
    this.#pathnameMatcher = partToRegExp(this.#ast.pathname, { param: /[^/]+/ }) ?? /^$/
  }

  /**
   * Match a URL against this pattern.
   *
   * @param url The URL to match
   * @returns The parameters if the URL matches this pattern, `null` otherwise
   */
  match(url: URL | string): Match | null {
    if (typeof url === 'string') url = new URL(url)

    let params: Params = {}

    let protocolMatch = this.#protocolMatcher.exec(url.protocol.slice(0, -1))
    if (protocolMatch === null) return null
    if (protocolMatch.groups) {
      Object.assign(params, protocolMatch.groups)
    }

    let hostnameMatch = this.#hostnameMatcher.exec(url.hostname)
    if (hostnameMatch === null) return null
    if (hostnameMatch.groups) {
      Object.assign(params, hostnameMatch.groups)
    }

    if (this.#ast.port !== undefined) {
      if (url.port !== this.#ast.port) return null
    }

    let pathnameMatch = this.#pathnameMatcher.exec(url.pathname.slice(1))
    if (pathnameMatch === null) return null
    if (pathnameMatch.groups) {
      Object.assign(params, pathnameMatch.groups)
    }

    if (this.#ast.search) {
      for (let [key, value] of this.#ast.search?.entries()) {
        if (!url.searchParams.getAll(key).includes(value)) return null
      }
    }

    return { params }
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

function partToRegExp(part: Part | undefined, options: { param: RegExp }) {
  if (part === undefined) return undefined
  let source = partToRegExpSource(part, options.param)
  return new RegExp('^' + source + '$')
}

function partToRegExpSource(part: Part, paramRegExp: RegExp) {
  let source: string = part
    .map((node) => {
      if (node.type === 'variable') {
        return `(?<${node.name}>${paramRegExp.source})`
      }
      if (node.type === 'wildcard') {
        return `(?<${node.name}>.*)`
      }
      if (node.type === 'enum') {
        return `(?:${node.members.map(regexpEscape).join('|')})`
      }
      if (node.type === 'text') {
        return regexpEscape(node.value)
      }
      if (node.type === 'optional') {
        return `(?:${partToRegExpSource(node.nodes, paramRegExp)})?`
      }

      throw new Error(`Node with unknown type: ${node}`)
    })
    .join('')

  return source
}

function regexpEscape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
