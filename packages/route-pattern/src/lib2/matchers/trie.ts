import * as RoutePattern from '../route-pattern/index.ts'
import * as RE from '../regexp.ts'

const SEPARATORS = ['', '.', '/']

type TrieIndex = [partIndex: number, segmentIndex: number]

type Match<data> = {
  paramNames: Array<string>
  data: data
}

export class Trie<data> {
  static: Record<string, Trie<data> | undefined> = {}
  variable: Map<string, [RegExp, Trie<data>]> = new Map()
  wildcard: Map<string, [RegExp, Trie<data>]> = new Map()
  next?: Trie<data>
  match?: Match<data>

  insert(pattern: RoutePattern.AST, data: data) {
    for (let variant of RoutePattern.variants(pattern)) {
      let match: Match<data> = {
        paramNames: variant.paramNames,
        data,
      }

      let trie: Trie<data> = this
      let index: TrieIndex = [0, 0]
      while (true) {
        if (index[0] === variant.key.length) {
          trie.match = match
          break
        }

        let part = variant.key[index[0]]
        if (index[1] >= part.length) {
          if (!trie.next) trie.next = new Trie()
          trie = trie.next
          index[0] += 1
          index[1] = 0
          continue
        }

        let segment = part[index[1]]

        let hasWildcard = segment.includes('{*}')
        if (hasWildcard) {
          let segments = part.slice(index[1])
          let key = segments.join(SEPARATORS[index[0]])
          // todo: check if key in wildcard map
          if (!trie.next) trie.next = new Trie()
          let regexp = Trie.#keyToRegExp(key, SEPARATORS[index[0]])
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
            let regexp = Trie.#keyToRegExp(segment, SEPARATORS[index[0]])
            next = [regexp, new Trie()]
            trie.variable.set(segment, next)
          }
          trie = next[1]
          index[1] += 1
          continue
        }

        let next = trie.static[segment]
        if (!next) {
          next = new Trie()
          trie.static[segment] = next
        }
        trie = next
        index[1] += 1
      }
    }
  }

  *search(url: URL): Generator<Match<data>> {
    let protocol = url.protocol.slice(0, -1)
    let hostname = url.hostname.split('.').reverse()
    let pathname = url.pathname.slice(1).split('/')
    let query = [[protocol], hostname, pathname]

    type State = {
      index: TrieIndex
      trie: Trie<data>
      paramValues: [protocol: Array<string>, hostname: Array<string>, pathname: Array<string>]
    }
    let stack: Array<State> = [
      {
        index: [0, 0],
        trie: this,
        paramValues: [[], [], []],
      },
    ]

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
        let key = part.slice(state.index[1]).join(SEPARATORS[state.index[0]])
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

      // Consider skipping an entire part
      // For example, a pattern like `://remix.run/about`
      // will want to "skip" the protocol
      // todo: better explanation
      if (state.index[1] === 0 && state.trie.next) {
        state.index[0] += 1
        state.index[1] = 0
        state.trie = state.trie.next
        stack.push(state)
      }
    }
  }

  static #keyToRegExp(key: string, separator: string): RegExp {
    let variablePattern = `[^${RE.escape(separator)}]*`
    let wildcardPattern = '.*'

    let source = key
      // use capture group so that `split` includes the delimiters in the result
      .split(/(\{:\}|\{\*\})/)
      .map((part) => {
        if (part === '{:}') return `(${variablePattern})`
        if (part === '{*}') return `(${wildcardPattern})`
        return RE.escape(part)
      })
      .join('')

    return new RegExp(`^${source}$`)
  }
}
