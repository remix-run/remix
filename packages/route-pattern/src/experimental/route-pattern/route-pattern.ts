import type { AST } from './ast.ts'
import { split } from './split.ts'
import * as Join from './join.ts'
import * as Parse from './parse.ts'
import * as Href from './href.ts'
import { PartPattern } from '../part-pattern.ts'

export class RoutePattern {
  readonly ast: AST

  private constructor(ast: AST) {
    this.ast = ast
  }

  static parse(source: string): RoutePattern {
    let spans = split(source)

    return new RoutePattern({
      protocol: spans.protocol
        ? PartPattern.parse(source, spans.protocol)
        : PartPattern.parse('*', [0, 1]),
      hostname: spans.hostname
        ? PartPattern.parse(source, spans.hostname)
        : PartPattern.parse('*', [0, 1]),
      port: spans.port ? source.slice(...spans.port) : null,
      pathname: spans.pathname
        ? PartPattern.parse(source, spans.pathname)
        : PartPattern.parse('', [0, 0]),
      search: spans.search ? Parse.search(source.slice(...spans.search)) : new Map(),
    })
  }

  join(other: RoutePattern): RoutePattern {
    return new RoutePattern({
      protocol: isNamelessWildcard(other.ast.protocol) ? this.ast.protocol : other.ast.protocol,
      hostname: isNamelessWildcard(other.ast.hostname) ? this.ast.hostname : other.ast.hostname,
      port: other.ast.port ?? this.ast.port,
      pathname: Join.pathname(this.ast.pathname, other.ast.pathname),
      search: Join.search(this.ast.search, other.ast.search),
    })
  }

  href(params?: Record<string, string | number>, searchParams?: Href.Params): string {
    params ??= {}
    searchParams ??= {}

    let isDefaultProtocol = isNamelessWildcard(this.ast.protocol)
    let isDefaultHostname = isNamelessWildcard(this.ast.hostname)
    let isDefaultPort = this.ast.port === null

    let result = ''

    let needsOrigin = !isDefaultProtocol || !isDefaultHostname || !isDefaultPort
    if (needsOrigin) {
      let protocol = isDefaultProtocol ? 'https' : this.ast.protocol.href(params)
      if (isDefaultHostname) {
        throw new Error('todo: [href] missing hostname')
      }
      let hostname = this.ast.hostname.href(params)
      let port = isDefaultPort ? '' : `:${this.ast.port}`
      result += `${protocol}://${hostname}${port}`
    }

    let pathname = this.ast.pathname.href(params)
    result += '/' + pathname

    let search = Href.search(this.ast.search, searchParams)
    if (search) result += `?${search}`

    return result
  }
}

function isNamelessWildcard(part: PartPattern): boolean {
  if (part.tokens.length !== 1) return false
  let token = part.tokens[0]
  if (token.type !== '*') return false
  let name = part.paramNames[token.nameIndex]
  return name === '*'
}
