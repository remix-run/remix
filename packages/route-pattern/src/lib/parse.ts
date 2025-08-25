import type { Optional, Part } from './parse.types.ts'
import { split } from './split.ts'

export type Ast = {
  protocol?: Part
  hostname?: Part
  port?: string
  pathname?: Part
  search?: URLSearchParams
}

export function parse(source: string) {
  let { protocol, hostname, port, pathname, search } = split(source)
  let ast: Ast = {}

  if (protocol) ast.protocol = parsePart(source, protocol)
  if (hostname) ast.hostname = parsePart(source, hostname)
  if (port) ast.port = source.slice(...port)
  if (pathname) ast.pathname = parsePart(source, pathname)
  if (search) ast.search = new URLSearchParams(source.slice(...search))

  return ast
}

const identifierMatcher = /^[a-zA-Z_$][a-zA-Z_$0-9]*/

function parsePart(source: string, bounds: [number, number]) {
  let part = source.slice(...bounds)

  let ast: Part = []
  let optional: { node: Optional; index: number } | null = null

  let nodes = () => optional?.node.nodes ?? ast
  let appendText = (text: string) => {
    let last = nodes().at(-1)
    if (last?.type !== 'text') {
      nodes().push({ type: 'text', value: text })
      return
    }
    last.value += text
  }

  let i = 0
  while (i < part.length) {
    let char = part[i]

    // variable
    if (char === ':') {
      i += 1
      let name = identifierMatcher.exec(part.slice(i))?.[0]
      if (!name) throw new Error(`variable missing name at ${i}`)
      nodes().push({ type: 'variable', name })
      i += name.length
      continue
    }

    // wildcard
    if (char === '*') {
      i += 1
      let name = identifierMatcher.exec(part.slice(i))?.[0]
      if (name) {
        nodes().push({ type: 'wildcard', name })
        i += name.length
      } else {
        nodes().push({ type: 'wildcard' })
      }
      continue
    }

    // enum
    if (char === '{') {
      let close = part.indexOf('}', i)
      if (close === -1) throw new Error(`unmatched { at ${i}`)
      let members = part.slice(i + 1, close).split(',')
      nodes().push({ type: 'enum', members })
      i = close + 1
      continue
    }
    if (char === '}') {
      throw new Error(`unmatched } at ${i}`)
    }

    // optional
    if (char === '(') {
      if (optional) throw new Error(`nested ( at ${optional.index} ${i}`)
      optional = { node: { type: 'optional', nodes: [] }, index: i }
      i += 1
      continue
    }
    if (char === ')') {
      if (!optional) throw new Error(`unmatched ) at ${i}`)
      ast.push(optional.node)
      optional = null
      i += 1
      continue
    }

    // text
    if (char === '\\') {
      let next = part.at(i + 1)
      if (!next) throw new Error(`dangling escape at ${i}`)
      appendText(next)
      i += 2
      continue
    }
    appendText(char)
    i += 1
  }

  if (optional) throw new Error(`unmatched ( at ${optional.index}`)

  return ast
}
