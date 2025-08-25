import type { Optional, Part } from './parse.types.ts'
import { split } from './split.ts'

export type Ast = {
  protocol?: Part
  hostname?: Part
  port?: string
  pathname?: Part
  search?: URLSearchParams
}

export class ParseError extends Error {
  source: string
  position: number
  partType?: string

  constructor(message: string, source: string, position: number, partType?: string) {
    super(`${message}${partType ? ` in ${partType}` : ''}`)
    this.name = 'ParseError'
    this.source = source
    this.position = position
    this.partType = partType
  }
}

export function parse(source: string) {
  let { protocol, hostname, port, pathname, search } = split(source)
  let ast: Ast = {}

  if (protocol) ast.protocol = parsePart(source, protocol, 'protocol')
  if (hostname) ast.hostname = parsePart(source, hostname, 'hostname')
  if (port) ast.port = source.slice(...port)
  if (pathname) ast.pathname = parsePart(source, pathname, 'pathname')
  if (search) ast.search = new URLSearchParams(source.slice(...search))

  return ast
}

const identifierMatcher = /^[a-zA-Z_$][a-zA-Z_$0-9]*/

function parsePart(source: string, bounds: [number, number], partType?: string) {
  let [start, end] = bounds
  let ast: Part = []
  let optional: { node: Optional; index: number } | null = null
  let currentNodes = ast

  let appendText = (text: string) => {
    let last = currentNodes.at(-1)
    if (last?.type !== 'text') {
      currentNodes.push({ type: 'text', value: text })
      return
    }
    last.value += text
  }

  let i = start
  while (i < end) {
    let char = source[i]

    // variable
    if (char === ':') {
      i += 1
      let remaining = source.slice(i, end)
      let name = identifierMatcher.exec(remaining)?.[0]
      if (!name) throw new ParseError('missing variable name', source, i, partType)
      currentNodes.push({ type: 'variable', name })
      i += name.length
      continue
    }

    // wildcard
    if (char === '*') {
      i += 1
      let remaining = source.slice(i, end)
      let name = identifierMatcher.exec(remaining)?.[0]
      if (name) {
        currentNodes.push({ type: 'wildcard', name })
        i += name.length
      } else {
        currentNodes.push({ type: 'wildcard' })
      }
      continue
    }

    // enum
    if (char === '{') {
      let close = source.indexOf('}', i)
      if (close === -1 || close >= end) throw new ParseError('unmatched {', source, i, partType)
      let members = source.slice(i + 1, close).split(',')
      currentNodes.push({ type: 'enum', members })
      i = close + 1
      continue
    }
    if (char === '}') {
      throw new ParseError('unmatched }', source, i, partType)
    }

    // optional
    if (char === '(') {
      if (optional) throw new ParseError('invalid nested (', source, i, partType)
      optional = { node: { type: 'optional', nodes: [] }, index: i }
      currentNodes = optional.node.nodes
      i += 1
      continue
    }
    if (char === ')') {
      if (!optional) throw new ParseError('unmatched )', source, i, partType)
      ast.push(optional.node)
      currentNodes = ast
      optional = null
      i += 1
      continue
    }

    // text
    if (char === '\\') {
      let next = source.at(i + 1)
      if (!next || i + 1 >= end) throw new ParseError('dangling escape', source, i, partType)
      appendText(next)
      i += 2
      continue
    }

    appendText(char)
    i += 1
  }

  if (optional) throw new ParseError('unmatched (', source, optional.index, partType)

  return ast
}
