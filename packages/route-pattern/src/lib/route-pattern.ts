import type { Params } from './params.ts'
import type { Ast, Part } from './parse.types.ts'
import { parse } from './parse.ts'

/**
 * A pattern for matching URLs.
 */
export class RoutePattern<T extends string> {
  /**
   * The source string that was used to create this pattern.
   */
  readonly source: T

  readonly #ast: Ast
  readonly #matcher: RegExp
  readonly #hasHost: boolean
  readonly #paramNames: Array<string>

  constructor(source: T | RoutePattern<T>) {
    this.source = typeof source === 'string' ? source : source.source
    this.#ast = parse(this.source)
    this.#hasHost =
      this.#ast.hostname !== undefined ||
      this.#ast.protocol !== undefined ||
      this.#ast.port !== undefined
    this.#paramNames = []

    if (this.#hasHost) {
      let protocolSource = this.#ast.protocol
        ? partToRegExpSource(this.#ast.protocol, /.*/, this.#paramNames)
        : `[^:]+`

      let hostnameSource = this.#ast.hostname
        ? partToRegExpSource(this.#ast.hostname, /[^.]+/, this.#paramNames)
        : `[^/:]+`

      let portSource =
        this.#ast.port !== undefined ? `:${regexpEscape(this.#ast.port)}` : `(?::[0-9]+)?`

      let pathnameSource = this.#ast.pathname
        ? partToRegExpSource(this.#ast.pathname, /[^/]+/, this.#paramNames)
        : ''

      this.#matcher = new RegExp(
        `^${protocolSource}://${hostnameSource}${portSource}/${pathnameSource}$`,
      )
    } else {
      let pathnameSource = this.#ast.pathname
        ? partToRegExpSource(this.#ast.pathname, /[^/]+/, this.#paramNames)
        : ''

      this.#matcher = new RegExp(`^${pathnameSource}$`)
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

    let match = this.#matcher.exec(
      this.#hasHost
        ? `${url.protocol.slice(0, -1)}://${url.hostname}${url.port ? `:${url.port}` : ''}/${url.pathname.slice(1)}`
        : url.pathname.slice(1),
    )
    if (match === null) return null

    // Map positional capture groups to parameter names in source order
    let params = {} as any
    for (let i = 0; i < this.#paramNames.length; i++) {
      let value = match[i + 1]
      let paramName = this.#paramNames[i]
      params[paramName] = value
    }

    if (this.#ast.searchParams) {
      for (let [key, value] of this.#ast.searchParams.entries()) {
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

export interface Match<T extends string> {
  params: Params<T>
}

function partToRegExpSource(part: Part, paramRegExp: RegExp, paramNames: string[]) {
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
        return `(?:${node.members.map(regexpEscape).join('|')})`
      }
      if (node.type === 'text') {
        return regexpEscape(node.value)
      }
      if (node.type === 'optional') {
        return `(?:${partToRegExpSource(node.nodes, paramRegExp, paramNames)})?`
      }

      throw new Error(`Node with unknown type: ${node}`)
    })
    .join('')

  return source
}

function regexpEscape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
