import type { Ast } from './parse.ts'
import type { Part } from './parse.types.ts'
import { parse } from './parse.ts'

type Params = Record<string, string | undefined>
type Match = { params: Params }

export class RoutePattern {
  readonly source: string

  readonly #ast: Ast

  constructor(source: string) {
    this.source = source
    this.#ast = parse(source)
  }

  match(url: URL | string): Match | null {
    if (typeof url === 'string') url = new URL(url)

    let protocolRE = partToRegExp(this.#ast.protocol, { param: /.*/ }) ?? /^.*$/
    let hostnameRE = partToRegExp(this.#ast.hostname, { param: /[^.]+/ }) ?? /^.*$/
    let pathnameRE = partToRegExp(this.#ast.pathname, { param: /[^/]+/ }) ?? /^$/

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

    if (this.#ast.search) {
      for (let [key, value] of this.#ast.search?.entries()) {
        if (!url.searchParams.getAll(key).includes(value)) return null
      }
    }

    return { params }
  }

  toString() {
    return this.source
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
      if (node.type === 'variable') {
        let source = '('
        if (node.name) {
          source += `?<${node.name}>`
        }
        source += paramRegExp.source
        source += ')'
        return source
      }
      if (node.type === 'wildcard') {
        let source = '('
        if (node.name) {
          source += `?<${node.name}>`
        }
        source += '.*)'
        return source
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
