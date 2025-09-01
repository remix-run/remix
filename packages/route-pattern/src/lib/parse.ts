import type { Ast, PartNode, Part } from './parse.types.ts'
import { split } from './split.ts'

export class ParseError extends Error {
  source: string
  position: number
  partName: string

  constructor(message: string, source: string, position: number, partName: string) {
    super(`${message}${partName ? ` in ${partName}` : ''}`)
    this.name = 'ParseError'
    this.source = source
    this.position = position
    this.partName = partName
  }
}

export function parse(source: string) {
  let { protocol, hostname, port, pathname, search } = split(source)
  let ast: Ast = {}

  if (protocol) ast.protocol = parsePart(source, protocol, 'protocol')
  if (hostname) ast.hostname = parsePart(source, hostname, 'hostname')
  if (port) ast.port = source.slice(...port)
  if (pathname) ast.pathname = parsePart(source, pathname, 'pathname')
  if (search) ast.searchParams = new URLSearchParams(source.slice(...search))

  return ast
}

const identifierMatcher = /^[a-zA-Z_$][a-zA-Z_$0-9]*/

function parsePart(source: string, bounds: [number, number], partName: string) {
  let [start, end] = bounds
  let part: Part = []
  // Use a simple stack of node arrays: the top is where new nodes are appended.
  // The root of the stack is the `part` array. Each '(' pushes a new array; ')'
  // pops and wraps it in an optional node which is appended to the new top.
  let nodesStack: Array<Array<PartNode>> = [part]
  let openIndexes: Array<number> = []
  let currentNodes = () => nodesStack[nodesStack.length - 1]

  let appendText = (text: string) => {
    let last = currentNodes().at(-1)
    if (last?.type !== 'text') {
      currentNodes().push({ type: 'text', value: text })
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
      if (!name) throw new ParseError('missing variable name', source, i, partName)
      currentNodes().push({ type: 'variable', name })
      i += name.length
      continue
    }

    // wildcard
    if (char === '*') {
      i += 1
      let remaining = source.slice(i, end)
      let name = identifierMatcher.exec(remaining)?.[0]
      if (name) {
        currentNodes().push({ type: 'wildcard', name })
        i += name.length
      } else {
        currentNodes().push({ type: 'wildcard' })
      }
      continue
    }

    // enum
    if (char === '{') {
      let close = source.indexOf('}', i)
      if (close === -1 || close >= end) throw new ParseError('unmatched {', source, i, partName)
      let members = source.slice(i + 1, close).split(',')
      currentNodes().push({ type: 'enum', members })
      i = close + 1
      continue
    }
    if (char === '}') {
      throw new ParseError('unmatched }', source, i, partName)
    }

    // optional
    if (char === '(') {
      nodesStack.push([])
      openIndexes.push(i)
      i += 1
      continue
    }
    if (char === ')') {
      if (nodesStack.length === 1) throw new ParseError('unmatched )', source, i, partName)
      let nodes = nodesStack.pop()!
      openIndexes.pop()
      currentNodes().push({ type: 'optional', nodes })
      i += 1
      continue
    }

    // text
    if (char === '\\') {
      let next = source.at(i + 1)
      if (!next || i + 1 >= end) throw new ParseError('dangling escape', source, i, partName)
      appendText(next)
      i += 2
      continue
    }

    appendText(char)
    i += 1
  }

  if (openIndexes.length > 0) {
    // Report the position of the earliest unmatched '('
    throw new ParseError('unmatched (', source, openIndexes[0], partName)
  }

  return part
}
