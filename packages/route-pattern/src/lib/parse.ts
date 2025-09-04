import type { ParseResult, Node, NodeList, SearchConstraints } from './parse.types.ts'
import { split } from './split.ts'
import type { SplitResult } from './split.ts'

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
  let result: ParseResult = {}

  let { protocol, hostname, port, pathname, search } = split(source) as SplitResult
  let start = 0

  if (protocol) {
    start = source.indexOf(protocol, start)
    result.protocol = parsePart(source, start, protocol.length, 'protocol')
    start += protocol.length
  }
  if (hostname) {
    start = source.indexOf(hostname, start)
    result.hostname = parsePart(source, start, hostname.length, 'hostname')
    start += hostname.length
  }
  if (port) {
    result.port = port
    start = source.indexOf(port, start) + port.length
  }
  if (pathname) {
    start = source.indexOf(pathname, start)
    result.pathname = parsePart(source, start, pathname.length, 'pathname')
  }
  if (search) {
    result.search = search
  }

  return result
}

const identifierMatcher = /^[a-zA-Z_$][a-zA-Z_$0-9]*/

function parsePart(source: string, start: number, length: number, partName: string) {
  let nodes: NodeList = []
  // Use a simple stack of node arrays: the top is where new nodes are appended.
  // The root of the stack is the `part` array. Each '(' pushes a new array; ')'
  // pops and wraps it in an optional node which is appended to the new top.
  let nodesStack: Array<Array<Node>> = [nodes]
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
  let end = start + length
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

  return nodes
}

// Search parsing helpers ---------------------------------------------------------------------------

export function parseSearchConstraints(search: string): SearchConstraints {
  let constraints: SearchConstraints = new Map()

  for (let part of search.split('&')) {
    if (part === '') continue
    let eqIndex = part.indexOf('=')
    if (eqIndex === -1) {
      // Presence-only (no '=')
      let name = decodeSearchComponent(part)
      let existing = constraints.get(name)
      if (!existing) {
        constraints.set(name, { requireAssignment: false, allowBare: true })
      }
      continue
    }

    let name = decodeSearchComponent(part.slice(0, eqIndex))
    let valuePart = part.slice(eqIndex + 1)
    let existing = constraints.get(name)
    if (!existing) {
      existing = { requireAssignment: true, allowBare: false }
      constraints.set(name, existing)
    } else {
      existing.requireAssignment = true
      existing.allowBare = false
    }

    if (valuePart.length > 0) {
      let decodedValue = decodeSearchComponent(valuePart)
      if (!existing.requiredValues) existing.requiredValues = new Set<string>()
      existing.requiredValues.add(decodedValue)
    }
  }

  return constraints
}

export function parseSearch(search: string): {
  namesWithoutAssignment: Set<string>
  namesWithAssignment: Set<string>
  valuesByKey: Map<string, Set<string>>
} {
  if (search.startsWith('?')) search = search.slice(1)

  let namesWithoutAssignment = new Set<string>()
  let namesWithAssignment = new Set<string>()
  let valuesByKey = new Map<string, Set<string>>()

  if (search.length > 0) {
    for (let part of search.split('&')) {
      if (part === '') continue
      let eqIndex = part.indexOf('=')
      if (eqIndex === -1) {
        let name = decodeSearchComponent(part)
        namesWithoutAssignment.add(name)
        continue
      }

      let name = decodeSearchComponent(part.slice(0, eqIndex))
      let valuePart = part.slice(eqIndex + 1)
      namesWithAssignment.add(name)
      let value = decodeSearchComponent(valuePart)
      let set = valuesByKey.get(name)
      if (!set) {
        set = new Set<string>()
        valuesByKey.set(name, set)
      }
      set.add(value)
    }
  }

  return { namesWithoutAssignment, namesWithAssignment, valuesByKey }
}

function decodeSearchComponent(text: string): string {
  try {
    return decodeURIComponent(text.replace(/\+/g, ' '))
  } catch {
    return text
  }
}
