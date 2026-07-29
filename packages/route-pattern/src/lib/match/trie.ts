import type { RoutePatternParts, RoutePattern } from '../route-pattern.ts'
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
import { checkMatcherLimit, resolveMatcherLimits, type MatcherLimits } from './limits.ts'

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
  #limits: MatcherLimits
  #sourceBytes = 0
  #compiledStates = 0
  #captureMetadata = 0

  constructor(options?: { ignoreCase?: boolean; limits?: Partial<MatcherLimits> }) {
    this.ignoreCase = options?.ignoreCase ?? false
    this.#limits = resolveMatcherLimits(options?.limits)
  }

  insert(pattern: RoutePattern, data: data): void {
    let patternParts = pattern._parts
    let sourceBytes = new TextEncoder().encode(pattern.source).length
    checkMatcherLimit('maxPatternSourceBytes', this.#limits.maxPatternSourceBytes, sourceBytes)
    checkMatcherLimit(
      'maxMatcherSourceBytes',
      this.#limits.maxMatcherSourceBytes,
      this.#sourceBytes + sourceBytes,
    )

    let hostname = patternParts.hostname
      ? compilePart(patternParts.hostname, { ignoreCase: true })
      : null
    let pathname = compilePart(patternParts.pathname, { ignoreCase: this.ignoreCase })
    let compiledStates =
      (hostname === null ? 0 : hostname.tokens.length + 1) + pathname.tokens.length + 1
    let captureMetadata = countCaptures(patternParts)

    checkMatcherLimit(
      'maxCompiledStates',
      this.#limits.maxCompiledStates,
      this.#compiledStates + compiledStates,
    )
    checkMatcherLimit(
      'maxCaptureMetadata',
      this.#limits.maxCaptureMetadata,
      this.#captureMetadata + captureMetadata,
    )
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
    this.#sourceBytes += sourceBytes
    this.#compiledStates += compiledStates
    this.#captureMetadata += captureMetadata
  }

  search(url: URL): Array<Match<string, data>> {
    let protocol = url.protocol.slice(0, -1)
    if (protocol !== 'http' && protocol !== 'https') return []

    let pathname = canonicalizeUrlPart(url.pathname.slice(1), 'pathname', {
      ignoreCase: this.ignoreCase,
    })
    if (pathname === null) return []

    let candidates = this.#findCandidates(pathname)
    candidates.sort((a, b) => a.insertion - b.insertion)

    let decodedHostname = decodeHostname(url.hostname)
    let hostname = canonicalizeUrlPart(decodedHostname, 'hostname', { ignoreCase: true })
    if (hostname === null) return []

    let results: Array<Match<string, data>> = []
    for (let entry of candidates) {
      if (!matchesProtocol(entry.patternParts.protocol, protocol)) continue
      if (!matchesPort(entry.patternParts, protocol, url.port)) continue
      if (!matchSearch(url.searchParams, entry.patternParts.search)) continue

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
        let match = matchPart(entry.hostname, hostname, this.#limits)
        if (match === null) continue
        hostnameMatch = match
      }

      let pathnameMatch = matchPart(entry.pathname, pathname, this.#limits)
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

  #findCandidates(pathname: CanonicalText): Array<Entry<data>> {
    let result = collectCandidates(this.#pathnamePrefixIndex, pathname.units)
    if (result.length > maxCandidatesBeforeSecondaryIndex) {
      let suffix = collectCandidates(this.#pathnameSuffixIndex, pathname.units.toReversed())
      if (suffix.length < result.length) result = suffix
    }
    if (result.length > maxCandidatesBeforeSecondaryIndex) {
      let anchor = collectAnchorCandidates(this.#pathnameAnchorIndex, pathname.units)
      if (anchor.length < result.length) result = anchor
    }
    return result.filter(
      (entry) =>
        hasStaticPrefix(entry.pathname, pathname) &&
        hasStaticSuffix(entry.pathname, pathname) &&
        hasStaticAnchor(entry.pathname, pathname),
    )
  }
}

function collectCandidates<data>(
  index: PathnameIndexNode<data>,
  units: CanonicalText['units'],
): Array<Entry<data>> {
  let result: Array<Entry<data>> = []
  let node: PathnameIndexNode<data> | undefined = index
  result.push(...node.entries)

  for (let unit of units) {
    node = node.static.get(unitKey(unit))
    if (node === undefined) break
    result.push(...node.entries)
  }
  return result
}

function collectAnchorCandidates<data>(
  index: PathnameIndexNode<data>,
  units: CanonicalText['units'],
): Array<Entry<data>> {
  let result = new Set(index.entries)
  for (let position = 0; position < units.length; position++) {
    let node: PathnameIndexNode<data> | undefined = index
    for (let i = position; i < units.length; i++) {
      node = node.static.get(unitKey(units[i]))
      if (node === undefined) break
      for (let entry of node.entries) result.add(entry)
    }
  }
  return Array.from(result)
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
): boolean {
  for (let [name, requiredValues] of constraints) {
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

function countCaptures(pattern: RoutePatternParts): number {
  let result = 0
  for (let token of pattern.hostname?.tokens ?? []) {
    if (token.type === ':' || token.type === '*') result += 1
  }
  for (let token of pattern.pathname.tokens) {
    if (token.type === ':' || token.type === '*') result += 1
  }
  return result
}
