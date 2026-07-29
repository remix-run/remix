import type { RoutePatternParts, RoutePattern } from '../route-pattern.ts'
import { parsePattern } from '../route-pattern/parse.ts'
import { decodeHostname } from './decode.ts'
import {
  canonicalizeUrlPart,
  compilePart,
  hasStaticAnchor,
  hasStaticPrefix,
  hasStaticSuffix,
  matchPart,
  unitKey,
  type CanonicalText,
  type PartProgram,
} from './program.ts'
import type { Match, MatchParamMeta } from './types.ts'
import {
  checkMatcherLimit,
  consumeMatchWork,
  createMatchWorkBudget,
  resolveMatcherLimits,
  type MatchWorkBudget,
  type MatcherLimits,
} from './limits.ts'

type Entry<data> = {
  readonly pattern: RoutePattern
  readonly patternParts: RoutePatternParts
  readonly data: data
  readonly hostname: PartProgram | null
  readonly pathname: PartProgram
  readonly insertion: number
}

type PathnameIndexNode<data> = {
  readonly static: Map<string, PathnameIndexNode<data>>
  readonly entries: Array<Entry<data>>
}

const maxCandidatesBeforeSecondaryIndex = 32

export class Trie<data = unknown> {
  readonly ignoreCase: boolean
  #pathnamePrefixIndex = createPathnameIndexNode<data>()
  #pathnameSuffixIndex = createPathnameIndexNode<data>()
  #pathnameAnchorIndex = createPathnameIndexNode<data>()
  #insertion = 0
  readonly #limits: MatcherLimits
  #size = 0

  constructor(options?: { ignoreCase?: boolean; limits?: Partial<MatcherLimits> }) {
    this.ignoreCase = options?.ignoreCase ?? false
    this.#limits = resolveMatcherLimits(options?.limits)
  }

  insert(pattern: string | RoutePattern, data: data): void {
    let patternSize: number
    if (typeof pattern === 'string') {
      let source = pattern
      patternSize = this.#checkSizeLimits(source)
      pattern = parsePattern(pattern)
      if (pattern.source !== source) patternSize = this.#checkSizeLimits(pattern.source)
    } else {
      patternSize = this.#checkSizeLimits(pattern.source)
    }
    let patternParts = pattern._parts

    let hostname = patternParts.hostname
      ? compilePart(patternParts.hostname, { ignoreCase: true })
      : null
    let pathname = compilePart(patternParts.pathname, { ignoreCase: this.ignoreCase })
    let entry: Entry<data> = {
      pattern,
      patternParts,
      data,
      hostname,
      pathname,
      insertion: this.#insertion++,
    }

    let node = this.#pathnamePrefixIndex
    for (let unit of pathname.staticPrefix) {
      let key = unitKey(unit)
      let next = node.static.get(key)
      if (next === undefined) {
        next = createPathnameIndexNode()
        node.static.set(key, next)
      }
      node = next
    }
    node.entries.push(entry)

    node = this.#pathnameAnchorIndex
    for (let unit of pathname.staticAnchor) {
      let key = unitKey(unit)
      let next = node.static.get(key)
      if (next === undefined) {
        next = createPathnameIndexNode()
        node.static.set(key, next)
      }
      node = next
    }
    node.entries.push(entry)

    node = this.#pathnameSuffixIndex
    for (let i = pathname.staticSuffix.length - 1; i >= 0; i--) {
      let key = unitKey(pathname.staticSuffix[i])
      let next = node.static.get(key)
      if (next === undefined) {
        next = createPathnameIndexNode()
        node.static.set(key, next)
      }
      node = next
    }
    node.entries.push(entry)
    this.#size += patternSize
  }

  #checkSizeLimits(source: string): number {
    let size = utf8Size(source)
    checkMatcherLimit('maxPatternSize', this.#limits.maxPatternSize, size)
    checkMatcherLimit('maxMatcherSize', this.#limits.maxMatcherSize, this.#size + size)
    return size
  }

  search(url: URL): Array<Match<string, data>> {
    let protocol = url.protocol.slice(0, -1)
    if (protocol !== 'http' && protocol !== 'https') return []
    if (this.#insertion === 0) return []

    let matchWorkBudget = createMatchWorkBudget(this.#limits.maxMatchWork)
    let pathname = canonicalizeUrlPart(url.pathname.slice(1), 'pathname', {
      budget: matchWorkBudget,
      ignoreCase: this.ignoreCase,
    })
    if (pathname === null) return []

    let candidates: Array<Entry<data>> = []
    let needsHostnameProgram = false
    for (let entry of this.#findCandidates(pathname, matchWorkBudget)) {
      consumeMatchWork(matchWorkBudget, 1)
      if (!matchesProtocol(entry.patternParts.protocol, protocol)) continue
      if (!matchesPort(entry.patternParts, protocol, url.port)) continue
      if (!matchSearch(url.searchParams, entry.patternParts.search, matchWorkBudget)) continue
      candidates.push(entry)
      if (entry.hostname !== null) needsHostnameProgram = true
    }
    if (candidates.length === 0) return []
    candidates.sort((a, b) => a.insertion - b.insertion)

    let decodedHostname = decodeHostname(url.hostname)
    let hostname: CanonicalText | undefined
    if (needsHostnameProgram) {
      let canonicalHostname = canonicalizeUrlPart(decodedHostname, 'hostname', {
        budget: matchWorkBudget,
        ignoreCase: true,
      })
      if (canonicalHostname === null) return []
      hostname = canonicalHostname
    }

    let results: Array<Match<string, data>> = []
    for (let entry of candidates) {
      let hostnameMatch: ReadonlyArray<MatchParamMeta>
      if (entry.hostname === null) {
        hostnameMatch = [
          {
            type: '*',
            name: '*',
            value: decodedHostname,
            begin: 0,
            end: decodedHostname.length,
          },
        ]
      } else {
        if (hostname === undefined) throw new Error('missing canonical hostname')
        let match = matchPart(entry.hostname, hostname, matchWorkBudget)
        if (match === null) continue
        hostnameMatch = match
      }

      let pathnameMatch = matchPart(entry.pathname, pathname, matchWorkBudget)
      if (pathnameMatch === null) continue

      let params: Record<string, string | undefined> = {}
      for (let name of entry.hostname?.captureNames ?? []) params[name] = undefined
      for (let name of entry.pathname.captureNames) params[name] = undefined
      for (let capture of hostnameMatch) {
        if (capture.name !== '*') params[capture.name] = capture.value
      }
      for (let capture of pathnameMatch) {
        if (capture.name !== '*') params[capture.name] = capture.value
      }

      results.push({
        url,
        pattern: entry.pattern,
        data: entry.data,
        params,
        paramsMeta: {
          hostname: hostnameMatch.slice(),
          pathname: pathnameMatch.slice(),
        },
      })
    }
    return results
  }

  #findCandidates(pathname: CanonicalText, budget: MatchWorkBudget): Array<Entry<data>> {
    let result = collectCandidates(this.#pathnamePrefixIndex, pathname.units, budget)
    if (result.length > maxCandidatesBeforeSecondaryIndex) {
      let suffix = collectCandidates(this.#pathnameSuffixIndex, pathname.units.toReversed(), budget)
      if (suffix.length < result.length) result = suffix
    }
    if (result.length > maxCandidatesBeforeSecondaryIndex) {
      let anchor = collectAnchorCandidates(this.#pathnameAnchorIndex, pathname.units, budget)
      if (anchor.length < result.length) result = anchor
    }
    let filtered: Array<Entry<data>> = []
    for (let entry of result) {
      if (!hasStaticPrefix(entry.pathname, pathname, budget)) continue
      if (!hasStaticSuffix(entry.pathname, pathname, budget)) continue
      if (!hasStaticAnchor(entry.pathname, pathname, budget)) continue
      filtered.push(entry)
    }
    return filtered
  }
}

function utf8Size(value: string): number {
  let result = 0
  for (let char of value) {
    let code = char.charCodeAt(0)
    result += char.length === 2 ? 4 : code <= 0x7f ? 1 : code <= 0x7ff ? 2 : 3
  }
  return result
}

function collectCandidates<data>(
  index: PathnameIndexNode<data>,
  units: CanonicalText['units'],
  budget: MatchWorkBudget,
): Array<Entry<data>> {
  let result: Array<Entry<data>> = []
  let node: PathnameIndexNode<data> | undefined = index
  appendEntries(result, node.entries, budget)

  for (let unit of units) {
    consumeMatchWork(budget, 1)
    node = node.static.get(unitKey(unit))
    if (node === undefined) break
    appendEntries(result, node.entries, budget)
  }
  return result
}

function collectAnchorCandidates<data>(
  index: PathnameIndexNode<data>,
  units: CanonicalText['units'],
  budget: MatchWorkBudget,
): Array<Entry<data>> {
  let result = new Set<Entry<data>>()
  addEntries(result, index.entries, budget)
  for (let position = 0; position < units.length; position++) {
    let node: PathnameIndexNode<data> | undefined = index
    for (let i = position; i < units.length; i++) {
      consumeMatchWork(budget, 1)
      node = node.static.get(unitKey(units[i]))
      if (node === undefined) break
      addEntries(result, node.entries, budget)
    }
  }
  return Array.from(result)
}

function appendEntries<data>(
  target: Array<Entry<data>>,
  entries: ReadonlyArray<Entry<data>>,
  budget: MatchWorkBudget,
): void {
  consumeMatchWork(budget, entries.length)
  for (let entry of entries) target.push(entry)
}

function addEntries<data>(
  target: Set<Entry<data>>,
  entries: ReadonlyArray<Entry<data>>,
  budget: MatchWorkBudget,
): void {
  consumeMatchWork(budget, entries.length)
  for (let entry of entries) target.add(entry)
}

function matchesProtocol(
  expected: RoutePatternParts['protocol'],
  actual: 'http' | 'https',
): boolean {
  return expected === null || expected === 'http(s)' || expected === actual
}

function matchesPort(
  pattern: RoutePatternParts,
  protocol: 'http' | 'https',
  actual: string,
): boolean {
  if (pattern.port === null) return pattern.hostname === null || actual === ''
  let expected = pattern.port
  if ((protocol === 'http' && expected === '80') || (protocol === 'https' && expected === '443')) {
    expected = ''
  }
  return expected === actual
}

function matchSearch(
  params: URLSearchParams,
  constraints: ReadonlyMap<string, ReadonlySet<string>>,
  budget: MatchWorkBudget,
): boolean {
  for (let [name, requiredValues] of constraints) {
    consumeMatchWork(budget, params.size + requiredValues.size + 1)
    if (requiredValues.size === 0) {
      if (!params.has(name)) return false
      continue
    }
    let values = params.getAll(name)
    for (let requiredValue of requiredValues) {
      if (!values.includes(requiredValue)) return false
    }
  }
  return true
}

function createPathnameIndexNode<data>(): PathnameIndexNode<data> {
  return { static: new Map(), entries: [] }
}
