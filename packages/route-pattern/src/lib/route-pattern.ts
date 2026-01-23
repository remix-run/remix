import { split } from './route-pattern/split.ts'
import * as Pathname from './route-pattern/pathname.ts'
import * as Search from './route-pattern/search.ts'
import * as Protocol from './route-pattern/protocol.ts'
import * as Hostname from './route-pattern/hostname.ts'
import { PartPattern } from './part-pattern.ts'
import { HrefError } from './errors.ts'
import type { Join, HrefArgs, Params } from './types/index.ts'

type AST = {
  protocol: 'http' | 'https' | 'http(s)' | null
  hostname: PartPattern | null
  port: string | null
  pathname: PartPattern
  search: Search.Constraints
}

export namespace RoutePattern {
  export type Options = {
    ignoreCase?: boolean
  }

  export type Match<source extends string = string> = {
    pattern: RoutePattern
    url: URL
    params: Params<source>
    meta: {
      hostname: PartPattern.Match
      pathname: PartPattern.Match
    }
  }
}
type Match<source extends string> = RoutePattern.Match<source>

export class RoutePattern<source extends string = string> {
  readonly ast: AST
  readonly ignoreCase: boolean

  readonly #hasOrigin: boolean

  private constructor(ast: AST, options: { ignoreCase: boolean }) {
    this.ast = ast
    this.ignoreCase = options.ignoreCase
    this.#hasOrigin = ast.protocol !== null || ast.hostname !== null || ast.port !== null
  }

  static parse<source extends string>(
    source: source,
    options?: RoutePattern.Options,
  ): RoutePattern<source> {
    let ignoreCase = options?.ignoreCase ?? false
    let spans = split(source)

    return new RoutePattern(
      {
        protocol: Protocol.parse(source, spans.protocol),
        hostname: Hostname.parse(source, spans.hostname),
        port: spans.port ? source.slice(...spans.port) : null,
        pathname: spans.pathname
          ? PartPattern.parse(source, { span: spans.pathname, type: 'pathname', ignoreCase })
          : PartPattern.parse('', { span: [0, 0], type: 'pathname', ignoreCase }),
        search: spans.search ? Search.parse(source.slice(...spans.search)) : new Map(),
      },
      { ignoreCase },
    )
  }

  get protocol(): string {
    return this.ast.protocol ?? ''
  }

  get hostname(): string {
    return this.ast.hostname?.toString() ?? ''
  }

  get port(): string {
    return this.ast.port ?? ''
  }

  get pathname(): string {
    return this.ast.pathname.toString()
  }

  get search(): string {
    return Search.toString(this.ast.search) ?? ''
  }

  get source(): string {
    let result = ''

    if (this.#hasOrigin) {
      let protocol = this.protocol
      let hostname = this.hostname
      let port = this.port === '' ? '' : `:${this.port}`
      result += `${protocol}://${hostname}${port}`
    }

    result += '/' + this.pathname

    let search = this.search
    if (search) result += `?${search}`

    return result
  }

  toString(): string {
    return this.source
  }

  join<other extends string>(
    other: other | RoutePattern<other>,
    options?: RoutePattern.Options,
  ): RoutePattern<Join<source, other>> {
    other = typeof other === 'string' ? RoutePattern.parse(other) : other
    let ignoreCase = options?.ignoreCase ?? (this.ignoreCase || other.ignoreCase)

    return new RoutePattern(
      {
        protocol: other.ast.protocol ?? this.ast.protocol,
        hostname: other.ast.hostname ?? this.ast.hostname,
        port: other.ast.port ?? this.ast.port,
        pathname: Pathname.join(this.ast.pathname, other.ast.pathname, ignoreCase),
        search: Search.join(this.ast.search, other.ast.search),
      },
      { ignoreCase },
    )
  }

  href(...args: HrefArgs<source>): string {
    let [params, searchParams] = args
    params ??= {}
    searchParams ??= {}

    let result = ''

    if (this.#hasOrigin) {
      // protocol: null defaults to 'https', 'http(s)' defaults to 'https'
      let protocol =
        this.ast.protocol === null || this.ast.protocol === 'http(s)' ? 'https' : this.ast.protocol

      // hostname
      if (this.ast.hostname === null) {
        throw new HrefError({
          type: 'missing-hostname',
          pattern: this,
        })
      }
      let hostname = hrefOrThrow(this.ast.hostname, params, this)

      // port
      let port = this.ast.port === null ? '' : `:${this.ast.port}`
      result += `${protocol}://${hostname}${port}`
    }

    // pathname
    let pathname = hrefOrThrow(this.ast.pathname, params, this)
    result += '/' + pathname

    // search
    let search = Search.href(this, searchParams)
    if (search) result += `?${search}`

    return result
  }

  match(url: string | URL): Match<source> | null {
    url = typeof url === 'string' ? new URL(url) : url

    let hostname: PartPattern.Match | null = null
    if (this.#hasOrigin) {
      // protocol: null matches http or https, 'http(s)' matches http or https
      if (this.ast.protocol === 'http(s)') {
        if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
      } else if (this.ast.protocol !== null) {
        let expectedProtocol = `${this.ast.protocol}:`
        if (url.protocol !== expectedProtocol) return null
      }

      // hostname: null matches any hostname
      if (this.ast.hostname !== null) {
        hostname = this.ast.hostname.match(url.hostname)
        if (hostname === null) return null
      }

      // port: null matches any port
      if (this.ast.port !== null) {
        if ((url.port || null) !== this.ast.port) return null
      }
    }

    // url.pathname: remove leading slash
    let pathname = this.ast.pathname.match(url.pathname.slice(1))
    if (pathname === null) return null

    if (!Search.test(url.searchParams, this.ast.search, this.ignoreCase)) return null

    let params: Record<string, string | undefined> = {}

    // hostname params
    this.ast.hostname?.paramNames.forEach((name) => {
      if (name === '*') return
      params[name] = undefined
    })
    hostname?.forEach((param) => {
      if (param.name === '*') return
      params[param.name] = param.value
    })

    // pathname params
    this.ast.pathname.paramNames.forEach((name) => {
      if (name === '*') return
      params[name] = undefined
    })
    pathname.forEach((param) => {
      if (param.name === '*') return
      params[param.name] = param.value
    })

    return {
      pattern: this,
      url,
      params: params as Params<source>,
      meta: { hostname: hostname ?? [], pathname },
    }
  }

  test(url: string | URL): boolean {
    return this.match(url) !== null
  }
}

function hrefOrThrow(
  part: PartPattern,
  params: Record<string, string | number>,
  pattern: RoutePattern,
): string {
  let result = part.href(params)
  if (result === null) {
    throw new HrefError({
      type: 'missing-params',
      pattern,
      partPattern: part,
      params,
    })
  }
  return result
}
