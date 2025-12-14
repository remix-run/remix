import { RegExp_escape } from '../es2025.ts'
import * as RoutePattern from '../route-pattern/index.ts'
import type { Matcher } from './matcher.ts'

export class TrieMatcher<data> implements Matcher<data> {
  #trie: Trie<data> = new Trie()
  #size: number = 0

  add(pattern: RoutePattern.AST, data: data) {
    this.#trie.insert(pattern, data)
    this.#size += 1
  }

  match(url: URL) {
    let best: SearchResult<data> | null = null
    for (let match of this.#trie.search(url)) {
      if (best === null || match.rank < best.rank) {
        best = match
      }
    }
    // todo: also return params for this match
    return best?.data ?? null
  }

  get size() {
    return this.#size
  }
}

// Trie --------------------------------------------------------------------------------------------

const SEPARATORS = ['', '.', '/']

type TrieIndex = [partIndex: number, segmentIndex: number]

type Match<data> = {
  paramNames: {
    /** In the same order as they appear in their variant */
    included: Array<string>
    excluded: Array<string>
  }
  data: data
}

type Params = Record<string, string | undefined>

type SearchResult<data> = {
  rank: Uint8Array
  params: Params
  data: data
}

export class Trie<data> {
  static: Record<string, Trie<data> | undefined> = {}
  variable: Map<string, { regexp: RegExp; trie: Trie<data> }> = new Map()
  wildcard: Map<string, { regexp: RegExp; trie: Trie<data> }> = new Map()
  next?: Trie<data>
  match?: Match<data>

  insert(pattern: RoutePattern.AST, data: data) {
    let patternParamNames = [
      ...(pattern.protocol?.paramNames ?? []),
      ...(pattern.hostname?.paramNames ?? []),
      ...(pattern.pathname?.paramNames ?? []),
    ]

    for (let variant of RoutePattern.variants(pattern)) {
      let match: Match<data> = {
        paramNames: {
          included: variant.paramNames,
          excluded: patternParamNames.filter((name) => !variant.paramNames.includes(name)),
        },
        data,
      }

      let trie: Trie<data> = this
      let index: TrieIndex = [0, 0]
      while (true) {
        if (index[0] === variant.key.length) {
          // todo: what if `match` already exists (duplicate / conflict)?
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
          let next = trie.wildcard.get(key)
          if (!next) {
            let regexp = Trie.#keyToRegExp(key, SEPARATORS[index[0]])
            next = { regexp, trie: new Trie() }
            trie.wildcard.set(key, next)
          }
          trie = next.trie
          index[0] += 1
          index[1] = 0
          continue
        }

        let hasVariable = segment.includes('{:}')
        if (hasVariable) {
          let next = trie.variable.get(segment)
          if (!next) {
            let regexp = Trie.#keyToRegExp(segment, SEPARATORS[index[0]])
            next = { regexp, trie: new Trie() }
            trie.variable.set(segment, next)
          }
          trie = next.trie
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

  *search(url: URL): Generator<SearchResult<data>> {
    let protocol = url.protocol.slice(0, -1)
    let hostname = url.hostname.split('.').reverse()
    let pathname = url.pathname.slice(1).split('/')
    let query = [[protocol], hostname, pathname]

    let rankLength = protocol.length
    hostname.forEach((segment) => (rankLength += segment.length))
    pathname.forEach((segment) => (rankLength += segment.length))

    type State = {
      index: TrieIndex
      trie: Trie<data>
      paramValues: Array<string>
      /** 0 => static, 1 => variable, 2 => wilcard, 3 => skipped */
      rank: Uint8Array
      rankIndex: number
    }
    let stack: Array<State> = [
      {
        index: [0, 0],
        trie: this,
        paramValues: [],
        rank: new Uint8Array(rankLength),
        rankIndex: 0,
      },
    ]

    while (stack.length > 0) {
      let state = stack.pop()!

      if (state.index[0] === query.length) {
        let { match } = state.trie
        if (match) {
          yield {
            rank: state.rank,
            params: Trie.#toParams(match, state.paramValues),
            data: match.data,
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
          rank: state.rank,
          rankIndex: state.rankIndex + segment.length,
        })
      }

      for (let { regexp, trie } of state.trie.variable.values()) {
        let match = regexp.exec(segment)
        if (match) {
          let rank = state.rank.slice()
          match.indices?.forEach((span, i) => {
            if (i === 0) return // ignore span for entire match
            rank.fill(1, state.rankIndex + span[0], state.rankIndex + span[1])
          })
          let paramValues = state.paramValues.slice()
          paramValues.push(...match.slice(1))
          stack.push({
            index: [state.index[0], state.index[1] + 1],
            trie,
            paramValues,
            rank,
            rankIndex: state.rankIndex + segment.length,
          })
        }
      }

      for (let { regexp, trie } of state.trie.wildcard.values()) {
        let segments = part.slice(state.index[1]).join(SEPARATORS[state.index[0]])
        let match = regexp.exec(segments)
        if (match) {
          let rank = state.rank.slice()
          Object.entries(match.indices?.groups ?? {}).forEach(([group, span]) => {
            if (group.startsWith('v_')) {
              rank.fill(1, state.rankIndex + span[0], state.rankIndex + span[1])
            }
            if (group.startsWith('w_')) {
              rank.fill(2, state.rankIndex + span[0], state.rankIndex + span[1])
            }
          })
          let paramValues = state.paramValues.slice()
          paramValues.push(...match.slice(1))
          stack.push({
            index: [state.index[0] + 1, 0],
            trie,
            paramValues,
            rank,
            rankIndex: state.rankIndex + segments.length,
          })
        }
      }

      // Consider skipping an entire part
      // For example, a pattern like `://remix.run/about`
      // will want to "skip" the protocol
      // todo: better explanation
      if (state.index[1] === 0 && state.trie.next) {
        let length = query[state.index[0]].reduce((acc, segment) => acc + segment.length, 0)
        stack.push({
          index: [state.index[0] + 1, 0],
          trie: state.trie.next,
          paramValues: state.paramValues,
          rank: state.rank.slice().fill(3, state.rankIndex, state.rankIndex + length),
          rankIndex: state.rankIndex + length,
        })
      }
    }
  }

  static #keyToRegExp(key: string, separator: string): RegExp {
    let variablePattern = `[^${RegExp_escape(separator)}]*`
    let wildcardPattern = '.*'

    let i = 0
    let source = key
      // use capture group so that `split` includes the delimiters in the result
      .split(/(\{:\}|\{\*\})/)
      .map((part) => {
        if (part === '{:}') return `(?<v_${i++}>${variablePattern})`
        if (part === '{*}') return `(?<w_${i++}>${wildcardPattern})`
        return RegExp_escape(part)
      })
      .join('')

    return new RegExp(`^${source}$`, 'd')
  }

  static #toParams(match: Match<unknown>, paramValues: Array<string>): Params {
    let params: Params = {}

    match.paramNames.excluded.forEach((name) => {
      params[name] = undefined
    })

    match.paramNames.included.forEach((name, i) => {
      params[name] = paramValues[i]
    })

    return params
  }
}
