import * as RoutePattern from './route-pattern/index.ts'
import * as RE from './regexp.ts'

type Trie = {
  static: Record<string, Trie | undefined>
  variable: Map<string, [RegExp, Trie]>
  wildcard: Map<string, [RegExp, Trie]>
  next: Trie | undefined
  match: InternalMatch | undefined
}

type InternalMatch = {
  order: number
  pattern: RoutePattern.AST
  paramIndices: Array<Array<number>>
}

type Match = {
  order: number
  pattern: RoutePattern.AST
  params: Record<string, string | undefined>
}

type MatchState = { index: [number, number]; trie: Trie; paramValues: Array<Array<string>> }

function node(): Trie {
  return {
    static: {},
    variable: new Map(),
    wildcard: new Map(),
    next: undefined,
    match: undefined,
  }
}

export function create() {
  let root = node()
  let size = 0
  return {
    root,
    get size() {
      return size
    },
    add(pattern: string) {
      let x = RoutePattern.parse(pattern)
      this._add(x)
    },
    _add(pattern: RoutePattern.AST) {
      let order = size
      size += 1

      for (let variant of RoutePattern.variants(pattern)) {
        let match: InternalMatch = {
          order,
          pattern,
          paramIndices: variant.paramIndices,
        }

        let trie = root
        let index = [0, 0]
        while (true) {
          if (index[0] === variant.key.length) {
            trie.match = match
            break
          }

          let part = variant.key[index[0]]
          if (index[1] >= part.length) {
            if (!trie.next) {
              trie.next = node()
            }
            trie = trie.next
            index[0] += 1
            index[1] = 0
            continue
          }

          let segment = part[index[1]]

          let hasWildcard = segment.includes('{*}')
          if (hasWildcard) {
            let segments = part.slice(index[1])
            let key = segments.join(
              // prettier-ignore
              index[0] === 1 ? '.' :
              index[0] === 2 ? '/' :
              '',
            )
            let regexp = keyToRegExp(key)
            let next = trie.next
            if (!next) {
              next = node()
              trie.next = next
            }
            trie.wildcard.set(key, [regexp, next])
            index[0] += 1
            index[1] = 0
            trie = next
            continue
          }

          let hasVariable = segment.includes('{:}')
          if (hasVariable) {
            let next = trie.variable.get(segment)
            if (!next) {
              next = [keyToRegExp(segment), node()]
              trie.variable.set(segment, next)
            }
            trie = next[1]
            index[1] += 1
            continue
          }

          let next = trie.static[segment]
          if (!next) {
            next = node()
            trie.static[segment] = next
          }
          trie = next
          index[1] += 1
        }
      }
    },
    match(url: URL) {
      return this.matchByOrder(url)
    },
    matchAny(url: URL): Match | null {
      for (let match of this._match(url)) {
        return match
      }
      return null
    },
    matchByOrder(url: URL) {
      let best: Match | null = null
      for (let match of this._match(url)) {
        if (match.order === 0) return match
        if (best === null) {
          best = match
          continue
        }
        if (match.order < best.order) {
          best = match
          continue
        }
      }
      return best
    },
    *_match(url: URL): Generator<Match> {
      let protocol = url.protocol.slice(0, -1)
      let hostname = url.hostname.split('.').reverse()
      let pathname = url.pathname.slice(1).split('/')
      let query = [[protocol], hostname, pathname]

      let q: Array<MatchState> = [{ index: [0, 0], trie: root, paramValues: [[], [], []] }]
      while (q.length > 0) {
        let state = q.pop()!

        if (state.index[0] === query.length) {
          if (state.trie.match) {
            let { pattern } = state.trie.match
            yield {
              order: state.trie.match.order,
              pattern,
              params: toParams(state),
            }
          }
          continue
        }

        let part = query[state.index[0]]
        if (state.index[1] === part.length) {
          if (state.trie.next) {
            state.index[0] += 1
            state.index[1] = 0
            state.trie = state.trie.next
            q.push(state)
          }
          continue
        }

        let segment = part[state.index[1]]

        let staticMatch = state.trie.static[segment]
        if (staticMatch) {
          q.push({
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
            q.push({
              index: [state.index[0], state.index[1] + 1],
              trie,
              paramValues,
            })
          }
        }

        for (let [regexp, trie] of state.trie.wildcard.values()) {
          let key = part.slice(state.index[1]).join(
            // prettier-ignore
            state.index[0] === 1 ? '.' :
            state.index[0] === 2 ? '/' :
            '',
          )
          let match = regexp.exec(key)
          if (match) {
            let paramValues = structuredClone(state.paramValues)
            paramValues[state.index[0]].push(...match.slice(1))
            q.push({
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
          q.push(state)
        }
      }
    },
  }
}

function toParams(state: MatchState) {
  let { pattern, paramIndices } = state.trie.match!
  let { paramValues } = state
  let names = [
    pattern.protocol?.paramNames ?? [],
    pattern.hostname?.paramNames ?? [],
    pattern.pathname?.paramNames ?? [],
  ]
  let params: Record<string, string | undefined> = {}
  names.forEach((part) =>
    part.forEach((name) => {
      params[name] = undefined
    }),
  )

  for (let partIndex = 0; partIndex < paramIndices.length; partIndex++) {
    let part = paramIndices[partIndex]
    for (let i = 0; i < part.length; i++) {
      let name = names[partIndex][i]
      let value = paramValues[partIndex][i]
      params[name] = value
    }
  }
  return params
}

function keyToRegExp(key: string): RegExp {
  let source = key
    .split(/\{:\}|\{\*\}/)
    .map(RE.escape)
    .join('([^/]*)')
  return new RegExp(`^${source}$`)
}
