import { parse, type Ast } from './parse.ts'
import { type Part } from './parse.types.ts'

type Params = Record<string, string | undefined>
type Match = { params: Params }

export class RoutePattern {
  readonly source: string

  private readonly _ast: Ast

  constructor(source: string) {
    this.source = source
    this._ast = parse(source)
  }

  match(url: URL | string): Match | null {
    if (typeof url === 'string') url = new URL(url)

    let protocolRE = partToRegExp(this._ast.protocol, { param: /.*/ }) ?? /^.*$/
    let hostnameRE = partToRegExp(this._ast.hostname, { param: /[^.]+/ }) ?? /^.*$/
    let pathnameRE = partToRegExp(this._ast.pathname, { param: /[^/]+/ }) ?? /^$/

    let params: Params = {}

    let protocolMatch = protocolRE.exec(url.protocol.slice(0, -1))
    if (!protocolMatch) return null
    Object.assign(params, protocolMatch.groups ?? {})

    let hostnameMatch = hostnameRE.exec(url.hostname)
    if (!hostnameMatch) return null
    Object.assign(params, hostnameMatch.groups ?? {})

    let pathnameMatch = pathnameRE.exec(url.pathname.slice(1))
    if (!pathnameMatch) return null
    Object.assign(params, pathnameMatch.groups ?? {})

    if (this._ast.search) {
      for (let [key, value] of this._ast.search?.entries()) {
        if (!url.searchParams.getAll(key).includes(value)) return null
      }
    }

    return { params }
  }
}

function regexpEscape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function partToRegExp(part: Part | undefined, options: { param: RegExp }) {
  if (part === undefined) return undefined
  let source = partToRegExpSource(part, options.param)
  return new RegExp('^' + source + '$')
}

function partToRegExpSource(part: Part, paramRegExp: RegExp) {
  let source: string = part
    .map((node) => {
      if (node.type === 'param') {
        let source = '('
        if (node.name) {
          source += `?<${node.name}>`
        }
        source += paramRegExp.source
        source += ')'
        return source
      }
      if (node.type === 'glob') {
        let source = '('
        if (node.name) {
          source += `?<${node.name}>`
        }
        source += '.*)'
        return source
      }
      if (node.type === 'optional') {
        return `(?:${partToRegExpSource(node.nodes, paramRegExp)})?`
      }
      if (node.type === 'text') {
        return regexpEscape(node.value)
      }
      if (node.type === 'enum') {
        return `(?:${node.members.map(regexpEscape).join('|')})`
      }
      throw new Error(`Node with unknown type: ${node}`)
    })
    .join('')
  return source
}
