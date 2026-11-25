import type { PartPattern, RoutePattern, RoutePatternParts } from '../route-pattern.ts'
import { parsePattern } from '../route-pattern/parse.ts'
import { serializePattern } from '../route-pattern/serialize.ts'
import { compare, compareHostnameRanges, comparePathnameRanges } from '../specificity.ts'
import { decodeHostname } from './punycode.ts'
import {
  canonicalizePatternSegmentText,
  canonicalizeUrlPart,
  compilePart,
  encodedPathnameLength,
  ensureUnitProgram,
  matchPartString,
  matchPartUnits,
} from './program.ts'
import type { CanonicalText, PartProgram } from './program.ts'
import type { Match, MatchParamMeta } from './types.ts'
import { checkMatcherLimit, consumeMatchWork, resolveMatcherLimits } from './limits.ts'
import type { MatcherLimits, MatchWorkBudget } from './limits.ts'

const emptyStrings: ReadonlyArray<string> = []
const emptyMeta: ReadonlyArray<MatchParamMeta> = []

type Entry<data> = {
  readonly pattern: RoutePattern
  readonly patternParts: RoutePatternParts
  readonly data: data
  readonly insertion: number
  readonly protocolRank: 0 | 1
  readonly portRank: 0 | 1
  readonly searchKeyValue: number
  readonly searchKey: number
  readonly allCaptureNames: ReadonlyArray<string>
  // For dynamic-hostname trie entries, param names in right-to-left label order
  readonly hostnameParamNames: ReadonlyArray<string>
  readonly hostnameWildcardName: string | null
  readonly hostnameProgram: PartProgram | null
  readonly pathnameProgram: PartProgram | null
}

type PathLeaf<data> = {
  readonly entry: Entry<data>
  readonly paramNames: ReadonlyArray<string>
  readonly wildcardName: string | null
}

type PathTrieNode<data> = {
  staticKey: string | null
  staticChild: PathTrieNode<data> | null
  static: Map<string, PathTrieNode<data>> | null
  param: PathTrieNode<data> | null
  optParam: PathTrieNode<data> | null
  trailingWildcards: Array<PathLeaf<data>> | null
  complex: Array<Entry<data>> | null
  entries: Array<PathLeaf<data>> | null
}

type PathTrie<data> = {
  staticMap: Map<string, Array<PathLeaf<data>>> | null
  root: PathTrieNode<data> | null
  suffixRoot: PathTrieNode<data> | null
  hasOptParam: boolean
  hasComplex: boolean
  hasMixedOriginRank: boolean
  firstProtocolRank: -1 | 0 | 1
  firstPortRank: -1 | 0 | 1
}

type HostTrieNode<data> = {
  static: Map<string, HostTrieNode<data>> | null
  param: HostTrieNode<data> | null
  leadingWildcards: PathTrie<data> | null
  pathTrie: PathTrie<data> | null
}

type DecodedSegment = {
  readonly decoded: string
  readonly decodedStart: number
  readonly hasStructuralDot: boolean
  readonly hasNonStructuralSep: boolean
  readonly encBegin: number
  readonly encEnd: number
}

type DecodedPathname = {
  readonly segments: ReadonlyArray<DecodedSegment>
  readonly fullDecoded: string
  readonly totalEncLen: number
  readonly anyNonStructuralSep: boolean
}

type PendingCapture = {
  readonly segStart: number
  readonly segEnd: number
  readonly decodedSegIndex: number
  readonly omitted: boolean
}

type DeferredPath<data> = {
  readonly leaf: PathLeaf<data>
  readonly caps: ReadonlyArray<PendingCapture> | null
  readonly wildcardStart: number
  readonly wildcardDecodedSeg: number
}

type CandidateMatch<data> = {
  readonly entry: Entry<data>
  readonly hostnameMeta: ReadonlyArray<MatchParamMeta>
  pathnameMeta: ReadonlyArray<MatchParamMeta>
  deferred: DeferredPath<data> | null
}

type MatchContext = {
  readonly url: URL
  readonly proto: 'http:' | 'https:'
  readonly rawPath: string
  readonly decodedPath: DecodedPathname | null
  readonly budget: MatchWorkBudget
  readonly ignoreCase: boolean
  lowerHostname: string | null
  canonicalHost: CanonicalText | null | undefined
  canonicalPath: CanonicalText | null | undefined
}

type PathSegmentSpec =
  | { readonly kind: 'static'; readonly text: string }
  | { readonly kind: 'param'; readonly name: string }
  | { readonly kind: 'optParam'; readonly name: string }

type PathClassification =
  | { readonly kind: 'static'; readonly key: string }
  | {
      readonly kind: 'trie'
      readonly segments: ReadonlyArray<PathSegmentSpec>
      readonly terminalIndices: ReadonlyArray<number>
      readonly trailingWildcard: string | null
    }
  | {
      readonly kind: 'complex'
      readonly leadingPrefix: ReadonlyArray<PathSegmentSpec>
      readonly trailingSuffix: ReadonlyArray<PathSegmentSpec>
    }

type HostClassification =
  | { readonly kind: 'none' }
  | { readonly kind: 'static'; readonly host: string }
  | {
      readonly kind: 'trie'
      readonly labels: ReadonlyArray<
        | { readonly kind: 'static'; readonly text: string }
        | { readonly kind: 'param'; readonly name: string }
      >
      readonly leadingWildcard: string | null
    }
  | { readonly kind: 'complex' }

// Reusable growable capture stacks for synchronous, non-reentrant trie traversal
const capStacks = {
  type: new Uint8Array(256), // 0 = ':', 2 = omitted optParam
  begin: new Int32Array(256),
  end: new Int32Array(256),
  segIdx: new Int32Array(256),
  lastFastInsertion: 0,
}

function setCapFrame(
  depth: number,
  type: number,
  begin: number,
  end: number,
  segIdx: number,
): void {
  if (depth >= capStacks.type.length) {
    let nextLen = capStacks.type.length
    while (nextLen <= depth) nextLen *= 2

    let nextType = new Uint8Array(nextLen)
    nextType.set(capStacks.type)
    capStacks.type = nextType

    let nextBegin = new Int32Array(nextLen)
    nextBegin.set(capStacks.begin)
    capStacks.begin = nextBegin

    let nextEnd = new Int32Array(nextLen)
    nextEnd.set(capStacks.end)
    capStacks.end = nextEnd

    let nextSegIdx = new Int32Array(nextLen)
    nextSegIdx.set(capStacks.segIdx)
    capStacks.segIdx = nextSegIdx
  }
  capStacks.type[depth] = type
  capStacks.begin[depth] = begin
  capStacks.end[depth] = end
  capStacks.segIdx[depth] = segIdx
}

export class Trie<data = unknown> {
  readonly ignoreCase: boolean
  readonly #limits: MatcherLimits
  readonly #budget: MatchWorkBudget
  #insertion = 0
  #size = 0

  #pathnameOnlyTrie: PathTrie<data> = createPathTrie<data>()
  #hasOriginPatterns = false
  #hasFullWildcardHostname = false
  #staticHostTries: Map<string, PathTrie<data>> | null = null
  #dynamicHostRoot: HostTrieNode<data> | null = null
  #complexHostEntries: Array<Entry<data>> | null = null

  constructor(options?: { ignoreCase?: boolean; limits?: Partial<MatcherLimits> }) {
    this.ignoreCase = options?.ignoreCase ?? false
    this.#limits = resolveMatcherLimits(options?.limits)
    this.#budget = { maximum: this.#limits.maxMatchWork, actual: 0 }
  }

  insert(pattern: string | RoutePattern, data: data): void {
    if (typeof pattern === 'string') {
      let rawSize = utf8Size(pattern)
      checkMatcherLimit('maxPatternSize', this.#limits.maxPatternSize, rawSize)
      checkMatcherLimit('maxMatcherSize', this.#limits.maxMatcherSize, this.#size + rawSize)
      pattern = parsePattern(pattern)
    }

    let parts = pattern._parts
    let canonicalSize = utf8Size(serializePattern(parts))
    checkMatcherLimit('maxPatternSize', this.#limits.maxPatternSize, canonicalSize)
    checkMatcherLimit('maxMatcherSize', this.#limits.maxMatcherSize, this.#size + canonicalSize)

    let hostClass = classifyHostname(parts.hostname)
    let pathClass = classifyPathname(parts.pathname, this.ignoreCase)

    let protocolRank: 0 | 1 = parts.protocol === 'http' || parts.protocol === 'https' ? 1 : 0
    let portRank: 0 | 1 = parts.port !== null ? 1 : 0

    let searchKeyValue = 0
    let searchKey = 0
    for (let constraint of parts.search.values()) {
      if (constraint.size === 0) searchKey += 1
      else searchKeyValue += constraint.size
    }

    let hostnameParamNames: ReadonlyArray<string> = emptyStrings
    let hostnameWildcardName: string | null = null
    let hostnameProgram: PartProgram | null = null
    if (hostClass.kind === 'trie') {
      let names: Array<string> = []
      for (let label of hostClass.labels) {
        if (label.kind === 'param') names.push(label.name)
      }
      hostnameParamNames = names.length > 0 ? names : emptyStrings
      hostnameWildcardName = hostClass.leadingWildcard
      if (hostClass.labels.length === 0 && hostClass.leadingWildcard !== null) {
        this.#hasFullWildcardHostname = true
      }
    } else if (hostClass.kind === 'complex') {
      hostnameProgram = compilePart(parts.hostname!, { ignoreCase: true })
      this.#hasFullWildcardHostname = true
    }

    let pathnameProgram: PartProgram | null =
      pathClass.kind === 'complex' || hostClass.kind === 'complex'
        ? compilePart(parts.pathname, { ignoreCase: this.ignoreCase })
        : null

    let entry: Entry<data> = {
      pattern,
      patternParts: parts,
      data,
      insertion: this.#insertion++,
      protocolRank,
      portRank,
      searchKeyValue,
      searchKey,
      allCaptureNames: collectAllCaptureNames(parts),
      hostnameParamNames,
      hostnameWildcardName,
      hostnameProgram,
      pathnameProgram,
    }

    if (hostClass.kind === 'none') {
      insertIntoPathTrie(this.#pathnameOnlyTrie, pathClass, entry)
    } else {
      this.#hasOriginPatterns = true
      if (hostClass.kind === 'static') {
        this.#staticHostTries ??= new Map()
        let pathTrie = this.#staticHostTries.get(hostClass.host)
        if (pathTrie === undefined) {
          pathTrie = createPathTrie<data>()
          this.#staticHostTries.set(hostClass.host, pathTrie)
        }
        insertIntoPathTrie(pathTrie, pathClass, entry)
      } else if (hostClass.kind === 'trie') {
        let node = (this.#dynamicHostRoot ??= createHostTrieNode<data>())
        for (let label of hostClass.labels) {
          if (label.kind === 'static') {
            node.static ??= new Map()
            let next = node.static.get(label.text)
            if (next === undefined) {
              next = createHostTrieNode<data>()
              node.static.set(label.text, next)
            }
            node = next
          } else {
            node = node.param ??= createHostTrieNode<data>()
          }
        }
        let targetTrie =
          hostClass.leadingWildcard !== null
            ? (node.leadingWildcards ??= createPathTrie<data>())
            : (node.pathTrie ??= createPathTrie<data>())
        insertIntoPathTrie(targetTrie, pathClass, entry)
      } else {
        this.#complexHostEntries ??= []
        this.#complexHostEntries.push(entry)
      }
    }

    this.#size += canonicalSize
  }

  #prepare(url: URL): MatchContext | null {
    let proto = url.protocol
    if (proto !== 'https:' && proto !== 'http:') return null
    if (this.#insertion === 0) return null

    let budget = this.#budget
    budget.actual = 0

    let rawPathname = url.pathname
    consumeMatchWork(budget, rawPathname.length - 1)

    let hasPercent = rawPathname.indexOf('%') !== -1
    let decodedPath: DecodedPathname | null = null
    let rawPath: string
    if (hasPercent) {
      decodedPath = decodeUrlPathname(rawPathname, this.ignoreCase, budget)
      if (decodedPath === null) return null
      rawPath = '/' + decodedPath.fullDecoded
    } else {
      rawPath = this.ignoreCase ? rawPathname.toLowerCase() : rawPathname
    }

    return {
      url,
      proto,
      rawPath,
      decodedPath,
      budget,
      ignoreCase: this.ignoreCase,
      lowerHostname: null,
      canonicalHost: undefined,
      canonicalPath: undefined,
    }
  }

  matchBest(url: URL): Match<string, data> | null {
    let ctx = this.#prepare(url)
    if (ctx === null) return null

    if (!this.#hasOriginPatterns) {
      let pathTrie = this.#pathnameOnlyTrie
      let fastEligible =
        ctx.decodedPath === null &&
        !pathTrie.hasComplex &&
        !pathTrie.hasMixedOriginRank &&
        !(pathTrie.hasOptParam && hasEmptyPathSegment(ctx.rawPath))

      // O(1) static exact match fast path
      if (fastEligible && pathTrie.staticMap !== null) {
        let leaves = pathTrie.staticMap.get(ctx.rawPath)
        if (leaves !== undefined) {
          let winner = findFirstMatchingLeaf(leaves, ctx)
          if (winner !== null) {
            return buildMatch(url, winner.entry, wildcardHostMeta(url), emptyMeta)
          }
        }
      }

      // Direct zero-intermediate-allocation dynamic trie fast path
      if (
        fastEligible &&
        pathTrie.root !== null &&
        pathTrie.firstProtocolRank === 0 &&
        pathTrie.firstPortRank === 0
      ) {
        return matchRawOriginlessFast(pathTrie.root, ctx.rawPath, 1, 0, ctx)
      }

      let best = searchPathTrieBest(pathTrie, ctx, emptyMeta, null, null)
      if (best === null) return null
      return buildMatch(url, best.entry, wildcardHostMeta(url), resolveCandidatePathMeta(best, ctx))
    }

    let rawHostname = url.hostname
    consumeMatchWork(ctx.budget, rawHostname.length)
    let decodedHostname = decodeHostname(rawHostname)
    ctx.lowerHostname = decodedHostname.toLowerCase()
    let best: CandidateMatch<data> | null = null

    if (this.#staticHostTries !== null) {
      let staticHostTrie = this.#staticHostTries.get(ctx.lowerHostname)
      if (staticHostTrie !== undefined) {
        best = searchPathTrieBest(staticHostTrie, ctx, emptyMeta, best, null)
      }
    }

    if (this.#dynamicHostRoot !== null) {
      walkDynamicHostTrie(this.#dynamicHostRoot, ctx, (pathTrie, filter) => {
        best = searchPathTrieBest(pathTrie, ctx, emptyMeta, best, filter)
      })
    }

    if (this.#complexHostEntries !== null) {
      forEachComplexHostMatch(this.#complexHostEntries, ctx, (entry, hMeta, pMeta) => {
        best = pickBetterCandidate(
          best,
          { entry, hostnameMeta: hMeta, pathnameMeta: pMeta, deferred: null },
          ctx,
        )
      })
    }

    // Only check origin-less routes if they could still beat an explicit-hostname match
    if (
      best === null ||
      this.#hasFullWildcardHostname ||
      this.#pathnameOnlyTrie.firstProtocolRank === 1 ||
      this.#pathnameOnlyTrie.hasMixedOriginRank
    ) {
      let hostMeta: ReadonlyArray<MatchParamMeta> = [
        { type: '*', name: '*', value: decodedHostname, begin: 0, end: decodedHostname.length },
      ]
      best = searchPathTrieBest(this.#pathnameOnlyTrie, ctx, hostMeta, best, null)
    }

    if (best === null) return null
    return buildMatch(url, best.entry, best.hostnameMeta, resolveCandidatePathMeta(best, ctx))
  }

  searchAll(url: URL): Array<Match<string, data>> {
    let ctx = this.#prepare(url)
    if (ctx === null) return []

    let decodedHostname = decodeHostname(url.hostname)
    let wildcardHost: ReadonlyArray<MatchParamMeta> = [
      { type: '*', name: '*', value: decodedHostname, begin: 0, end: decodedHostname.length },
    ]

    let results: Array<{ match: Match<string, data>; insertion: number }> = []
    let leafBatchCount = 0
    let singleBatchAlreadySorted = true

    let onLeafBatch = (sorted: boolean) => {
      leafBatchCount += 1
      if (!sorted || leafBatchCount > 1) singleBatchAlreadySorted = false
    }

    searchPathTrieAll(this.#pathnameOnlyTrie, ctx, wildcardHost, results, onLeafBatch, null)

    if (this.#hasOriginPatterns) {
      consumeMatchWork(ctx.budget, url.hostname.length)
      ctx.lowerHostname = decodedHostname.toLowerCase()

      if (this.#staticHostTries !== null) {
        let staticHostTrie = this.#staticHostTries.get(ctx.lowerHostname)
        if (staticHostTrie !== undefined) {
          searchPathTrieAll(staticHostTrie, ctx, emptyMeta, results, onLeafBatch, null)
        }
      }

      if (this.#dynamicHostRoot !== null) {
        walkDynamicHostTrie(this.#dynamicHostRoot, ctx, (pathTrie, filter) => {
          searchPathTrieAll(pathTrie, ctx, emptyMeta, results, onLeafBatch, filter)
        })
      }

      if (this.#complexHostEntries !== null) {
        forEachComplexHostMatch(this.#complexHostEntries, ctx, (entry, hMeta, pMeta) => {
          results.push({ match: buildMatch(url, entry, hMeta, pMeta), insertion: entry.insertion })
          onLeafBatch(false)
        })
      }
    }

    if (results.length <= 1) {
      return results.length === 1 ? [results[0].match] : []
    }

    if (!singleBatchAlreadySorted) {
      results.sort((a, b) => compare(b.match, a.match) || a.insertion - b.insertion)
    }

    let out = new Array<Match<string, data>>(results.length)
    for (let i = 0; i < results.length; i++) out[i] = results[i].match
    return out
  }
}

// ============================================================================
// Pattern Classification & Insertion
// ============================================================================

function parseSegmentSpec(
  tokens: ReadonlyArray<PartPattern['tokens'][number]>,
  start: number,
  len: number,
  partKind: PartPattern['type'],
  ignoreCase: boolean,
):
  | { readonly kind: 'static'; readonly text: string }
  | { readonly kind: 'param'; readonly name: string }
  | null {
  if (len === 0) return { kind: 'static', text: '' }
  if (len !== 1) return null
  let tok = tokens[start]
  if (tok.type === 'text') {
    let canon = canonicalizePatternSegmentText(tok.text, partKind, ignoreCase)
    return canon.hasNonStructuralSep ? null : { kind: 'static', text: canon.text }
  }
  if (tok.type === ':') return { kind: 'param', name: tok.name }
  return null
}

function classifyHostname(part: PartPattern | null): HostClassification {
  if (part === null) return { kind: 'none' }

  let tokens = part.tokens
  if (tokens.length === 0) return { kind: 'static', host: '' }
  if (part.optionals.size > 0) return { kind: 'complex' }

  let labels: Array<
    | { readonly kind: 'static'; readonly text: string }
    | { readonly kind: 'param'; readonly name: string }
  > = []
  let leadingWildcard: string | null = null
  let hasDynamic = false
  let i = 0

  while (true) {
    let segStart = i
    while (i < tokens.length && tokens[i].type !== 'separator') i += 1
    let segLen = i - segStart

    if (segLen === 1 && tokens[segStart].type === '*') {
      if (labels.length !== 0 || leadingWildcard !== null) return { kind: 'complex' }
      leadingWildcard = (tokens[segStart] as { type: '*'; name: string }).name
      hasDynamic = true
    } else {
      let spec = parseSegmentSpec(tokens, segStart, segLen, 'hostname', true)
      if (spec === null) return { kind: 'complex' }
      if (spec.kind === 'param') hasDynamic = true
      labels.push(spec)
    }

    if (i >= tokens.length) break
    i += 1
  }

  if (!hasDynamic) {
    let host = ''
    for (let j = 0; j < labels.length; j++) {
      if (j > 0) host += '.'
      host += (labels[j] as { kind: 'static'; text: string }).text
    }
    return { kind: 'static', host }
  }

  labels.reverse()
  return { kind: 'trie', labels, leadingWildcard }
}

function classifyPathname(part: PartPattern, ignoreCase: boolean): PathClassification {
  let tokens = part.tokens
  if (tokens.length === 0) return { kind: 'static', key: '/' }

  if (part.optionals.size === 0) {
    let hasDynamic = false
    for (let i = 0; i < tokens.length; i++) {
      let t = tokens[i].type
      if (t === ':' || t === '*') {
        hasDynamic = true
        break
      }
    }
    if (!hasDynamic) {
      let key = '/'
      for (let i = 0; i < tokens.length; i++) {
        let tok = tokens[i]
        if (tok.type === 'separator') {
          key += '/'
        } else if (tok.type === 'text') {
          let canon = canonicalizePatternSegmentText(tok.text, 'pathname', ignoreCase)
          if (canon.hasNonStructuralSep) {
            return { kind: 'complex', leadingPrefix: [], trailingSuffix: [] }
          }
          key += canon.text
        }
      }
      return { kind: 'static', key }
    }
  }

  let segments: Array<PathSegmentSpec> = []
  let terminalIndices: Array<number> = []
  let trailingWildcard: string | null = null
  let expectedCloseIdx = tokens.length - 1
  let optParamCount = 0
  let i = 0
  let canBeTrie = true

  while (true) {
    if (i < tokens.length && tokens[i].type === '*') {
      if (i === expectedCloseIdx) {
        trailingWildcard = (tokens[i] as { type: '*'; name: string }).name
        break
      }
      canBeTrie = false
      break
    }

    // Whole-segment (:param) optional
    if (
      i + 2 < tokens.length &&
      tokens[i].type === '(' &&
      tokens[i + 1].type === ':' &&
      tokens[i + 2].type === ')' &&
      optParamCount < 2
    ) {
      let after = i + 3
      let optName = (tokens[i + 1] as { type: ':'; name: string }).name
      let isEnd = after > expectedCloseIdx
      let isSep = !isEnd && tokens[after].type === 'separator'
      let isTrailingOpt =
        !isEnd &&
        !isSep &&
        tokens[after].type === '(' &&
        part.optionals.get(after) === expectedCloseIdx &&
        after + 1 < tokens.length &&
        tokens[after + 1].type === 'separator'

      if (!isEnd && !isSep && !isTrailingOpt) {
        canBeTrie = false
        break
      }

      segments.push({ kind: 'optParam', name: optName })
      optParamCount += 1
      if (isEnd) {
        terminalIndices.push(segments.length)
        break
      }
      if (isSep) {
        i = after + 1
        continue
      }
      terminalIndices.push(segments.length)
      expectedCloseIdx -= 1
      i = after + 2
      continue
    }

    let segStart = i
    while (i <= expectedCloseIdx && tokens[i].type !== 'separator' && tokens[i].type !== '(') {
      i += 1
    }
    let spec = parseSegmentSpec(tokens, segStart, i - segStart, 'pathname', ignoreCase)
    if (spec === null) {
      canBeTrie = false
      break
    }
    segments.push(spec)

    if (i > expectedCloseIdx) {
      terminalIndices.push(segments.length)
      break
    }

    if (tokens[i].type === 'separator') {
      i += 1
      continue
    }

    if (
      tokens[i].type === '(' &&
      part.optionals.get(i) === expectedCloseIdx &&
      i + 1 <= expectedCloseIdx &&
      tokens[i + 1].type === 'separator'
    ) {
      terminalIndices.push(segments.length)
      expectedCloseIdx -= 1
      i += 2
      continue
    }

    canBeTrie = false
    break
  }

  if (canBeTrie) {
    return { kind: 'trie', segments, terminalIndices, trailingWildcard }
  }

  let leadingPrefix = extractComplexLeadingPrefix(part, ignoreCase)
  let trailingSuffix =
    leadingPrefix.length === 0 ? extractComplexTrailingSuffix(part, ignoreCase) : []
  return { kind: 'complex', leadingPrefix, trailingSuffix }
}

function extractComplexLeadingPrefix(
  part: PartPattern,
  ignoreCase: boolean,
): Array<PathSegmentSpec> {
  let tokens = part.tokens
  let prefix: Array<PathSegmentSpec> = []
  let i = 0

  while (i < tokens.length) {
    let segStart = i
    while (i < tokens.length && tokens[i].type !== 'separator' && tokens[i].type !== '(') {
      i += 1
    }
    let segLen = i - segStart
    if (segLen === 0 && (i >= tokens.length || tokens[i].type !== 'separator')) break
    let seg = parseSegmentSpec(tokens, segStart, segLen, 'pathname', ignoreCase)
    if (seg === null) break

    if (i >= tokens.length) {
      prefix.push(seg)
      break
    }
    if (tokens[i].type === 'separator') {
      prefix.push(seg)
      i += 1
      continue
    }
    if (allNextAreSeparatorOrEnd(tokens, part.optionals, i)) {
      prefix.push(seg)
    }
    break
  }

  return prefix
}

function allNextAreSeparatorOrEnd(
  tokens: ReadonlyArray<PartPattern['tokens'][number]>,
  optionals: ReadonlyMap<number, number>,
  start: number,
): boolean {
  let stack = [start]
  let visited = new Set<number>()
  while (stack.length > 0) {
    let idx = stack.pop()!
    if (visited.has(idx)) continue
    visited.add(idx)
    if (idx >= tokens.length) continue
    let tok = tokens[idx]
    if (tok.type === 'separator') continue
    if (tok.type === '(') {
      let end = optionals.get(idx)
      if (end === undefined) return false
      stack.push(idx + 1, end + 1)
    } else if (tok.type === ')') {
      stack.push(idx + 1)
    } else {
      return false
    }
  }
  return true
}

function extractComplexTrailingSuffix(
  part: PartPattern,
  ignoreCase: boolean,
): Array<PathSegmentSpec> {
  let tokens = part.tokens
  let suffix: Array<PathSegmentSpec> = []
  let i = tokens.length - 1

  while (i >= 0) {
    let segEnd = i + 1
    while (i >= 0 && tokens[i].type !== 'separator') {
      let t = tokens[i].type
      if (t === '(' || t === ')' || t === '*') return suffix
      i -= 1
    }
    if (i < 0 || tokens[i].type !== 'separator') break

    let seg = parseSegmentSpec(tokens, i + 1, segEnd - (i + 1), 'pathname', ignoreCase)
    if (seg === null) break
    suffix.push(seg)
    i -= 1
  }

  return suffix
}

function addStaticLeaf<data>(pathTrie: PathTrie<data>, key: string, entry: Entry<data>): void {
  pathTrie.staticMap ??= new Map()
  let leaf: PathLeaf<data> = { entry, paramNames: emptyStrings, wildcardName: null }
  let list = pathTrie.staticMap.get(key)
  if (list === undefined) pathTrie.staticMap.set(key, [leaf])
  else insertSortedLeaf(list, leaf)
}

function descendSpecs<data>(
  root: PathTrieNode<data>,
  specs: ReadonlyArray<PathSegmentSpec>,
): PathTrieNode<data> {
  let node = root
  for (let seg of specs) {
    node =
      seg.kind === 'static'
        ? getOrCreatePathStaticChild(node, seg.text)
        : (node.param ??= createPathTrieNode<data>())
  }
  return node
}

function insertIntoPathTrie<data>(
  pathTrie: PathTrie<data>,
  pathClass: PathClassification,
  entry: Entry<data>,
): void {
  if (pathTrie.firstProtocolRank === -1) {
    pathTrie.firstProtocolRank = entry.protocolRank
    pathTrie.firstPortRank = entry.portRank
  } else if (
    pathTrie.firstProtocolRank !== entry.protocolRank ||
    pathTrie.firstPortRank !== entry.portRank
  ) {
    pathTrie.hasMixedOriginRank = true
  }

  if (pathClass.kind === 'static') {
    addStaticLeaf(pathTrie, pathClass.key, entry)
    return
  }

  let root = (pathTrie.root ??= createPathTrieNode<data>())

  if (pathClass.kind === 'trie') {
    let node = root
    let paramNames: Array<string> = []
    let staticPrefixSoFar = ''
    let allStaticSoFar = true
    let termPos = 0

    for (let s = 0; s < pathClass.segments.length; s++) {
      let seg = pathClass.segments[s]
      if (seg.kind === 'static') {
        if (allStaticSoFar) staticPrefixSoFar += '/' + seg.text
        node = getOrCreatePathStaticChild(node, seg.text)
      } else if (seg.kind === 'param') {
        allStaticSoFar = false
        paramNames.push(seg.name)
        node = node.param ??= createPathTrieNode<data>()
      } else {
        allStaticSoFar = false
        pathTrie.hasOptParam = true
        paramNames.push(seg.name)
        node = node.optParam ??= createPathTrieNode<data>()
      }

      if (
        termPos < pathClass.terminalIndices.length &&
        pathClass.terminalIndices[termPos] === s + 1
      ) {
        termPos += 1
        if (allStaticSoFar) {
          addStaticLeaf(pathTrie, staticPrefixSoFar, entry)
        } else {
          let leaf: PathLeaf<data> = {
            entry,
            paramNames: paramNames.length > 0 ? paramNames.slice() : emptyStrings,
            wildcardName: null,
          }
          if (node.entries === null) node.entries = [leaf]
          else insertSortedLeaf(node.entries, leaf)
        }
      }
    }

    if (pathClass.trailingWildcard !== null) {
      let leaf: PathLeaf<data> = {
        entry,
        paramNames: paramNames.length > 0 ? paramNames.slice() : emptyStrings,
        wildcardName: pathClass.trailingWildcard,
      }
      if (node.trailingWildcards === null) node.trailingWildcards = [leaf]
      else insertSortedLeaf(node.trailingWildcards, leaf)
    }
    return
  }

  pathTrie.hasComplex = true
  let target =
    pathClass.leadingPrefix.length > 0
      ? descendSpecs(root, pathClass.leadingPrefix)
      : pathClass.trailingSuffix.length > 0
        ? descendSpecs(
            (pathTrie.suffixRoot ??= createPathTrieNode<data>()),
            pathClass.trailingSuffix,
          )
        : root
  if (target.complex === null) target.complex = [entry]
  else target.complex.push(entry)
}

function insertSortedLeaf<data>(list: Array<PathLeaf<data>>, leaf: PathLeaf<data>): void {
  let e = leaf.entry
  let idx = list.length
  while (idx > 0) {
    let prev = list[idx - 1].entry
    if (compareStaticEntryPriority(prev, e) <= 0) break
    idx -= 1
  }
  if (idx === list.length) list.push(leaf)
  else list.splice(idx, 0, leaf)
}

function compareStaticEntryPriority<data>(a: Entry<data>, b: Entry<data>): number {
  if (a.protocolRank !== b.protocolRank) return b.protocolRank - a.protocolRank
  if (a.portRank !== b.portRank) return b.portRank - a.portRank
  if (a.searchKeyValue !== b.searchKeyValue) return b.searchKeyValue - a.searchKeyValue
  if (a.searchKey !== b.searchKey) return b.searchKey - a.searchKey
  return a.insertion - b.insertion
}

// ============================================================================
// Entry & Complex Part Matching Helpers
// ============================================================================

function entryMatchesUrl<data>(entry: Entry<data>, ctx: MatchContext): boolean {
  consumeMatchWork(ctx.budget, 1)
  if (!matchesProtocolAndPort(entry.patternParts, ctx.proto, ctx.url.port)) return false
  if (
    entry.patternParts.search.size > 0 &&
    !matchSearch(ctx.url, entry.patternParts.search, ctx.budget)
  ) {
    return false
  }
  return true
}

function findFirstMatchingLeaf<data>(
  leaves: ReadonlyArray<PathLeaf<data>> | null,
  ctx: MatchContext,
): PathLeaf<data> | null {
  if (leaves === null) return null
  for (let i = 0; i < leaves.length; i++) {
    if (entryMatchesUrl(leaves[i].entry, ctx)) return leaves[i]
  }
  return null
}

function matchComplexHostname<data>(
  entry: Entry<data>,
  ctx: MatchContext,
): ReadonlyArray<MatchParamMeta> | null {
  let program = entry.hostnameProgram!
  if (!program.hasNonStructuralSep) {
    return matchPartString(program, ctx.lowerHostname!, ctx.budget)
  }
  if (ctx.canonicalHost === undefined) {
    ctx.canonicalHost = canonicalizeUrlPart(ctx.lowerHostname!, 'hostname', {
      budget: ctx.budget,
      ignoreCase: true,
    })
  }
  if (ctx.canonicalHost === null) return null
  let unitTokens = ensureUnitProgram(entry.patternParts.hostname!, program, true)
  return matchPartUnits(unitTokens, 'hostname', ctx.canonicalHost, ctx.budget)
}

function matchComplexPathname<data>(
  entry: Entry<data>,
  ctx: MatchContext,
): ReadonlyArray<MatchParamMeta> | null {
  let program = entry.pathnameProgram!
  if (
    !program.hasNonStructuralSep &&
    (ctx.decodedPath === null || !ctx.decodedPath.anyNonStructuralSep)
  ) {
    return matchPartString(program, ctx.rawPath.slice(1), ctx.budget)
  }
  if (ctx.canonicalPath === undefined) {
    ctx.canonicalPath = canonicalizeUrlPart(ctx.url.pathname.slice(1), 'pathname', {
      budget: ctx.budget,
      ignoreCase: ctx.ignoreCase,
    })
  }
  if (ctx.canonicalPath === null) return null
  let unitTokens = ensureUnitProgram(entry.patternParts.pathname, program, ctx.ignoreCase)
  return matchPartUnits(unitTokens, 'pathname', ctx.canonicalPath, ctx.budget)
}

// ============================================================================
// Direct Fast Path (`match()` on origin-less dynamic tries)
// ============================================================================

function matchRawOriginlessFast<data>(
  node: PathTrieNode<data>,
  rawPath: string,
  pos: number,
  capDepth: number,
  ctx: MatchContext,
): Match<string, data> | null {
  let len = rawPath.length
  while (true) {
    consumeMatchWork(ctx.budget, 1)
    let slash = rawPath.indexOf('/', pos)
    let segEnd = slash === -1 ? len : slash
    let isLastSeg = slash === -1
    let segLen = segEnd - pos

    let staticChild = lookupPathStaticRaw(node, rawPath, pos, segEnd, segLen)
    let hasAnyFallback =
      node.param !== null || node.optParam !== null || node.trailingWildcards !== null

    if (staticChild !== undefined) {
      if (!hasAnyFallback) {
        if (isLastSeg) return matchFastLeaf(staticChild.entries, capDepth, -1, rawPath, ctx)
        node = staticChild
        pos = slash + 1
        continue
      }
      let match = isLastSeg
        ? matchFastLeaf(staticChild.entries, capDepth, -1, rawPath, ctx)
        : matchRawOriginlessFast(staticChild, rawPath, slash + 1, capDepth, ctx)
      if (match !== null) return match
    }

    if (segLen === 0 && node.optParam !== null) {
      setCapFrame(capDepth, 2, pos, pos, -1)
      if (node.trailingWildcards === null) {
        if (isLastSeg) return matchFastLeaf(node.optParam.entries, capDepth + 1, -1, rawPath, ctx)
        node = node.optParam
        pos = slash + 1
        capDepth += 1
        continue
      }
      let match = isLastSeg
        ? matchFastLeaf(node.optParam.entries, capDepth + 1, -1, rawPath, ctx)
        : matchRawOriginlessFast(node.optParam, rawPath, slash + 1, capDepth + 1, ctx)
      if (match !== null) return match
    } else if (
      segLen > 0 &&
      (node.param !== null || node.optParam !== null) &&
      !hasDotInRange(rawPath, pos, segEnd)
    ) {
      setCapFrame(capDepth, 0, pos, segEnd, -1)

      if (node.param !== null && node.optParam !== null) {
        let paramMatch = isLastSeg
          ? matchFastLeaf(node.param.entries, capDepth + 1, -1, rawPath, ctx)
          : matchRawOriginlessFast(node.param, rawPath, slash + 1, capDepth + 1, ctx)
        let paramInsertion = capStacks.lastFastInsertion
        let optMatch = isLastSeg
          ? matchFastLeaf(node.optParam.entries, capDepth + 1, -1, rawPath, ctx)
          : matchRawOriginlessFast(node.optParam, rawPath, slash + 1, capDepth + 1, ctx)
        let optInsertion = capStacks.lastFastInsertion

        if (paramMatch !== null && optMatch !== null) {
          let cmp = compare(optMatch, paramMatch)
          let optWins = cmp > 0 || (cmp === 0 && optInsertion < paramInsertion)
          capStacks.lastFastInsertion = optWins ? optInsertion : paramInsertion
          return optWins ? optMatch : paramMatch
        }
        if (paramMatch !== null) {
          capStacks.lastFastInsertion = paramInsertion
          return paramMatch
        }
        if (optMatch !== null) {
          capStacks.lastFastInsertion = optInsertion
          return optMatch
        }
      } else {
        let nextNode = (node.param ?? node.optParam)!
        if (node.trailingWildcards === null) {
          if (isLastSeg) return matchFastLeaf(nextNode.entries, capDepth + 1, -1, rawPath, ctx)
          node = nextNode
          pos = slash + 1
          capDepth += 1
          continue
        }
        let match = isLastSeg
          ? matchFastLeaf(nextNode.entries, capDepth + 1, -1, rawPath, ctx)
          : matchRawOriginlessFast(nextNode, rawPath, slash + 1, capDepth + 1, ctx)
        if (match !== null) return match
      }
    }

    if (node.trailingWildcards !== null) {
      return matchFastLeaf(node.trailingWildcards, capDepth, pos, rawPath, ctx)
    }

    return null
  }
}

function matchFastLeaf<data>(
  leaves: ReadonlyArray<PathLeaf<data>> | null,
  capDepth: number,
  wildcardStart: number,
  rawPath: string,
  ctx: MatchContext,
): Match<string, data> | null {
  let leaf = findFirstMatchingLeaf(leaves, ctx)
  if (leaf === null) return null
  capStacks.lastFastInsertion = leaf.entry.insertion
  let pathnameMeta = buildPathMetaFromStacks(leaf, capDepth, wildcardStart, rawPath)
  return buildMatch(ctx.url, leaf.entry, wildcardHostMeta(ctx.url), pathnameMeta)
}

// ============================================================================
// General PathTrie Search (`match()` and `matchAll()`)
// ============================================================================

function searchPathTrieBest<data>(
  pathTrie: PathTrie<data>,
  ctx: MatchContext,
  hostnameMeta: ReadonlyArray<MatchParamMeta>,
  best: CandidateMatch<data> | null,
  hostEntryFilter: ((entry: Entry<data>) => ReadonlyArray<MatchParamMeta>) | null,
): CandidateMatch<data> | null {
  let canUseStaticMap = ctx.decodedPath === null || !ctx.decodedPath.anyNonStructuralSep

  if (canUseStaticMap && pathTrie.staticMap !== null) {
    let winner = findFirstMatchingLeaf(pathTrie.staticMap.get(ctx.rawPath) ?? null, ctx)
    if (winner !== null) {
      let entry = winner.entry
      let hMeta = hostEntryFilter !== null ? hostEntryFilter(entry) : hostnameMeta
      best = pickBetterCandidate(
        best,
        { entry, hostnameMeta: hMeta, pathnameMeta: emptyMeta, deferred: null },
        ctx,
      )

      if (
        best.pathnameMeta.length === 0 &&
        best.deferred === null &&
        !pathTrie.hasComplex &&
        !pathTrie.hasMixedOriginRank &&
        !(pathTrie.hasOptParam && hasEmptyPathSegment(ctx.rawPath))
      ) {
        return best
      }
    }
  }

  if (pathTrie.root === null) return best

  let allowEarlyExit =
    !pathTrie.hasComplex && !pathTrie.hasMixedOriginRank && hostEntryFilter === null

  let checkLeaves = (
    leaves: ReadonlyArray<PathLeaf<data>> | null,
    capDepth: number,
    wildcardStart: number,
    wildcardDecodedSeg: number,
  ) => {
    if (leaves === null) return
    for (let i = 0; i < leaves.length; i++) {
      let leaf = leaves[i]
      let entry = leaf.entry
      if (!entryMatchesUrl(entry, ctx)) continue

      let hMeta = hostEntryFilter !== null ? hostEntryFilter(entry) : hostnameMeta
      best = pickBetterCandidate(
        best,
        {
          entry,
          hostnameMeta: hMeta,
          pathnameMeta: emptyMeta,
          deferred: {
            leaf,
            caps: snapshotPendingCaps(capDepth),
            wildcardStart,
            wildcardDecodedSeg,
          },
        },
        ctx,
      )
      if (hostEntryFilter === null) break
    }
  }

  let evalComplex = (entries: ReadonlyArray<Entry<data>> | null) => {
    if (entries === null) return
    for (let i = 0; i < entries.length; i++) {
      let entry = entries[i]
      if (!entryMatchesUrl(entry, ctx)) continue
      let pathnameMeta = matchComplexPathname(entry, ctx)
      if (pathnameMeta === null) continue
      let hMeta = hostEntryFilter !== null ? hostEntryFilter(entry) : hostnameMeta
      best = pickBetterCandidate(
        best,
        { entry, hostnameMeta: hMeta, pathnameMeta, deferred: null },
        ctx,
      )
    }
  }

  if (ctx.decodedPath === null) {
    let rawPath = ctx.rawPath
    let len = rawPath.length
    let walkRaw = (node: PathTrieNode<data>, pos: number, capDepth: number) => {
      consumeMatchWork(ctx.budget, 1)
      evalComplex(node.complex)

      let slash = rawPath.indexOf('/', pos)
      let segEnd = slash === -1 ? len : slash
      let isLastSeg = slash === -1
      let nextPos = isLastSeg ? len + 1 : slash + 1
      let segLen = segEnd - pos
      let foundHigher = false

      let staticChild = lookupPathStaticRaw(node, rawPath, pos, segEnd, segLen)
      if (staticChild !== undefined) {
        let prevBest = best
        if (isLastSeg) {
          checkLeaves(staticChild.entries, capDepth, -1, -1)
          evalComplex(staticChild.complex)
        } else {
          walkRaw(staticChild, nextPos, capDepth)
        }
        if (best !== prevBest) foundHigher = true
      }

      if (segLen === 0 && node.optParam !== null) {
        setCapFrame(capDepth, 2, pos, pos, -1)
        let prevBest = best
        if (isLastSeg) checkLeaves(node.optParam.entries, capDepth + 1, -1, -1)
        else walkRaw(node.optParam, nextPos, capDepth + 1)
        if (best !== prevBest) foundHigher = true
      }

      if (allowEarlyExit && foundHigher) return

      if (
        segLen > 0 &&
        (node.param !== null || node.optParam !== null) &&
        !hasDotInRange(rawPath, pos, segEnd)
      ) {
        setCapFrame(capDepth, 0, pos, segEnd, -1)
        let foundParam = false

        if (node.param !== null) {
          let prevBest = best
          if (isLastSeg) {
            checkLeaves(node.param.entries, capDepth + 1, -1, -1)
            evalComplex(node.param.complex)
          } else {
            walkRaw(node.param, nextPos, capDepth + 1)
          }
          if (best !== prevBest) foundParam = true
        }
        if (node.optParam !== null) {
          let prevBest = best
          if (isLastSeg) checkLeaves(node.optParam.entries, capDepth + 1, -1, -1)
          else walkRaw(node.optParam, nextPos, capDepth + 1)
          if (best !== prevBest) foundParam = true
        }
        if (allowEarlyExit && foundParam) return
      }

      if (node.trailingWildcards !== null) {
        checkLeaves(node.trailingWildcards, capDepth, pos, -1)
      }
    }
    walkRaw(pathTrie.root, 1, 0)
  } else {
    let segs = ctx.decodedPath.segments
    let walkDecoded = (node: PathTrieNode<data>, segIdx: number, capDepth: number) => {
      consumeMatchWork(ctx.budget, 1)
      evalComplex(node.complex)

      let seg = segs[segIdx]
      let isLastSeg = segIdx + 1 === segs.length
      let foundHigher = false

      if (!seg.hasNonStructuralSep) {
        let staticChild = lookupPathStaticKey(node, seg.decoded)
        if (staticChild !== undefined) {
          let prevBest = best
          if (isLastSeg) {
            checkLeaves(staticChild.entries, capDepth, -1, -1)
            evalComplex(staticChild.complex)
          } else {
            walkDecoded(staticChild, segIdx + 1, capDepth)
          }
          if (best !== prevBest) foundHigher = true
        }
      }

      if (seg.decoded.length === 0 && node.optParam !== null) {
        setCapFrame(capDepth, 2, seg.encBegin, seg.encEnd, segIdx)
        let prevBest = best
        if (isLastSeg) checkLeaves(node.optParam.entries, capDepth + 1, -1, -1)
        else walkDecoded(node.optParam, segIdx + 1, capDepth + 1)
        if (best !== prevBest) foundHigher = true
      }

      if (allowEarlyExit && foundHigher) return

      if (
        seg.decoded.length > 0 &&
        !seg.hasStructuralDot &&
        (node.param !== null || node.optParam !== null)
      ) {
        setCapFrame(capDepth, 0, seg.encBegin, seg.encEnd, segIdx)
        let foundParam = false

        if (node.param !== null) {
          let prevBest = best
          if (isLastSeg) {
            checkLeaves(node.param.entries, capDepth + 1, -1, -1)
            evalComplex(node.param.complex)
          } else {
            walkDecoded(node.param, segIdx + 1, capDepth + 1)
          }
          if (best !== prevBest) foundParam = true
        }
        if (node.optParam !== null) {
          let prevBest = best
          if (isLastSeg) checkLeaves(node.optParam.entries, capDepth + 1, -1, -1)
          else walkDecoded(node.optParam, segIdx + 1, capDepth + 1)
          if (best !== prevBest) foundParam = true
        }
        if (allowEarlyExit && foundParam) return
      }

      if (node.trailingWildcards !== null) {
        checkLeaves(node.trailingWildcards, capDepth, -1, segIdx)
      }
    }
    walkDecoded(pathTrie.root, 0, 0)
  }

  if (pathTrie.suffixRoot !== null) {
    walkSuffixTrie(pathTrie.suffixRoot, ctx, evalComplex)
  }

  return best
}

function searchPathTrieAll<data>(
  pathTrie: PathTrie<data>,
  ctx: MatchContext,
  hostnameMeta: ReadonlyArray<MatchParamMeta>,
  results: Array<{ match: Match<string, data>; insertion: number }>,
  onLeafBatch: (sorted: boolean) => void,
  hostEntryFilter: ((entry: Entry<data>) => ReadonlyArray<MatchParamMeta>) | null,
): void {
  let canUseStaticMap = ctx.decodedPath === null || !ctx.decodedPath.anyNonStructuralSep

  if (canUseStaticMap && pathTrie.staticMap !== null) {
    let leaves = pathTrie.staticMap.get(ctx.rawPath)
    if (leaves !== undefined) {
      let emitted = 0
      for (let i = 0; i < leaves.length; i++) {
        let entry = leaves[i].entry
        if (!entryMatchesUrl(entry, ctx)) continue
        let hMeta = hostEntryFilter !== null ? hostEntryFilter(entry) : hostnameMeta
        results.push({
          match: buildMatch(ctx.url, entry, hMeta, emptyMeta),
          insertion: entry.insertion,
        })
        emitted += 1
      }
      if (emitted > 0) onLeafBatch(hostEntryFilter === null)
    }
  }

  if (pathTrie.root === null) return

  let emitLeaves = (
    leaves: ReadonlyArray<PathLeaf<data>> | null,
    capDepth: number,
    wildcardStart: number,
    wildcardDecodedSeg: number,
  ) => {
    if (leaves === null) return
    let caps = snapshotPendingCaps(capDepth)
    let emitted = 0
    for (let i = 0; i < leaves.length; i++) {
      let leaf = leaves[i]
      let entry = leaf.entry
      if (!entryMatchesUrl(entry, ctx)) continue
      let hMeta = hostEntryFilter !== null ? hostEntryFilter(entry) : hostnameMeta
      let pMeta = materializePendingPathMeta(
        leaf,
        caps,
        wildcardStart,
        wildcardDecodedSeg,
        ctx.rawPath,
        ctx.decodedPath,
      )
      results.push({ match: buildMatch(ctx.url, entry, hMeta, pMeta), insertion: entry.insertion })
      emitted += 1
    }
    if (emitted > 0) onLeafBatch(hostEntryFilter === null)
  }

  let evalComplex = (entries: ReadonlyArray<Entry<data>> | null) => {
    if (entries === null) return
    for (let i = 0; i < entries.length; i++) {
      let entry = entries[i]
      if (!entryMatchesUrl(entry, ctx)) continue
      let pMeta = matchComplexPathname(entry, ctx)
      if (pMeta === null) continue
      let hMeta = hostEntryFilter !== null ? hostEntryFilter(entry) : hostnameMeta
      results.push({ match: buildMatch(ctx.url, entry, hMeta, pMeta), insertion: entry.insertion })
      onLeafBatch(false)
    }
  }

  if (ctx.decodedPath === null) {
    let rawPath = ctx.rawPath
    let len = rawPath.length
    let walk = (node: PathTrieNode<data>, pos: number, capDepth: number) => {
      consumeMatchWork(ctx.budget, 1)
      evalComplex(node.complex)
      if (node.trailingWildcards !== null) emitLeaves(node.trailingWildcards, capDepth, pos, -1)

      let slash = rawPath.indexOf('/', pos)
      let segEnd = slash === -1 ? len : slash
      let isLastSeg = slash === -1
      let nextPos = isLastSeg ? len + 1 : slash + 1
      let segLen = segEnd - pos

      let child = lookupPathStaticRaw(node, rawPath, pos, segEnd, segLen)
      if (child !== undefined) {
        if (isLastSeg) {
          emitLeaves(child.entries, capDepth, -1, -1)
          evalComplex(child.complex)
        } else {
          walk(child, nextPos, capDepth)
        }
      }

      if (segLen === 0 && node.optParam !== null) {
        setCapFrame(capDepth, 2, pos, pos, -1)
        if (isLastSeg) emitLeaves(node.optParam.entries, capDepth + 1, -1, -1)
        else walk(node.optParam, nextPos, capDepth + 1)
      } else if (
        segLen > 0 &&
        (node.param !== null || node.optParam !== null) &&
        !hasDotInRange(rawPath, pos, segEnd)
      ) {
        setCapFrame(capDepth, 0, pos, segEnd, -1)
        if (node.param !== null) {
          if (isLastSeg) {
            emitLeaves(node.param.entries, capDepth + 1, -1, -1)
            evalComplex(node.param.complex)
          } else {
            walk(node.param, nextPos, capDepth + 1)
          }
        }
        if (node.optParam !== null) {
          if (isLastSeg) emitLeaves(node.optParam.entries, capDepth + 1, -1, -1)
          else walk(node.optParam, nextPos, capDepth + 1)
        }
      }
    }
    walk(pathTrie.root, 1, 0)
  } else {
    let segs = ctx.decodedPath.segments
    let walk = (node: PathTrieNode<data>, segIdx: number, capDepth: number) => {
      consumeMatchWork(ctx.budget, 1)
      evalComplex(node.complex)
      if (node.trailingWildcards !== null) emitLeaves(node.trailingWildcards, capDepth, -1, segIdx)

      let seg = segs[segIdx]
      let isLastSeg = segIdx + 1 === segs.length

      if (!seg.hasNonStructuralSep) {
        let child = lookupPathStaticKey(node, seg.decoded)
        if (child !== undefined) {
          if (isLastSeg) {
            emitLeaves(child.entries, capDepth, -1, -1)
            evalComplex(child.complex)
          } else {
            walk(child, segIdx + 1, capDepth)
          }
        }
      }

      if (seg.decoded.length === 0 && node.optParam !== null) {
        setCapFrame(capDepth, 2, seg.encBegin, seg.encEnd, segIdx)
        if (isLastSeg) emitLeaves(node.optParam.entries, capDepth + 1, -1, -1)
        else walk(node.optParam, segIdx + 1, capDepth + 1)
      } else if (
        seg.decoded.length > 0 &&
        !seg.hasStructuralDot &&
        (node.param !== null || node.optParam !== null)
      ) {
        setCapFrame(capDepth, 0, seg.encBegin, seg.encEnd, segIdx)
        if (node.param !== null) {
          if (isLastSeg) {
            emitLeaves(node.param.entries, capDepth + 1, -1, -1)
            evalComplex(node.param.complex)
          } else {
            walk(node.param, segIdx + 1, capDepth + 1)
          }
        }
        if (node.optParam !== null) {
          if (isLastSeg) emitLeaves(node.optParam.entries, capDepth + 1, -1, -1)
          else walk(node.optParam, segIdx + 1, capDepth + 1)
        }
      }
    }
    walk(pathTrie.root, 0, 0)
  }

  if (pathTrie.suffixRoot !== null) {
    walkSuffixTrie(pathTrie.suffixRoot, ctx, evalComplex)
  }
}

function walkSuffixTrie<data>(
  suffixRoot: PathTrieNode<data>,
  ctx: MatchContext,
  visitComplex: (entries: ReadonlyArray<Entry<data>> | null) => void,
): void {
  if (ctx.decodedPath === null) {
    let rawPath = ctx.rawPath
    let walk = (node: PathTrieNode<data>, endPos: number) => {
      consumeMatchWork(ctx.budget, 1)
      visitComplex(node.complex)
      if (endPos < 1) return
      let slash = rawPath.lastIndexOf('/', endPos - 1)
      if (slash < 0) return
      let segStart = slash + 1
      let child = lookupPathStaticRaw(node, rawPath, segStart, endPos, endPos - segStart)
      if (child !== undefined) walk(child, slash)
      if (node.param !== null && endPos > segStart && !hasDotInRange(rawPath, segStart, endPos)) {
        walk(node.param, slash)
      }
    }
    walk(suffixRoot, rawPath.length)
  } else {
    let segs = ctx.decodedPath.segments
    let walk = (node: PathTrieNode<data>, segIdx: number) => {
      consumeMatchWork(ctx.budget, 1)
      visitComplex(node.complex)
      if (segIdx < 0) return
      let seg = segs[segIdx]
      if (!seg.hasNonStructuralSep) {
        let child = lookupPathStaticKey(node, seg.decoded)
        if (child !== undefined) walk(child, segIdx - 1)
      }
      if (node.param !== null && seg.decoded.length > 0 && !seg.hasStructuralDot) {
        walk(node.param, segIdx - 1)
      }
    }
    walk(suffixRoot, segs.length - 1)
  }
}

// ============================================================================
// Dynamic & Complex Hostname Walkers (shared by `match()` and `matchAll()`)
// ============================================================================

function walkDynamicHostTrie<data>(
  root: HostTrieNode<data>,
  ctx: MatchContext,
  visit: (
    pathTrie: PathTrie<data>,
    filter: (entry: Entry<data>) => ReadonlyArray<MatchParamMeta>,
  ) => void,
): void {
  let lowerHostname = ctx.lowerHostname!
  let hostCapBegins: Array<number> = []
  let hostCapEnds: Array<number> = []

  let makeFilter =
    (
      depth: number,
      useWildcard: boolean,
      wcEnd: number,
    ): ((entry: Entry<data>) => ReadonlyArray<MatchParamMeta>) =>
    (entry) =>
      buildHostMetaFromCaptures(
        lowerHostname,
        entry.hostnameParamNames,
        hostCapBegins,
        hostCapEnds,
        depth,
        useWildcard ? entry.hostnameWildcardName : null,
        wcEnd,
      )

  let walk = (node: HostTrieNode<data>, segEnd: number) => {
    consumeMatchWork(ctx.budget, 1)

    if (node.leadingWildcards !== null) {
      visit(node.leadingWildcards, makeFilter(hostCapBegins.length, true, segEnd))
    }

    let dot = segEnd === 0 ? -1 : lowerHostname.lastIndexOf('.', segEnd - 1)
    let segBegin = dot + 1
    let isLeftmost = dot === -1

    if (node.static !== null) {
      let child = node.static.get(lowerHostname.slice(segBegin, segEnd))
      if (child !== undefined) {
        if (isLeftmost) {
          if (child.pathTrie !== null) {
            visit(child.pathTrie, makeFilter(hostCapBegins.length, false, -1))
          }
        } else {
          walk(child, dot)
        }
      }
    }

    if (node.param !== null && segEnd > segBegin) {
      hostCapBegins.push(segBegin)
      hostCapEnds.push(segEnd)
      if (isLeftmost) {
        if (node.param.pathTrie !== null) {
          visit(node.param.pathTrie, makeFilter(hostCapBegins.length, false, -1))
        }
      } else {
        walk(node.param, dot)
      }
      hostCapBegins.pop()
      hostCapEnds.pop()
    }
  }

  walk(root, lowerHostname.length)
}

function forEachComplexHostMatch<data>(
  entries: ReadonlyArray<Entry<data>>,
  ctx: MatchContext,
  visit: (
    entry: Entry<data>,
    hostnameMeta: ReadonlyArray<MatchParamMeta>,
    pathnameMeta: ReadonlyArray<MatchParamMeta>,
  ) => void,
): void {
  for (let i = 0; i < entries.length; i++) {
    let entry = entries[i]
    if (!entryMatchesUrl(entry, ctx)) continue
    let hMeta = matchComplexHostname(entry, ctx)
    if (hMeta === null) continue
    let pMeta = matchComplexPathname(entry, ctx)
    if (pMeta === null) continue
    visit(entry, hMeta, pMeta)
  }
}

// ============================================================================
// Candidate Comparison & Materialization
// ============================================================================

function resolveCandidatePathMeta<data>(
  c: CandidateMatch<data>,
  ctx: MatchContext,
): ReadonlyArray<MatchParamMeta> {
  let d = c.deferred
  if (d === null) return c.pathnameMeta
  let meta = materializePendingPathMeta(
    d.leaf,
    d.caps,
    d.wildcardStart,
    d.wildcardDecodedSeg,
    ctx.rawPath,
    ctx.decodedPath,
  )
  c.pathnameMeta = meta
  c.deferred = null
  return meta
}

function pickBetterCandidate<data>(
  best: CandidateMatch<data> | null,
  candidate: CandidateMatch<data>,
  ctx: MatchContext,
): CandidateMatch<data> {
  if (best === null) return candidate

  let a = candidate.entry
  let b = best.entry

  if (a.protocolRank !== b.protocolRank) return a.protocolRank > b.protocolRank ? candidate : best
  if (a.portRank !== b.portRank) return a.portRank > b.portRank ? candidate : best

  if (ctx.lowerHostname !== null) {
    let hostCmp = compareHostnameRanges(
      candidate.hostnameMeta,
      best.hostnameMeta,
      ctx.lowerHostname,
    )
    if (hostCmp !== 0) return hostCmp > 0 ? candidate : best
  }

  let pathCmp = comparePathnameRanges(
    resolveCandidatePathMeta(candidate, ctx),
    resolveCandidatePathMeta(best, ctx),
  )
  if (pathCmp !== 0) return pathCmp > 0 ? candidate : best

  if (a.searchKeyValue !== b.searchKeyValue) {
    return a.searchKeyValue > b.searchKeyValue ? candidate : best
  }
  if (a.searchKey !== b.searchKey) {
    return a.searchKey > b.searchKey ? candidate : best
  }

  return a.insertion < b.insertion ? candidate : best
}

function wildcardHostMeta(url: URL): ReadonlyArray<MatchParamMeta> {
  let decodedHostname = decodeHostname(url.hostname)
  return [{ type: '*', name: '*', value: decodedHostname, begin: 0, end: decodedHostname.length }]
}

function buildMatch<data>(
  url: URL,
  entry: Entry<data>,
  hostnameMeta: ReadonlyArray<MatchParamMeta>,
  pathnameMeta: ReadonlyArray<MatchParamMeta>,
): Match<string, data> {
  let params: Record<string, string | undefined> = {}
  let names = entry.allCaptureNames
  for (let i = 0; i < names.length; i++) params[names[i]] = undefined
  for (let i = 0; i < hostnameMeta.length; i++) {
    let cap = hostnameMeta[i]
    if (cap.name !== '*') params[cap.name] = cap.value
  }
  for (let i = 0; i < pathnameMeta.length; i++) {
    let cap = pathnameMeta[i]
    if (cap.name !== '*') params[cap.name] = cap.value
  }

  return {
    url,
    pattern: entry.pattern,
    data: entry.data,
    params,
    paramsMeta: {
      hostname: hostnameMeta,
      pathname: pathnameMeta,
    },
  }
}

function snapshotPendingCaps(capDepth: number): Array<PendingCapture> | null {
  if (capDepth === 0) return null
  let result = new Array<PendingCapture>(capDepth)
  for (let i = 0; i < capDepth; i++) {
    result[i] = {
      segStart: capStacks.begin[i],
      segEnd: capStacks.end[i],
      decodedSegIndex: capStacks.segIdx[i],
      omitted: capStacks.type[i] === 2,
    }
  }
  return result
}

function buildPathMetaFromStacks<data>(
  leaf: PathLeaf<data>,
  capDepth: number,
  wildcardStart: number,
  rawPath: string,
): ReadonlyArray<MatchParamMeta> {
  let wildcardName = leaf.wildcardName
  if (capDepth === 0 && wildcardName === null) return emptyMeta

  let paramNames = leaf.paramNames
  let result: Array<MatchParamMeta> = []
  let rawPosCursor = 1
  let rawEncCursor = 0

  for (let i = 0; i < capDepth; i++) {
    if (capStacks.type[i] === 2) continue
    let sBegin = capStacks.begin[i]
    let sEnd = capStacks.end[i]
    rawEncCursor += encodedPathnameLength(rawPath, rawPosCursor, sBegin)
    let begin = rawEncCursor
    rawEncCursor += encodedPathnameLength(rawPath, sBegin, sEnd)
    let end = rawEncCursor
    rawPosCursor = sEnd
    result.push({
      type: ':',
      name: paramNames[i],
      value: rawPath.slice(sBegin, sEnd),
      begin,
      end,
    })
  }

  if (wildcardName !== null) {
    rawEncCursor += encodedPathnameLength(rawPath, rawPosCursor, wildcardStart)
    let begin = rawEncCursor
    let end = begin + encodedPathnameLength(rawPath, wildcardStart, rawPath.length)
    result.push({
      type: '*',
      name: wildcardName,
      value: rawPath.slice(wildcardStart),
      begin,
      end,
    })
  }

  return result
}

function materializePendingPathMeta<data>(
  leaf: PathLeaf<data>,
  caps: ReadonlyArray<PendingCapture> | null,
  wildcardStart: number,
  wildcardDecodedSeg: number,
  rawPath: string,
  decodedPath: DecodedPathname | null,
): ReadonlyArray<MatchParamMeta> {
  let paramNames = leaf.paramNames
  let wildcardName = leaf.wildcardName
  if (caps === null && wildcardName === null) return emptyMeta

  let result: Array<MatchParamMeta> = []
  let isRaw = decodedPath === null
  let rawPosCursor = 1
  let rawEncCursor = 0

  if (caps !== null) {
    for (let i = 0; i < caps.length; i++) {
      let c = caps[i]
      if (c.omitted) continue
      let name = paramNames[i]
      if (isRaw) {
        rawEncCursor += encodedPathnameLength(rawPath, rawPosCursor, c.segStart)
        let begin = rawEncCursor
        rawEncCursor += encodedPathnameLength(rawPath, c.segStart, c.segEnd)
        let end = rawEncCursor
        rawPosCursor = c.segEnd
        result.push({ type: ':', name, value: rawPath.slice(c.segStart, c.segEnd), begin, end })
      } else {
        let seg = decodedPath!.segments[c.decodedSegIndex]
        result.push({ type: ':', name, value: seg.decoded, begin: seg.encBegin, end: seg.encEnd })
      }
    }
  }

  if (wildcardName !== null) {
    if (isRaw) {
      rawEncCursor += encodedPathnameLength(rawPath, rawPosCursor, wildcardStart)
      let begin = rawEncCursor
      let end = begin + encodedPathnameLength(rawPath, wildcardStart, rawPath.length)
      result.push({
        type: '*',
        name: wildcardName,
        value: rawPath.slice(wildcardStart),
        begin,
        end,
      })
    } else {
      let seg = decodedPath!.segments[wildcardDecodedSeg]
      result.push({
        type: '*',
        name: wildcardName,
        value: decodedPath!.fullDecoded.slice(seg.decodedStart),
        begin: seg.encBegin,
        end: decodedPath!.totalEncLen,
      })
    }
  }

  return result
}

function buildHostMetaFromCaptures(
  lowerHostname: string,
  paramNamesRtl: ReadonlyArray<string>,
  beginsRtl: ReadonlyArray<number>,
  endsRtl: ReadonlyArray<number>,
  depth: number,
  leadingWildcardName: string | null,
  leadingWildcardEnd: number,
): ReadonlyArray<MatchParamMeta> {
  if (depth === 0 && leadingWildcardName === null) return emptyMeta
  let result: Array<MatchParamMeta> = []
  if (leadingWildcardName !== null) {
    result.push({
      type: '*',
      name: leadingWildcardName,
      value: lowerHostname.slice(0, leadingWildcardEnd),
      begin: 0,
      end: leadingWildcardEnd,
    })
  }
  for (let i = depth - 1; i >= 0; i--) {
    let begin = beginsRtl[i]
    let end = endsRtl[i]
    result.push({
      type: ':',
      name: paramNamesRtl[i],
      value: lowerHostname.slice(begin, end),
      begin,
      end,
    })
  }
  return result
}

// ============================================================================
// URL Decoding & Helpers
// ============================================================================

function decodeUrlPathname(
  rawPathname: string,
  ignoreCase: boolean,
  budget: MatchWorkBudget,
): DecodedPathname | null {
  let segments: Array<DecodedSegment> = []
  let fullDecoded = ''
  let anyNonStructuralSep = false
  let encOffset = 0
  let pos = 1
  let len = rawPathname.length

  while (true) {
    let slash = rawPathname.indexOf('/', pos)
    let segEnd = slash === -1 ? len : slash
    let segBeginOffset = encOffset
    let decodedStart = fullDecoded.length

    if (segEnd === pos) {
      segments.push({
        decoded: '',
        decodedStart,
        hasStructuralDot: false,
        hasNonStructuralSep: false,
        encBegin: segBeginOffset,
        encEnd: segBeginOffset,
      })
    } else {
      let segRaw = rawPathname.slice(pos, segEnd)
      let hasPercent = segRaw.indexOf('%') !== -1
      let hasDot = segRaw.indexOf('.') !== -1

      if (!hasPercent) {
        let decoded = ignoreCase ? segRaw.toLowerCase() : segRaw
        encOffset += encodedPathnameLength(decoded, 0, decoded.length)
        segments.push({
          decoded,
          decodedStart,
          hasStructuralDot: hasDot,
          hasNonStructuralSep: false,
          encBegin: segBeginOffset,
          encEnd: encOffset,
        })
        fullDecoded += decoded
      } else {
        let decodedSeg = ''
        let segHasNonStructuralSep = false
        let dotStart = 0
        for (let i = 0; i <= segRaw.length; i++) {
          if (i < segRaw.length && segRaw.charCodeAt(i) !== 46) continue
          if (i > dotStart) {
            let chunk = segRaw.slice(dotStart, i)
            let decoded: string
            if (chunk.indexOf('%') !== -1) {
              try {
                decoded = decodeURIComponent(chunk)
              } catch (error) {
                if (!(error instanceof URIError)) throw error
                return null
              }
            } else {
              decoded = chunk
            }
            if (ignoreCase) decoded = decoded.toLowerCase()
            if (decoded.indexOf('.') !== -1 || decoded.indexOf('/') !== -1) {
              segHasNonStructuralSep = true
              anyNonStructuralSep = true
            }
            // Non-structural '.' and '/' inside a decoded chunk encode as %2E / %2F (length 3)
            encOffset += encodedPathnameLength(decoded, 0, decoded.length)
            for (let k = 0; k < decoded.length; k++) {
              let code = decoded.charCodeAt(k)
              if (code === 46 || code === 47) encOffset += 2
            }
            decodedSeg += decoded
          }
          if (i < segRaw.length) {
            decodedSeg += '.'
            encOffset += 1
          }
          dotStart = i + 1
        }
        segments.push({
          decoded: decodedSeg,
          decodedStart,
          hasStructuralDot: hasDot,
          hasNonStructuralSep: segHasNonStructuralSep,
          encBegin: segBeginOffset,
          encEnd: encOffset,
        })
        fullDecoded += decodedSeg
      }
    }

    if (slash === -1) break
    fullDecoded += '/'
    encOffset += 1
    pos = slash + 1
  }

  consumeMatchWork(budget, segments.length)
  return { segments, fullDecoded, totalEncLen: encOffset, anyNonStructuralSep }
}

function hasEmptyPathSegment(rawPath: string): boolean {
  let len = rawPath.length
  return len === 1 || rawPath.charCodeAt(len - 1) === 47 || rawPath.indexOf('//') !== -1
}

function hasDotInRange(str: string, start: number, end: number): boolean {
  for (let i = start; i < end; i++) {
    if (str.charCodeAt(i) === 46) return true
  }
  return false
}

function matchesProtocolAndPort(
  parts: RoutePatternParts,
  proto: 'http:' | 'https:',
  actualPort: string,
): boolean {
  let expectedProto = parts.protocol
  if (expectedProto !== null && expectedProto !== 'http(s)') {
    if (expectedProto === 'https' ? proto !== 'https:' : proto !== 'http:') return false
  }

  let expectedPort = parts.port
  if (expectedPort === null) return parts.hostname === null || actualPort === ''
  if (
    (proto === 'http:' && expectedPort === '80') ||
    (proto === 'https:' && expectedPort === '443')
  ) {
    return actualPort === ''
  }
  return expectedPort === actualPort
}

function matchSearch(
  url: URL,
  constraints: ReadonlyMap<string, ReadonlySet<string>>,
  budget: MatchWorkBudget,
): boolean {
  if (url.search === '') return false
  let params = url.searchParams
  for (let [name, requiredValues] of constraints) {
    consumeMatchWork(budget, params.size + requiredValues.size + 1)
    if (requiredValues.size === 0) {
      if (!params.has(name)) return false
      continue
    }
    let values = params.getAll(name)
    if (values.length < requiredValues.size) return false
    if (values.length === 1 && requiredValues.size === 1) {
      for (let req of requiredValues) {
        if (values[0] !== req) return false
      }
      continue
    }
    let valueSet = new Set(values)
    for (let requiredValue of requiredValues) {
      if (!valueSet.has(requiredValue)) return false
    }
  }
  return true
}

function collectAllCaptureNames(parts: RoutePatternParts): ReadonlyArray<string> {
  let seen = new Set<string>()
  let addPart = (part: PartPattern) => {
    for (let tok of part.tokens) {
      if ((tok.type === ':' || tok.type === '*') && tok.name !== '*') {
        seen.add(tok.name)
      }
    }
  }
  if (parts.hostname !== null) addPart(parts.hostname)
  addPart(parts.pathname)
  return seen.size === 0 ? emptyStrings : Array.from(seen)
}

function utf8Size(value: string): number {
  let result = 0
  let len = value.length
  for (let i = 0; i < len; i++) {
    let code = value.charCodeAt(i)
    if (code <= 0x7f) {
      result += 1
    } else if (code <= 0x7ff) {
      result += 2
    } else if (code >= 0xd800 && code <= 0xdbff && i + 1 < len) {
      result += 4
      i += 1
    } else {
      result += 3
    }
  }
  return result
}

function createPathTrie<data>(): PathTrie<data> {
  return {
    staticMap: null,
    root: null,
    suffixRoot: null,
    hasOptParam: false,
    hasComplex: false,
    hasMixedOriginRank: false,
    firstProtocolRank: -1,
    firstPortRank: -1,
  }
}

function getOrCreatePathStaticChild<data>(
  node: PathTrieNode<data>,
  key: string,
): PathTrieNode<data> {
  if (node.static !== null) {
    let existing = node.static.get(key)
    if (existing !== undefined) return existing
    let created = createPathTrieNode<data>()
    node.static.set(key, created)
    return created
  }
  if (node.staticKey === null) {
    let created = createPathTrieNode<data>()
    node.staticKey = key
    node.staticChild = created
    return created
  }
  if (node.staticKey === key) return node.staticChild!
  let map = new Map<string, PathTrieNode<data>>()
  map.set(node.staticKey, node.staticChild!)
  let created = createPathTrieNode<data>()
  map.set(key, created)
  node.static = map
  node.staticKey = null
  node.staticChild = null
  return created
}

function lookupPathStaticRaw<data>(
  node: PathTrieNode<data>,
  rawPath: string,
  pos: number,
  segEnd: number,
  segLen: number,
): PathTrieNode<data> | undefined {
  let singleKey = node.staticKey
  if (singleKey !== null) {
    return segLen === singleKey.length && rawPath.startsWith(singleKey, pos)
      ? node.staticChild!
      : undefined
  }
  return node.static?.get(rawPath.slice(pos, segEnd))
}

function lookupPathStaticKey<data>(
  node: PathTrieNode<data>,
  key: string,
): PathTrieNode<data> | undefined {
  let singleKey = node.staticKey
  if (singleKey !== null) {
    return key === singleKey ? node.staticChild! : undefined
  }
  return node.static?.get(key)
}

function createPathTrieNode<data>(): PathTrieNode<data> {
  return {
    staticKey: null,
    staticChild: null,
    static: null,
    param: null,
    optParam: null,
    trailingWildcards: null,
    complex: null,
    entries: null,
  }
}

function createHostTrieNode<data>(): HostTrieNode<data> {
  return {
    static: null,
    param: null,
    leadingWildcards: null,
    pathTrie: null,
  }
}
