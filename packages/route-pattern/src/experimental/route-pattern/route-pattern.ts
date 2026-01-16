import { split } from './split.ts'
import * as Pathname from './pathname.ts'
import * as Search from './search.ts'
import { PartPattern } from '../part-pattern.ts'
import { HrefError } from '../errors.ts'

type AST = {
  protocol: PartPattern
  hostname: PartPattern
  port: string | null
  pathname: PartPattern
  search: Search.Constraints
}

export namespace RoutePattern {
  export type Match = {
    params: Record<string, string | undefined>
    searchParams: URLSearchParams
    meta: {
      hostname: PartPattern.Match
      pathname: PartPattern.Match
    }
  }
}
type Match = RoutePattern.Match

export class RoutePattern {
  readonly ast: AST

  private constructor(ast: AST) {
    this.ast = ast
  }

  static parse(source: string): RoutePattern {
    let spans = split(source)

    return new RoutePattern({
      protocol: spans.protocol
        ? PartPattern.parse(source, { span: spans.protocol })
        : PartPattern.parse('*', { span: [0, 1] }),
      hostname: spans.hostname
        ? PartPattern.parse(source, { span: spans.hostname, separator: '.' })
        : PartPattern.parse('*', { span: [0, 1] }),
      port: spans.port ? source.slice(...spans.port) : null,
      pathname: spans.pathname
        ? PartPattern.parse(source, { span: spans.pathname, separator: '/' })
        : PartPattern.parse('', { span: [0, 0] }),
      search: spans.search ? Search.parse(source.slice(...spans.search)) : new Map(),
    })
  }

  get protocol(): string {
    return this.ast.protocol.toString()
  }

  get hostname(): string {
    return this.ast.hostname.toString()
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

  toString(): string {
    let port = this.port === '' ? '' : `:${this.port}`

    let result = `${this.protocol}://${this.hostname}${port}/${this.pathname}`

    let search = this.search
    if (search) result += `?${search}`

    return result
  }

  join(other: RoutePattern): RoutePattern {
    return new RoutePattern({
      protocol: isNamelessWildcard(other.ast.protocol) ? this.ast.protocol : other.ast.protocol,
      hostname: isNamelessWildcard(other.ast.hostname) ? this.ast.hostname : other.ast.hostname,
      port: other.ast.port ?? this.ast.port,
      pathname: Pathname.join(this.ast.pathname, other.ast.pathname),
      search: Search.join(this.ast.search, other.ast.search),
    })
  }

  href(params?: Record<string, string | number>, searchParams?: Search.HrefParams): string {
    params ??= {}
    searchParams ??= {}

    let isDefaultProtocol = isNamelessWildcard(this.ast.protocol)
    let isDefaultHostname = isNamelessWildcard(this.ast.hostname)
    let isDefaultPort = this.ast.port === null

    let result = ''

    let needsOrigin = !isDefaultProtocol || !isDefaultHostname || !isDefaultPort
    if (needsOrigin) {
      // protocol
      let protocol = isDefaultProtocol ? 'https' : hrefOrThrow(this, 'protocol', params)

      // hostname
      if (isDefaultHostname) {
        throw new HrefError({
          type: 'missing-hostname',
          pattern: this,
        })
      }
      let hostname = hrefOrThrow(this, 'hostname', params)

      // port
      let port = isDefaultPort ? '' : `:${this.ast.port}`
      result += `${protocol}://${hostname}${port}`
    }

    // pathname
    let pathname = hrefOrThrow(this, 'pathname', params)
    result += '/' + pathname

    // search
    let search = Search.href(this, searchParams)
    if (search) result += `?${search}`

    return result
  }

  match(url: string | URL): Match | null {
    url = typeof url === 'string' ? new URL(url) : url

    // url.protocol: remove trailing colon
    let protocol = this.ast.protocol.match(url.protocol.slice(0, -1))
    if (protocol === null) return null

    let hostname = this.ast.hostname.match(url.hostname)
    if (hostname === null) return null

    // url.port: '' means no port
    if ((url.port || null) !== this.ast.port) return null

    // url.pathname: remove leading slash
    let pathname = this.ast.pathname.match(url.pathname.slice(1))
    if (pathname === null) return null

    if (!Search.test(url.searchParams, this.ast.search)) return null

    let params: Record<string, string | undefined> = {}

    // hostname params
    this.ast.hostname.paramNames.forEach((name) => {
      if (name === '*') return
      params[name] = undefined
    })
    hostname.forEach((param) => {
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

    return { params, searchParams: url.searchParams, meta: { hostname, pathname } }
  }

  test(url: string | URL): boolean {
    return this.match(url) !== null
  }
}

function isNamelessWildcard(part: PartPattern): boolean {
  if (part.tokens.length !== 1) return false
  let token = part.tokens[0]
  if (token.type !== '*') return false
  let name = part.paramNames[token.nameIndex]
  return name === '*'
}

function hrefOrThrow(
  pattern: RoutePattern,
  partName: 'protocol' | 'hostname' | 'pathname',
  params: Record<string, string | number>,
): string {
  let result = pattern.ast[partName].href(params)
  if (result === null) {
    throw new HrefError({
      type: 'missing-params',
      pattern,
      part: partName,
      params,
    })
  }
  return result
}
