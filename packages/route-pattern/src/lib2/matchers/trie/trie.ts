import { RegExp_escape } from '../../es2025.ts'
import * as RoutePattern from '../../route-pattern/index.ts'
import type { Params } from '../matcher.ts'

const SEPARATORS = ['', '.', '', '/']
const NOT_SEPARATORS = [/.*/g, /[^.]/g, /.*/g, /[^/]/g]

const RANK: Record<string, string> = {
  skip: '3',
  wildcard: '2',
  variable: '1',
  static: '0',
}

type Value<data> = {
  searchConstraints: RoutePattern.Search.Constraints
  paramNames: Array<string>
  paramIndices: Set<number>
  data: data
}

export type Match<data> = {
  rank: {
    hierarchical: Array<string>
    // todo: insert only cost, so maybe consider pre-computing search "rank"
    search: RoutePattern.Search.Constraints
  }
  params: Params
  data: data
}

export class Trie<data> {
  static: Record<string, Trie<data> | undefined> = {}
  variable: Map<string, { regexp: RegExp; trie: Trie<data> }> = new Map()
  wildcard: Map<string, { regexp: RegExp; trie: Trie<data> }> = new Map()
  values: Array<Value<data>> = []
  next?: Trie<data>

  insert(pattern: RoutePattern.AST, data: data) {
    type State = {
      partIndex: number
      segmentIndex: number
      trie: Trie<data>
    }
    let paramNames = toParamNames(pattern)

    for (let variant of RoutePattern.variants(pattern)) {
      let value: Value<data> = {
        searchConstraints: pattern.search,
        paramNames,
        paramIndices: variant.paramIndices,
        data,
      }

      let state: State = { partIndex: 0, segmentIndex: 0, trie: this }
      while (state.partIndex < 4) {
        let part = variant.key[state.partIndex]

        if (state.segmentIndex === part.length) {
          if (!state.trie.next) state.trie.next = new Trie()
          state.partIndex += 1
          state.segmentIndex = 0
          state.trie = state.trie.next
          continue
        }

        let segment = part[state.segmentIndex]
        let separator = SEPARATORS[state.partIndex]

        // wildcard
        if (segment.includes('{*}')) {
          let key = part.slice(state.segmentIndex).join(separator)
          let next = state.trie.wildcard.get(key)
          if (!next) {
            next = { regexp: keyToRegExp(key, separator), trie: new Trie() }
            state.trie.wildcard.set(key, next)
          }
          state.partIndex += 1
          state.segmentIndex = 0
          state.trie = next.trie
          continue
        }

        // variable
        if (segment.includes('{:}')) {
          let next = state.trie.variable.get(segment)
          if (!next) {
            next = { regexp: keyToRegExp(segment, separator), trie: new Trie() }
            state.trie.variable.set(segment, next)
          }
          state.segmentIndex += 1
          state.trie = next.trie
          continue
        }

        // static
        let next = state.trie.static[segment]
        if (!next) {
          next = new Trie()
          state.trie.static[segment] = next
        }
        state.segmentIndex += 1
        state.trie = next
      }

      state.trie.values.push(value)
    }
  }

  *search(url: URL): Generator<Match<data>> {
    let protocol = url.protocol.slice(0, -1)
    let hostname = url.hostname.split('.').reverse()
    let pathname = url.pathname.slice(1).split('/')
    let query = [[protocol], hostname, [url.port], pathname]

    type State = {
      partIndex: number
      segmentIndex: number
      trie: Trie<data>
      paramValues: Array<string>
      rank: Array<string>
    }
    let stack: Array<State> = [
      {
        partIndex: 0,
        segmentIndex: 0,
        trie: this,
        paramValues: [],
        rank: [],
      },
    ]

    while (stack.length > 0) {
      let state = stack.pop()!

      if (state.partIndex === query.length) {
        for (let value of state.trie.values) {
          if (RoutePattern.Search.match(url.searchParams, value.searchConstraints)) {
            yield {
              rank: {
                hierarchical: state.rank,
                search: value.searchConstraints,
              },
              params: params(value.paramNames, value.paramIndices, state.paramValues),
              data: value.data,
            }
          }
        }
        continue
      }

      let part = query[state.partIndex]
      if (state.segmentIndex === part.length) {
        if (state.trie.next) {
          stack.push({
            partIndex: state.partIndex + 1,
            segmentIndex: 0,
            trie: state.trie.next,
            paramValues: state.paramValues,
            rank: state.rank,
          })
        }
        continue
      }

      let segment = part[state.segmentIndex]

      let staticMatch = state.trie.static[segment]
      if (staticMatch) {
        let rank = state.rank.slice()
        rank.push(RANK.static)
        stack.push({
          partIndex: state.partIndex,
          segmentIndex: state.segmentIndex + 1,
          trie: staticMatch,
          paramValues: state.paramValues,
          rank,
        })
      }

      let separator = SEPARATORS[state.partIndex]
      let notSeparator = NOT_SEPARATORS[state.partIndex]

      for (let [key, { regexp, trie }] of state.trie.variable) {
        let match = regexp.exec(segment)
        if (match) {
          let paramValues = state.paramValues.slice()
          let rank = state.rank.slice()
          if (key === '{:}') {
            paramValues.push(segment)
            rank.push(RANK.variable.repeat(segment.length))
            stack.push({
              partIndex: state.partIndex,
              segmentIndex: state.segmentIndex + 1,
              trie,
              paramValues,
              rank,
            })
            continue
          }
          let dynamic = dynamicMatch(match, separator, notSeparator)
          paramValues.push(...dynamic.paramValues)
          rank.push(...dynamic.rank)
          stack.push({
            partIndex: state.partIndex,
            segmentIndex: state.segmentIndex + 1,
            trie,
            paramValues,
            rank,
          })
        }
      }

      for (let [key, { regexp, trie }] of state.trie.wildcard) {
        let segments = part.slice(state.segmentIndex)
        let rest = segments.join(separator)
        let match = regexp.exec(rest)
        if (match) {
          let paramValues = state.paramValues.slice()
          let rank = state.rank.slice()
          if (key === '{*}') {
            paramValues.push(rest)
            segments.forEach((segment) => rank.push(RANK.wildcard.repeat(segment.length)))
            stack.push({
              partIndex: state.partIndex + 1,
              segmentIndex: 0,
              trie,
              paramValues,
              rank,
            })
            continue
          }
          let dynamic = dynamicMatch(match, separator, notSeparator)
          paramValues.push(...dynamic.paramValues)
          rank.push(...dynamic.rank)
          stack.push({
            partIndex: state.partIndex + 1,
            segmentIndex: 0,
            trie,
            paramValues,
            rank,
          })
        }
      }

      // Consider skipping an entire part
      // For example, a pattern like `://remix.run/about`
      // will want to "skip" the protocol
      // todo: better explanation
      if (state.segmentIndex === 0 && state.trie.next) {
        let rank = state.rank.slice()
        query[state.partIndex].forEach(() => rank.push(RANK.skip))
        stack.push({
          partIndex: state.partIndex + 1,
          segmentIndex: 0,
          trie: state.trie.next,
          paramValues: state.paramValues,
          rank,
        })
      }
    }
  }
}

function params(paramNames: Array<string>, paramIndices: Set<number>, paramValues: Array<string>) {
  let result: Params = {}

  let valuesIndex = 0
  for (let i = 0; i < paramNames.length; i++) {
    let name = paramNames[i]
    if (paramIndices.has(i)) {
      result[name] = paramValues[valuesIndex++]
      continue
    }
    if (name in result) continue
    result[name] = undefined
  }
  return result
}

function keyToRegExp(key: string, separator: string): RegExp {
  let variablePattern = `[^${RegExp_escape(separator)}]*`
  let wildcardPattern = '.*'

  let i = 0
  let source = key
    // use capture group so that `split` includes the delimiters in the result
    .split(/(\{:\}|\{\*\})/)
    .map((part) => {
      if (part === '{*}') return `(?<wildcard_${i++}>${wildcardPattern})`
      if (part === '{:}') return `(?<variable_${i++}>${variablePattern})`
      return `(?<static_${i++}>${RegExp_escape(part)})`
    })
    .join('')

  return new RegExp(`^${source}$`, 'd')
}

function dynamicMatch(
  match: RegExpExecArray,
  separator: string,
  notSeparator: RegExp,
): { paramValues: Array<string>; rank: Array<string> } {
  let paramValues: Array<string> = []
  let segmentRank = ''
  for (let group in match.indices?.groups) {
    let span = match.indices.groups[group]
    let type = group.split('_')[0] as keyof typeof RANK
    let lexeme = match[0].slice(...span)
    segmentRank += lexeme.replaceAll(notSeparator, RANK[type])
    if (type === 'variable' || type === 'wildcard') {
      if (lexeme.length > 0) paramValues.push(lexeme)
    }
  }

  return {
    paramValues,
    rank: segmentRank.split(separator),
  }
}

export function toParamNames(pattern: RoutePattern.AST): Array<string> {
  let paramNames: Array<string> = []
  if (pattern.protocol) paramNames.push(...pattern.protocol.paramNames)
  if (pattern.hostname) paramNames.push(...pattern.hostname.paramNames)
  if (pattern.pathname) paramNames.push(...pattern.pathname.paramNames)
  return paramNames
}
