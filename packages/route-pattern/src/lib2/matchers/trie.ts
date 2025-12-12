import * as RoutePattern from '../route-pattern/index.ts'
import * as RE from '../regexp.ts'

type Trie = {
  static: Record<string, Trie | undefined>
  variable: Map<string, [RegExp, Trie]>
  wildcard: Map<string, [RegExp, Trie]>
  next: Trie | undefined
  match: Match | undefined
}

export type Match = {
  pattern: RoutePattern.AST
  paramIndices: [protocol: Array<number>, hostname: Array<number>, pathname: Array<number>]
}

export function create(): Trie {
  return {
    static: {},
    variable: new Map(),
    wildcard: new Map(),
    next: undefined,
    match: undefined,
  }
}

function keyToRegExp(key: string): RegExp {
  let source = key
    .split(/\{:\}|\{\*\}/)
    .map(RE.escape)
    .join('([^/]*)')
  return new RegExp(`^${source}$`)
}

const separators = ['', '.', '/'] as const

type Index = [partIndex: number, segmentIndex: number]

// insert(trie, pattern, data: data)
// Data: { pattern, order, component }
export function insert(root: Trie, match: Match) {
  for (let variant of RoutePattern.variants(match.pattern)) {
    let trie = root
    let index: Index = [0, 0]
    while (true) {
      if (index[0] === variant.key.length) {
        trie.match = match
        break
      }

      let part = variant.key[index[0]]
      if (index[1] >= part.length) {
        if (!trie.next) trie.next = create()
        trie = trie.next
        index[0] += 1
        index[1] = 0
        continue
      }

      let segment = part[index[1]]

      let hasWildcard = segment.includes('{*}')
      if (hasWildcard) {
        let segments = part.slice(index[1])
        let key = segments.join(separators[index[0]])
        let regexp = keyToRegExp(key)
        if (!trie.next) trie.next = create()
        trie.wildcard.set(key, [regexp, trie.next])
        index[0] += 1
        index[1] = 0
        trie = trie.next
        continue
      }

      let hasVariable = segment.includes('{:}')
      if (hasVariable) {
        let next = trie.variable.get(segment)
        if (!next) {
          next = [keyToRegExp(segment), create()]
          trie.variable.set(segment, next)
        }
        trie = next[1]
        index[1] += 1
        continue
      }

      let next = trie.static[segment]
      if (!next) {
        next = create()
        trie.static[segment] = next
      }
      trie = next
      index[1] += 1
    }
  }
}

type SearchState = {
  index: Index
  trie: Trie
  paramValues: [protocol: Array<string>, hostname: Array<string>, pathname: Array<string>]
}

export function* search(root: Trie, url: URL): Generator<Match> {
  let protocol = url.protocol.slice(0, -1)
  let hostname = url.hostname.split('.').reverse()
  let pathname = url.pathname.slice(1).split('/')
  let query = [[protocol], hostname, pathname]

  let stack: Array<SearchState> = [{ index: [0, 0], trie: root, paramValues: [[], [], []] }]
  while (stack.length > 0) {
    let state = stack.pop()!

    if (state.index[0] === query.length) {
      if (state.trie.match) {
        yield state.trie.match
      }
      continue
    }

    let part = query[state.index[0]]
    if (state.index[1] === part.length) {
      if (state.trie.next) {
        state.index[0] += 1
        state.index[1] = 0
        state.trie = state.trie.next
        stack.push(state)
      }
      continue
    }

    let segment = part[state.index[1]]

    let staticMatch = state.trie.static[segment]
    if (staticMatch) {
      stack.push({
        index: [state.index[0], state.index[1] + 1],
        trie: staticMatch,
        paramValues: state.paramValues,
      })
    }

    for (let [regexp, trie] of state.trie.variable.values()) {
      let match = regexp.exec(segment)
      if (match) {
        let paramValues = structuredClone(state.paramValues)
        paramValues[state.index[0]].push(...match.slice(1))
        stack.push({
          index: [state.index[0], state.index[1] + 1],
          trie,
          paramValues,
        })
      }
    }

    for (let [regexp, trie] of state.trie.wildcard.values()) {
      let key = part.slice(state.index[1]).join(separators[state.index[0]])
      let match = regexp.exec(key)
      if (match) {
        let paramValues = structuredClone(state.paramValues)
        paramValues[state.index[0]].push(...match.slice(1))
        stack.push({
          index: [state.index[0] + 1, 0],
          trie,
          paramValues,
        })
      }
    }

    if (state.trie.next) {
      state.index[0] += 1
      state.index[1] = 0
      state.trie = state.trie.next
      stack.push(state)
    }
  }
}
