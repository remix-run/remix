import { split } from './route-pattern/split.ts'
import * as Pathname from './route-pattern/pathname.ts'
import * as Search from './route-pattern/search.ts'
import { PartPattern } from './part-pattern.ts'
import { HrefError } from './errors.ts'
import type { Join, HrefArgs, Params } from './types/index.ts'

type AST = {
  protocol: PartPattern | null
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
        protocol: parseOriginPart(source, { span: spans.protocol, type: 'protocol' }),
        hostname: parseOriginPart(source, { span: spans.hostname, type: 'hostname' }),
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
    return this.ast.protocol?.toString() ?? ''
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
      // protocol
      let protocol =
        this.ast.protocol === null ? 'https' : hrefOrThrow(this.ast.protocol, params, this)

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
      // protocol: null matches any protocol (http or https)
      if (this.ast.protocol !== null) {
        let protocol = this.ast.protocol.match(url.protocol.slice(0, -1))
        if (protocol === null) return null
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

function parseOriginPart(
  source: string,
  options: { span: [number, number] | null; type: 'protocol' | 'hostname' },
): PartPattern | null {
  if (!options.span) return null
  let part = PartPattern.parse(source, {
    span: options.span,
    type: options.type,
    ignoreCase: false,
  })
  if (isNamelessWildcard(part)) return null
  return part
}

function isNamelessWildcard(part: PartPattern): boolean {
  if (part.tokens.length !== 1) return false
  let token = part.tokens[0]
  if (token.type !== '*') return false
  let name = part.paramNames[token.nameIndex]
  return name === '*'
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
