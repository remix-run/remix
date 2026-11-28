import type { PartPattern, RoutePattern, RoutePatternParts } from '../route-pattern.ts'
import { parsePattern } from '../route-pattern/parse.ts'
import { serializeSearch } from '../route-pattern/serialize.ts'
import { compare, compareHostnameRanges, comparePathnameRanges } from '../specificity.ts'
import { decodeHostname } from './punycode.ts'
import {
  canonicalizeSimpleSegmentText,
  canonicalizeUrlPart,
  compilePart,
  decodePercentChunk,
  encodedPathnameLength,
  ensureUnitProgram,
  matchPartString,
  matchPartUnits,
  scanParamEncodedLength,
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
  readonly missingParamNames: ReadonlyArray<string>
}

type PathTrieNode<data> = {
  staticKey: string | null
  staticChild: PathTrieNode<data> | null
  staticKeys: Array<string> | null
  staticChildren: Array<PathTrieNode<data>> | null
  static: Map<string, PathTrieNode<data>> | null
  param: PathTrieNode<data> | null
  optParam: PathTrieNode<data> | null
  trailingWildcards: Array<PathLeaf<data>> | null
  complex: Array<Entry<data>> | null
  entries: Array<PathLeaf<data>> | null
}

type PathTrie<data> = {
  staticMap: Map<string, Array<Entry<data>>> | null
  root: PathTrieNode<data> | null
  suffixRoot: PathTrieNode<data> | null
  hasOptParam: boolean
  hasParamOptOverlap: boolean
  hasEncodedStaticChars: boolean
  hasComplex: boolean
  hasMixedOriginRank: boolean
  firstProtocolRank: -1 | 0 | 1
  firstPortRank: -1 | 0 | 1
}

type HostTrieNode<data> = {
  staticKey: string | null
  staticChild: HostTrieNode<data> | null
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
  rawPathNoSlash: string | null
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

const CAP_PARAM = 0
const CAP_OMITTED = 1

// Reusable growable capture stacks for synchronous, non-reentrant trie traversal
const capStacks = {
  type: new Uint8Array(256),
  begin: new Int32Array(256),
  end: new Int32Array(256),
  encLen: new Int32Array(256),
  segIdx: new Int32Array(256),
}

const hostCapStacks = {
  begin: new Int32Array(64),
  end: new Int32Array(64),
}

function growCapStacks(depth: number): void {
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

  let nextEncLen = new Int32Array(nextLen)
  nextEncLen.set(capStacks.encLen)
  capStacks.encLen = nextEncLen

  let nextSegIdx = new Int32Array(nextLen)
  nextSegIdx.set(capStacks.segIdx)
  capStacks.segIdx = nextSegIdx
}

function setCapFrame(
  depth: number,
  type: number,
  begin: number,
  end: number,
  segIdx: number,
): void {
  if (depth >= capStacks.type.length) growCapStacks(depth)
  capStacks.type[depth] = type
  capStacks.begin[depth] = begin
  capStacks.end[depth] = end
  capStacks.segIdx[depth] = segIdx
}

function setFastCapFrame(depth: number, begin: number, end: number, encLen: number): void {
  if (depth >= capStacks.begin.length) growCapStacks(depth)
  capStacks.begin[depth] = begin
  capStacks.end[depth] = end
  capStacks.encLen[depth] = encLen
}

function setHostCapFrame(depth: number, begin: number, end: number): void {
  if (depth >= hostCapStacks.begin.length) {
    let nextLen = hostCapStacks.begin.length
    while (nextLen <= depth) nextLen *= 2
    let nextBegin = new Int32Array(nextLen)
    nextBegin.set(hostCapStacks.begin)
    hostCapStacks.begin = nextBegin
    let nextEnd = new Int32Array(nextLen)
    nextEnd.set(hostCapStacks.end)
    hostCapStacks.end = nextEnd
  }
  hostCapStacks.begin[depth] = begin
  hostCapStacks.end[depth] = end
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
  #maxDynamicHostOriginRank = -1
  #staticHostTries: Map<string, PathTrie<data>> | null = null
  #dynamicHostRoot: HostTrieNode<data> | null = null
  #complexHostEntries: Array<Entry<data>> | null = null

  constructor(options?: { ignoreCase?: boolean; limits?: Partial<MatcherLimits> }) {
    this.ignoreCase = options?.ignoreCase ?? false
    this.#limits = resolveMatcherLimits(options?.limits)
    this.#budget = { maximum: this.#limits.maxMatchWork, actual: 0 }
  }

  insert(pattern: string | RoutePattern, data: data): void {
    let rawSize = -1
    let canonicalSize = -1
    if (typeof pattern === 'string') {
      rawSize = utf8Size(pattern)
      checkMatcherLimit('maxPatternSize', this.#limits.maxPatternSize, rawSize)
      checkMatcherLimit('maxMatcherSize', this.#limits.maxMatcherSize, this.#size + rawSize)
      if (
        pattern.indexOf('?') === -1 &&
        pattern.indexOf('://') === -1 &&
        pattern.indexOf('\\') === -1
      ) {
        // Without query, origin, or escapes, canonical serialization only ensures a leading '/'
        canonicalSize = rawSize + (pattern.charCodeAt(0) === 47 ? 0 : 1)
      }
      pattern = parsePattern(pattern)
    }

    let parts = pattern._parts
    if (canonicalSize === -1) {
      canonicalSize = serializedPatternUtf8Size(parts)
    }
    if (canonicalSize !== rawSize) {
      checkMatcherLimit('maxPatternSize', this.#limits.maxPatternSize, canonicalSize)
      checkMatcherLimit('maxMatcherSize', this.#limits.maxMatcherSize, this.#size + canonicalSize)
    }

    let hostClass = classifyHostname(parts.hostname)
    let pathClass = classifyPathname(parts.pathname, this.ignoreCase)

    let protocolRank: 0 | 1 = parts.protocol === 'http' || parts.protocol === 'https' ? 1 : 0
    let portRank: 0 | 1 = parts.port !== null ? 1 : 0

    let searchKeyValue = 0
    let searchKey = 0
    if (parts.search.size > 0) {
      for (let constraint of parts.search.values()) {
        if (constraint.size === 0) searchKey += 1
        else searchKeyValue += constraint.size
      }
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
      let originRank = (protocolRank << 1) | portRank
      if (originRank > this.#maxDynamicHostOriginRank) {
        this.#maxDynamicHostOriginRank = originRank
      }
    } else if (hostClass.kind === 'complex') {
      hostnameProgram = compilePart(parts.hostname!, { ignoreCase: true })
      this.#hasFullWildcardHostname = true
    }

    let pathnameProgram: PartProgram | null =
      pathClass.kind === 'complex' || hostClass.kind === 'complex'
        ? compilePart(parts.pathname, { ignoreCase: this.ignoreCase })
        : null

    let allCaptureNames =
      hostClass.kind === 'none' && pathClass.kind === 'static'
        ? emptyStrings
        : collectAllCaptureNames(parts)

    let entry: Entry<data> = {
      pattern,
      patternParts: parts,
      data,
      insertion: this.#insertion++,
      protocolRank,
      portRank,
      searchKeyValue,
      searchKey,
      allCaptureNames,
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
          node =
            label.kind === 'static'
              ? getOrCreateHostStaticChild(node, label.text)
              : (node.param ??= createHostTrieNode<data>())
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

  matchBest(url: URL): Match<string, data> | null {
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

    if (!this.#hasOriginPatterns) {
      return matchPathnameOnlyTrieBest(
        this.#pathnameOnlyTrie,
        url,
        proto,
        rawPath,
        decodedPath,
        budget,
        this.ignoreCase,
      )
    }

    let ctx = createMatchContext(url, proto, rawPath, decodedPath, budget, this.ignoreCase)
    return this.#matchBestWithOrigin(ctx)
  }

  #matchBestWithOrigin(ctx: MatchContext): Match<string, data> | null {
    let url = ctx.url
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

    if (
      this.#dynamicHostRoot !== null &&
      (best === null ||
        best.hostnameMeta.length > 0 ||
        this.#maxDynamicHostOriginRank > ((best.entry.protocolRank << 1) | best.entry.portRank))
    ) {
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

    if (best === null) {
      return matchPathnameOnlyTrieBest(
        this.#pathnameOnlyTrie,
        url,
        ctx.proto,
        ctx.rawPath,
        ctx.decodedPath,
        ctx.budget,
        this.ignoreCase,
      )
    }

    // Only check origin-less routes if they could still beat an explicit-hostname match
    let pathnameTrieHasProtocol =
      this.#pathnameOnlyTrie.firstProtocolRank === 1 || this.#pathnameOnlyTrie.hasMixedOriginRank
    if (
      (best.entry.protocolRank === 0 && pathnameTrieHasProtocol) ||
      (this.#hasFullWildcardHostname &&
        best.entry.portRank === 0 &&
        best.hostnameMeta.length === 1 &&
        best.hostnameMeta[0].type === '*' &&
        best.hostnameMeta[0].begin === 0 &&
        best.hostnameMeta[0].end === decodedHostname.length)
    ) {
      best =
        searchPathTrieBest(
          this.#pathnameOnlyTrie,
          ctx,
          wildcardHostMetaFromDecoded(decodedHostname),
          best,
          null,
        ) ?? best
    }

    return buildMatch(url, best.entry, best.hostnameMeta, resolveCandidatePathMeta(best, ctx))
  }

  searchAll(url: URL): Array<Match<string, data>> {
    let proto = url.protocol
    if (proto !== 'https:' && proto !== 'http:') return []
    if (this.#insertion === 0) return []

    let budget = this.#budget
    budget.actual = 0

    let rawPathname = url.pathname
    consumeMatchWork(budget, rawPathname.length - 1)

    let hasPercent = rawPathname.indexOf('%') !== -1
    let decodedPath: DecodedPathname | null = null
    let rawPath: string
    if (hasPercent) {
      decodedPath = decodeUrlPathname(rawPathname, this.ignoreCase, budget)
      if (decodedPath === null) return []
      rawPath = '/' + decodedPath.fullDecoded
    } else {
      rawPath = this.ignoreCase ? rawPathname.toLowerCase() : rawPathname
    }

    let ctx = createMatchContext(url, proto, rawPath, decodedPath, budget, this.ignoreCase)
    let decodedHostname = decodeHostname(url.hostname)
    let wildcardHost = wildcardHostMetaFromDecoded(decodedHostname)

    let matches: Array<Match<string, data>> = []
    let insertions: Array<number> = []
    let leafBatchCount = 0
    let singleBatchAlreadySorted = true

    let onLeafBatch = (sorted: boolean) => {
      leafBatchCount += 1
      if (!sorted || leafBatchCount > 1) singleBatchAlreadySorted = false
    }

    searchPathTrieAll(
      this.#pathnameOnlyTrie,
      ctx,
      wildcardHost,
      matches,
      insertions,
      onLeafBatch,
      null,
    )

    if (this.#hasOriginPatterns) {
      consumeMatchWork(ctx.budget, url.hostname.length)
      ctx.lowerHostname = decodedHostname.toLowerCase()

      if (this.#staticHostTries !== null) {
        let staticHostTrie = this.#staticHostTries.get(ctx.lowerHostname)
        if (staticHostTrie !== undefined) {
          searchPathTrieAll(staticHostTrie, ctx, emptyMeta, matches, insertions, onLeafBatch, null)
        }
      }

      if (this.#dynamicHostRoot !== null) {
        walkDynamicHostTrie(this.#dynamicHostRoot, ctx, (pathTrie, filter) => {
          searchPathTrieAll(pathTrie, ctx, emptyMeta, matches, insertions, onLeafBatch, filter)
        })
      }

      if (this.#complexHostEntries !== null) {
        forEachComplexHostMatch(this.#complexHostEntries, ctx, (entry, hMeta, pMeta) => {
          matches.push(buildMatch(url, entry, hMeta, pMeta))
          insertions.push(entry.insertion)
          onLeafBatch(false)
        })
      }
    }

    if (matches.length <= 1 || singleBatchAlreadySorted) {
      return matches
    }

    let order = new Array<number>(matches.length)
    for (let i = 0; i < matches.length; i++) order[i] = i
    order.sort((a, b) => compare(matches[b], matches[a]) || insertions[a] - insertions[b])

    let out = new Array<Match<string, data>>(matches.length)
    for (let i = 0; i < order.length; i++) out[i] = matches[order[i]]
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
    let text = canonicalizeSimpleSegmentText(tok.text, partKind, ignoreCase)
    return text === null ? null : { kind: 'static', text }
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
    let key = '/'
    let isStatic = true
    for (let i = 0; i < tokens.length; i++) {
      let tok = tokens[i]
      if (tok.type === 'separator') {
        key += '/'
      } else if (tok.type === 'text') {
        let text = canonicalizeSimpleSegmentText(tok.text, 'pathname', ignoreCase)
        if (text === null) {
          return { kind: 'complex', leadingPrefix: [], trailingSuffix: [] }
        }
        key += text
      } else {
        isStatic = false
        break
      }
    }
    if (isStatic) return { kind: 'static', key }
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

function addStaticEntry<data>(pathTrie: PathTrie<data>, key: string, entry: Entry<data>): void {
  pathTrie.staticMap ??= new Map()
  let list = pathTrie.staticMap.get(key)
  if (list === undefined) pathTrie.staticMap.set(key, [entry])
  else insertSortedEntry(list, entry)
}

function computeMissingParamNames(
  allCaptureNames: ReadonlyArray<string>,
  paramNames: ReadonlyArray<string>,
  wildcardName: string | null,
): ReadonlyArray<string> {
  let total = allCaptureNames.length
  if (total === 0) return emptyStrings
  if (total === 1) {
    let name = allCaptureNames[0]
    if (wildcardName === name || (paramNames.length === 1 && paramNames[0] === name)) {
      return emptyStrings
    }
  }
  let missing: Array<string> | null = null
  for (let i = 0; i < total; i++) {
    let name = allCaptureNames[i]
    if (name === wildcardName || paramNames.includes(name)) continue
    missing ??= []
    missing.push(name)
  }
  return missing ?? emptyStrings
}

function createPathLeaf<data>(
  entry: Entry<data>,
  paramNames: ReadonlyArray<string>,
  wildcardName: string | null,
): PathLeaf<data> {
  // Without hostname captures or pathname optionals, every declared capture is present on this leaf
  let missingParamNames =
    entry.patternParts.hostname === null && entry.patternParts.pathname.optionals.size === 0
      ? emptyStrings
      : computeMissingParamNames(entry.allCaptureNames, paramNames, wildcardName)
  return {
    entry,
    paramNames,
    wildcardName,
    missingParamNames,
  }
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
    addStaticEntry(pathTrie, pathClass.key, entry)
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
        node = getOrCreatePathStaticChild(
          node,
          seg.text,
          pathTrie.hasEncodedStaticChars ? null : pathTrie,
        )
      } else if (seg.kind === 'param') {
        allStaticSoFar = false
        paramNames.push(seg.name)
        let next = (node.param ??= createPathTrieNode<data>())
        if (node.optParam !== null) pathTrie.hasParamOptOverlap = true
        node = next
      } else {
        allStaticSoFar = false
        pathTrie.hasOptParam = true
        paramNames.push(seg.name)
        let next = (node.optParam ??= createPathTrieNode<data>())
        if (node.param !== null) pathTrie.hasParamOptOverlap = true
        node = next
      }

      if (
        termPos < pathClass.terminalIndices.length &&
        pathClass.terminalIndices[termPos] === s + 1
      ) {
        termPos += 1
        if (allStaticSoFar) {
          addStaticEntry(pathTrie, staticPrefixSoFar, entry)
        } else {
          let leaf = createPathLeaf(
            entry,
            paramNames.length > 0 ? paramNames.slice() : emptyStrings,
            null,
          )
          if (node.entries === null) node.entries = [leaf]
          else insertSortedLeaf(node.entries, leaf)
        }
      }
    }

    if (pathClass.trailingWildcard !== null) {
      let leaf = createPathLeaf(
        entry,
        paramNames.length > 0 ? paramNames.slice() : emptyStrings,
        pathClass.trailingWildcard,
      )
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

function insertSortedEntry<data>(list: Array<Entry<data>>, entry: Entry<data>): void {
  let idx = list.length
  while (idx > 0) {
    if (compareStaticEntryPriority(list[idx - 1], entry) <= 0) break
    idx -= 1
  }
  if (idx === list.length) list.push(entry)
  else list.splice(idx, 0, entry)
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

function createMatchContext(
  url: URL,
  proto: 'http:' | 'https:',
  rawPath: string,
  decodedPath: DecodedPathname | null,
  budget: MatchWorkBudget,
  ignoreCase: boolean,
): MatchContext {
  return {
    url,
    proto,
    rawPath,
    decodedPath,
    budget,
    ignoreCase,
    rawPathNoSlash: null,
    lowerHostname: null,
    canonicalHost: undefined,
    canonicalPath: undefined,
  }
}

function entryMatchesUrlRaw<data>(
  entry: Entry<data>,
  url: URL,
  proto: 'http:' | 'https:',
  budget: MatchWorkBudget,
): boolean {
  consumeMatchWork(budget, 1)
  if (!matchesProtocolAndPort(entry.patternParts, proto, url.port)) return false
  if (entry.patternParts.search.size > 0 && !matchSearch(url, entry.patternParts.search, budget)) {
    return false
  }
  return true
}

function entryMatchesUrl<data>(entry: Entry<data>, ctx: MatchContext): boolean {
  return entryMatchesUrlRaw(entry, ctx.url, ctx.proto, ctx.budget)
}

function findFirstOriginlessEntry<data>(
  entries: ReadonlyArray<Entry<data>>,
  url: URL,
  budget: MatchWorkBudget,
): Entry<data> | null {
  for (let i = 0; i < entries.length; i++) {
    let entry = entries[i]
    consumeMatchWork(budget, 1)
    if (
      entry.patternParts.search.size > 0 &&
      !matchSearch(url, entry.patternParts.search, budget)
    ) {
      continue
    }
    return entry
  }
  return null
}

function findFirstMatchingEntryRaw<data>(
  entries: ReadonlyArray<Entry<data>> | null,
  url: URL,
  proto: 'http:' | 'https:',
  budget: MatchWorkBudget,
): Entry<data> | null {
  if (entries === null) return null
  for (let i = 0; i < entries.length; i++) {
    if (entryMatchesUrlRaw(entries[i], url, proto, budget)) return entries[i]
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
  return matchPartUnits(ensureUnitProgram(program), 'hostname', ctx.canonicalHost, ctx.budget)
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
    return matchPartString(program, (ctx.rawPathNoSlash ??= ctx.rawPath.slice(1)), ctx.budget)
  }
  if (ctx.canonicalPath === undefined) {
    ctx.canonicalPath = canonicalizeUrlPart(ctx.url.pathname.slice(1), 'pathname', {
      budget: ctx.budget,
      ignoreCase: ctx.ignoreCase,
    })
  }
  if (ctx.canonicalPath === null) return null
  return matchPartUnits(ensureUnitProgram(program), 'pathname', ctx.canonicalPath, ctx.budget)
}

// ============================================================================
// Direct Fast Path (`matchBest()` on origin-less dynamic tries)
// ============================================================================

function matchPathnameOnlyTrieBest<data>(
  pathTrie: PathTrie<data>,
  url: URL,
  proto: 'http:' | 'https:',
  rawPath: string,
  decodedPath: DecodedPathname | null,
  budget: MatchWorkBudget,
  ignoreCase: boolean,
): Match<string, data> | null {
  let fastEligible =
    decodedPath === null &&
    !pathTrie.hasComplex &&
    !pathTrie.hasMixedOriginRank &&
    !pathTrie.hasParamOptOverlap &&
    !pathTrie.hasEncodedStaticChars &&
    !(pathTrie.hasOptParam && hasEmptyPathSegment(rawPath))

  if (fastEligible && pathTrie.staticMap !== null) {
    let entries = pathTrie.staticMap.get(rawPath)
    if (entries !== undefined) {
      let winner =
        pathTrie.firstProtocolRank === 0 && pathTrie.firstPortRank === 0
          ? findFirstOriginlessEntry(entries, url, budget)
          : findFirstMatchingEntryRaw(entries, url, proto, budget)
      if (winner !== null) {
        let params: Record<string, string | undefined> = {}
        let names = winner.allCaptureNames
        for (let i = 0; i < names.length; i++) params[names[i]] = undefined
        return {
          url,
          pattern: winner.pattern,
          data: winner.data,
          params,
          paramsMeta: { hostname: wildcardHostMeta(url.hostname), pathname: emptyMeta },
        }
      }
    }
  }

  if (
    fastEligible &&
    pathTrie.root !== null &&
    pathTrie.firstProtocolRank === 0 &&
    pathTrie.firstPortRank === 0
  ) {
    return matchRawOriginlessFast(pathTrie.root, rawPath, 1, 0, url, budget)
  }

  let ctx = createMatchContext(url, proto, rawPath, decodedPath, budget, ignoreCase)
  let best = searchPathTrieBest(pathTrie, ctx, emptyMeta, null, null)
  if (best === null) return null
  return buildMatch(
    url,
    best.entry,
    wildcardHostMeta(url.hostname),
    resolveCandidatePathMeta(best, ctx),
  )
}

function matchRawOriginlessFast<data>(
  node: PathTrieNode<data>,
  rawPath: string,
  pos: number,
  capDepth: number,
  url: URL,
  budget: MatchWorkBudget,
): Match<string, data> | null {
  let len = rawPath.length
  while (true) {
    consumeMatchWork(budget, 1)
    let slash = rawPath.indexOf('/', pos)
    let segEnd = slash === -1 ? len : slash
    let isLastSeg = slash === -1
    let segLen = segEnd - pos

    // fastEligible guarantees no node has both param and optParam, and segLen === 0 never occurs with optParam
    let paramNode = node.param ?? node.optParam
    let staticChild = lookupPathStaticRaw(node, rawPath, pos, segEnd, segLen)

    if (staticChild !== undefined) {
      if (paramNode === null && node.trailingWildcards === null) {
        if (isLastSeg) return matchFastLeaf(staticChild.entries, capDepth, -1, rawPath, url, budget)
        node = staticChild
        pos = slash + 1
        continue
      }
      let match = isLastSeg
        ? matchFastLeaf(staticChild.entries, capDepth, -1, rawPath, url, budget)
        : matchRawOriginlessFast(staticChild, rawPath, slash + 1, capDepth, url, budget)
      if (match !== null) return match
    }

    if (paramNode !== null && segLen > 0) {
      let paramEncLen = scanParamEncodedLength(rawPath, pos, segEnd)
      if (paramEncLen !== -1) {
        setFastCapFrame(capDepth, pos, segEnd, paramEncLen)
        if (node.trailingWildcards === null) {
          if (isLastSeg) {
            return matchFastLeaf(paramNode.entries, capDepth + 1, -1, rawPath, url, budget)
          }
          node = paramNode
          pos = slash + 1
          capDepth += 1
          continue
        }
        let match = isLastSeg
          ? matchFastLeaf(paramNode.entries, capDepth + 1, -1, rawPath, url, budget)
          : matchRawOriginlessFast(paramNode, rawPath, slash + 1, capDepth + 1, url, budget)
        if (match !== null) return match
      }
    }

    if (node.trailingWildcards !== null) {
      return matchFastLeaf(node.trailingWildcards, capDepth, pos, rawPath, url, budget)
    }

    return null
  }
}

function matchFastLeaf<data>(
  leaves: ReadonlyArray<PathLeaf<data>> | null,
  capDepth: number,
  wildcardStart: number,
  rawPath: string,
  url: URL,
  budget: MatchWorkBudget,
): Match<string, data> | null {
  if (leaves === null) return null
  for (let i = 0; i < leaves.length; i++) {
    let leaf = leaves[i]
    let entry = leaf.entry
    consumeMatchWork(budget, 1)
    if (
      entry.patternParts.search.size > 0 &&
      !matchSearch(url, entry.patternParts.search, budget)
    ) {
      continue
    }
    let paramNames = leaf.paramNames
    let wildcardName = leaf.wildcardName
    let params: Record<string, string | undefined> = {}
    let pathnameMeta: Array<MatchParamMeta>

    if (capDepth === 1 && wildcardName === null) {
      let sBegin = capStacks.begin[0]
      let sEnd = capStacks.end[0]
      let begin = sBegin - 1
      let end = begin + capStacks.encLen[0]
      let value = rawPath.slice(sBegin, sEnd)
      let name = paramNames[0]
      params[name] = value
      pathnameMeta = [{ type: ':', name, value, begin, end }]
    } else {
      pathnameMeta = []
      let rawPosCursor = 1
      let rawEncCursor = 0
      for (let k = 0; k < capDepth; k++) {
        let sBegin = capStacks.begin[k]
        let sEnd = capStacks.end[k]
        rawEncCursor += sBegin - rawPosCursor
        let begin = rawEncCursor
        rawEncCursor += capStacks.encLen[k]
        let end = rawEncCursor
        rawPosCursor = sEnd
        let value = rawPath.slice(sBegin, sEnd)
        let name = paramNames[k]
        params[name] = value
        pathnameMeta.push({ type: ':', name, value, begin, end })
      }

      if (wildcardName !== null) {
        rawEncCursor += wildcardStart - rawPosCursor
        let begin = rawEncCursor
        let end = begin + encodedPathnameLength(rawPath, wildcardStart, rawPath.length)
        let value = rawPath.slice(wildcardStart)
        if (wildcardName !== '*') {
          params[wildcardName] = value
        }
        pathnameMeta.push({ type: '*', name: wildcardName, value, begin, end })
      }
    }

    let missing = leaf.missingParamNames
    for (let k = 0; k < missing.length; k++) {
      params[missing[k]] = undefined
    }

    return {
      url,
      pattern: entry.pattern,
      data: entry.data,
      params,
      paramsMeta: {
        hostname: wildcardHostMeta(url.hostname),
        pathname: pathnameMeta,
      },
    }
  }
  return null
}

// ============================================================================
// General PathTrie Search (`matchBest()` and `searchAll()`)
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
    let winner = findFirstMatchingEntryRaw(
      pathTrie.staticMap.get(ctx.rawPath) ?? null,
      ctx.url,
      ctx.proto,
      ctx.budget,
    )
    if (winner !== null) {
      let hMeta = hostEntryFilter !== null ? hostEntryFilter(winner) : hostnameMeta
      best = pickBetterCandidate(
        best,
        { entry: winner, hostnameMeta: hMeta, pathnameMeta: emptyMeta, deferred: null },
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
    let caps: Array<PendingCapture> | null | undefined = undefined
    for (let i = 0; i < leaves.length; i++) {
      let leaf = leaves[i]
      let entry = leaf.entry
      if (!entryMatchesUrl(entry, ctx)) continue

      if (caps === undefined) caps = snapshotPendingCaps(capDepth)
      let hMeta = hostEntryFilter !== null ? hostEntryFilter(entry) : hostnameMeta
      best = pickBetterCandidate(
        best,
        {
          entry,
          hostnameMeta: hMeta,
          pathnameMeta: emptyMeta,
          deferred: { leaf, caps, wildcardStart, wildcardDecodedSeg },
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
        setCapFrame(capDepth, CAP_OMITTED, pos, pos, -1)
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
        setCapFrame(capDepth, CAP_PARAM, pos, segEnd, -1)
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
        setCapFrame(capDepth, CAP_OMITTED, seg.encBegin, seg.encEnd, segIdx)
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
        setCapFrame(capDepth, CAP_PARAM, seg.encBegin, seg.encEnd, segIdx)
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
  matches: Array<Match<string, data>>,
  insertions: Array<number>,
  onLeafBatch: (sorted: boolean) => void,
  hostEntryFilter: ((entry: Entry<data>) => ReadonlyArray<MatchParamMeta>) | null,
): void {
  let canUseStaticMap = ctx.decodedPath === null || !ctx.decodedPath.anyNonStructuralSep

  if (canUseStaticMap && pathTrie.staticMap !== null) {
    let entries = pathTrie.staticMap.get(ctx.rawPath)
    if (entries !== undefined) {
      let emitted = 0
      for (let i = 0; i < entries.length; i++) {
        let entry = entries[i]
        if (!entryMatchesUrl(entry, ctx)) continue
        let hMeta = hostEntryFilter !== null ? hostEntryFilter(entry) : hostnameMeta
        matches.push(buildMatch(ctx.url, entry, hMeta, emptyMeta))
        insertions.push(entry.insertion)
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
    let resolved: ResolvedPendingSpans | null = null
    let emitted = 0
    for (let i = 0; i < leaves.length; i++) {
      let leaf = leaves[i]
      let entry = leaf.entry
      if (!entryMatchesUrl(entry, ctx)) continue
      resolved ??= resolvePathSpans(
        null,
        capDepth,
        wildcardStart,
        wildcardDecodedSeg,
        ctx.rawPath,
        ctx.decodedPath,
      )
      let hMeta = hostEntryFilter !== null ? hostEntryFilter(entry) : hostnameMeta
      let pMeta = materializePathMeta(leaf, resolved)
      matches.push(buildMatch(ctx.url, entry, hMeta, pMeta))
      insertions.push(entry.insertion)
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
      matches.push(buildMatch(ctx.url, entry, hMeta, pMeta))
      insertions.push(entry.insertion)
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
        setCapFrame(capDepth, CAP_OMITTED, pos, pos, -1)
        if (isLastSeg) emitLeaves(node.optParam.entries, capDepth + 1, -1, -1)
        else walk(node.optParam, nextPos, capDepth + 1)
      } else if (
        segLen > 0 &&
        (node.param !== null || node.optParam !== null) &&
        !hasDotInRange(rawPath, pos, segEnd)
      ) {
        setCapFrame(capDepth, CAP_PARAM, pos, segEnd, -1)
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
        setCapFrame(capDepth, CAP_OMITTED, seg.encBegin, seg.encEnd, segIdx)
        if (isLastSeg) emitLeaves(node.optParam.entries, capDepth + 1, -1, -1)
        else walk(node.optParam, segIdx + 1, capDepth + 1)
      } else if (
        seg.decoded.length > 0 &&
        !seg.hasStructuralDot &&
        (node.param !== null || node.optParam !== null)
      ) {
        setCapFrame(capDepth, CAP_PARAM, seg.encBegin, seg.encEnd, segIdx)
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
// Dynamic & Complex Hostname Walkers (shared by `matchBest()` and `searchAll()`)
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

  let walk = (node: HostTrieNode<data>, segEnd: number, depth: number) => {
    consumeMatchWork(ctx.budget, 1)

    if (node.leadingWildcards !== null) {
      visit(node.leadingWildcards, (entry) =>
        buildHostMetaFromCaptures(
          lowerHostname,
          entry.hostnameParamNames,
          depth,
          entry.hostnameWildcardName,
          segEnd,
        ),
      )
    }

    let dot = segEnd === 0 ? -1 : lowerHostname.lastIndexOf('.', segEnd - 1)
    let segBegin = dot + 1
    let isLeftmost = dot === -1

    let staticChild = lookupHostStaticRaw(node, lowerHostname, segBegin, segEnd, segEnd - segBegin)
    if (staticChild !== undefined) {
      if (isLeftmost) {
        if (staticChild.pathTrie !== null) {
          visit(staticChild.pathTrie, (entry) =>
            buildHostMetaFromCaptures(lowerHostname, entry.hostnameParamNames, depth, null, -1),
          )
        }
      } else {
        walk(staticChild, dot, depth)
      }
    }

    if (node.param !== null && segEnd > segBegin) {
      setHostCapFrame(depth, segBegin, segEnd)
      if (isLeftmost) {
        if (node.param.pathTrie !== null) {
          visit(node.param.pathTrie, (entry) =>
            buildHostMetaFromCaptures(lowerHostname, entry.hostnameParamNames, depth + 1, null, -1),
          )
        }
      } else {
        walk(node.param, dot, depth + 1)
      }
    }
  }

  walk(root, lowerHostname.length, 0)
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
  let resolved = resolvePathSpans(
    d.caps,
    d.caps?.length ?? 0,
    d.wildcardStart,
    d.wildcardDecodedSeg,
    ctx.rawPath,
    ctx.decodedPath,
  )
  let meta = materializePathMeta(d.leaf, resolved)
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

function wildcardHostMetaFromDecoded(decodedHostname: string): ReadonlyArray<MatchParamMeta> {
  return [{ type: '*', name: '*', value: decodedHostname, begin: 0, end: decodedHostname.length }]
}

function wildcardHostMeta(rawHostname: string): ReadonlyArray<MatchParamMeta> {
  return wildcardHostMetaFromDecoded(decodeHostname(rawHostname))
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
      omitted: capStacks.type[i] === CAP_OMITTED,
    }
  }
  return result
}

type ResolvedSpan = {
  readonly paramIdx: number
  readonly value: string
  readonly begin: number
  readonly end: number
}

type ResolvedPendingSpans = {
  readonly params: ReadonlyArray<ResolvedSpan>
  readonly wildcard: { readonly value: string; readonly begin: number; readonly end: number } | null
}

const emptyResolvedSpans: ResolvedPendingSpans = { params: [], wildcard: null }

// Resolves capture values and canonical encoded offsets from either a snapshotted PendingCapture
// array (when backtracking in searchPathTrieBest) or directly from capStacks (in emitLeaves).
function resolvePathSpans(
  caps: ReadonlyArray<PendingCapture> | null,
  capDepth: number,
  wildcardStart: number,
  wildcardDecodedSeg: number,
  rawPath: string,
  decodedPath: DecodedPathname | null,
): ResolvedPendingSpans {
  let hasWildcard = wildcardStart !== -1 || wildcardDecodedSeg !== -1
  if (capDepth === 0 && !hasWildcard) return emptyResolvedSpans

  let params: Array<ResolvedSpan> = []
  let isRaw = decodedPath === null
  let rawPosCursor = 1
  let rawEncCursor = 0

  for (let i = 0; i < capDepth; i++) {
    let omitted = caps !== null ? caps[i].omitted : capStacks.type[i] === CAP_OMITTED
    if (omitted) continue
    if (isRaw) {
      let segStart = caps !== null ? caps[i].segStart : capStacks.begin[i]
      let segEnd = caps !== null ? caps[i].segEnd : capStacks.end[i]
      rawEncCursor += encodedPathnameLength(rawPath, rawPosCursor, segStart)
      let begin = rawEncCursor
      rawEncCursor += encodedPathnameLength(rawPath, segStart, segEnd)
      let end = rawEncCursor
      rawPosCursor = segEnd
      params.push({ paramIdx: i, value: rawPath.slice(segStart, segEnd), begin, end })
    } else {
      let segIdx = caps !== null ? caps[i].decodedSegIndex : capStacks.segIdx[i]
      let seg = decodedPath!.segments[segIdx]
      params.push({ paramIdx: i, value: seg.decoded, begin: seg.encBegin, end: seg.encEnd })
    }
  }

  let wildcard: ResolvedPendingSpans['wildcard'] = null
  if (hasWildcard) {
    if (isRaw) {
      rawEncCursor += encodedPathnameLength(rawPath, rawPosCursor, wildcardStart)
      let begin = rawEncCursor
      let end = begin + encodedPathnameLength(rawPath, wildcardStart, rawPath.length)
      wildcard = { value: rawPath.slice(wildcardStart), begin, end }
    } else {
      let seg = decodedPath!.segments[wildcardDecodedSeg]
      wildcard = {
        value: decodedPath!.fullDecoded.slice(seg.decodedStart),
        begin: seg.encBegin,
        end: decodedPath!.totalEncLen,
      }
    }
  }

  return { params, wildcard }
}

function materializePathMeta<data>(
  leaf: PathLeaf<data>,
  resolved: ResolvedPendingSpans,
): ReadonlyArray<MatchParamMeta> {
  let paramCount = resolved.params.length
  let wildcardName = leaf.wildcardName
  if (paramCount === 0 && wildcardName === null) return emptyMeta

  let paramNames = leaf.paramNames
  let result = new Array<MatchParamMeta>(paramCount + (wildcardName !== null ? 1 : 0))
  for (let i = 0; i < paramCount; i++) {
    let span = resolved.params[i]
    result[i] = {
      type: ':',
      name: paramNames[span.paramIdx],
      value: span.value,
      begin: span.begin,
      end: span.end,
    }
  }
  if (wildcardName !== null) {
    let w = resolved.wildcard!
    result[paramCount] = {
      type: '*',
      name: wildcardName,
      value: w.value,
      begin: w.begin,
      end: w.end,
    }
  }
  return result
}

function buildHostMetaFromCaptures(
  lowerHostname: string,
  paramNamesRtl: ReadonlyArray<string>,
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
    let begin = hostCapStacks.begin[i]
    let end = hostCapStacks.end[i]
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
            let decoded = decodePercentChunk(segRaw.slice(dotStart, i), true)
            if (decoded === null) return null
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
  let names: Array<string> | null = null
  let seen: Set<string> | null = null
  let addPart = (part: PartPattern) => {
    let tokens = part.tokens
    for (let i = 0; i < tokens.length; i++) {
      let tok = tokens[i]
      if ((tok.type === ':' || tok.type === '*') && tok.name !== '*') {
        if (names === null) {
          names = [tok.name]
        } else if (names.length === 1 && seen === null) {
          if (names[0] !== tok.name) names.push(tok.name)
        } else {
          seen ??= new Set(names)
          if (!seen.has(tok.name)) {
            seen.add(tok.name)
            names.push(tok.name)
          }
        }
      }
    }
  }
  if (parts.hostname !== null) addPart(parts.hostname)
  addPart(parts.pathname)
  return names ?? emptyStrings
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

function serializedPartUtf8Size(part: PartPattern): number {
  let size = 0
  let tokens = part.tokens
  for (let i = 0; i < tokens.length; i++) {
    let tok = tokens[i]
    if (tok.type === '(' || tok.type === ')' || tok.type === 'separator') {
      size += 1
    } else if (tok.type === ':' || tok.type === '*') {
      size += tok.name === '*' ? 1 : 1 + utf8Size(tok.name)
    } else if (tok.type === 'text') {
      let text = tok.text
      for (let j = 0; j < text.length; j++) {
        let code = text.charCodeAt(j)
        if (code <= 0x7f) {
          // Special chars : * ( ) \ are escaped with a leading '\'
          size += code === 58 || code === 42 || code === 40 || code === 41 || code === 92 ? 2 : 1
        } else if (code <= 0x7ff) {
          size += 2
        } else if (code >= 0xd800 && code <= 0xdbff && j + 1 < text.length) {
          size += 4
          j += 1
        } else {
          size += 3
        }
      }
    }
  }
  return size
}

function serializedPatternUtf8Size(parts: RoutePatternParts): number {
  let size = 0
  if (parts.protocol !== null || parts.hostname !== null || parts.port !== null) {
    if (parts.protocol !== null) size += parts.protocol.length
    size += 3 // '://'
    if (parts.hostname !== null) size += serializedPartUtf8Size(parts.hostname)
    if (parts.port !== null && parts.port !== '') size += 1 + utf8Size(parts.port)
  }
  size += 1 + serializedPartUtf8Size(parts.pathname)
  if (parts.search.size > 0) {
    let searchStr = serializeSearch(parts)
    if (searchStr.length > 0) size += 1 + utf8Size(searchStr)
  }
  return size
}

function createPathTrie<data>(): PathTrie<data> {
  return {
    staticMap: null,
    root: null,
    suffixRoot: null,
    hasOptParam: false,
    hasParamOptOverlap: false,
    hasEncodedStaticChars: false,
    hasComplex: false,
    hasMixedOriginRank: false,
    firstProtocolRank: -1,
    firstPortRank: -1,
  }
}

function getOrCreateHostStaticChild<data>(
  node: HostTrieNode<data>,
  key: string,
): HostTrieNode<data> {
  if (node.static !== null) {
    let existing = node.static.get(key)
    if (existing !== undefined) return existing
    let created = createHostTrieNode<data>()
    node.static.set(key, created)
    return created
  }
  if (node.staticKey === null) {
    let created = createHostTrieNode<data>()
    node.staticKey = key
    node.staticChild = created
    return created
  }
  if (node.staticKey === key) return node.staticChild!
  let map = new Map<string, HostTrieNode<data>>()
  map.set(node.staticKey, node.staticChild!)
  let created = createHostTrieNode<data>()
  map.set(key, created)
  node.static = map
  node.staticKey = null
  node.staticChild = null
  return created
}

function lookupHostStaticRaw<data>(
  node: HostTrieNode<data>,
  lowerHostname: string,
  segBegin: number,
  segEnd: number,
  segLen: number,
): HostTrieNode<data> | undefined {
  let singleKey = node.staticKey
  if (singleKey !== null) {
    return segLen === singleKey.length && lowerHostname.startsWith(singleKey, segBegin)
      ? node.staticChild!
      : undefined
  }
  return node.static?.get(lowerHostname.slice(segBegin, segEnd))
}

function getOrCreatePathStaticChild<data>(
  node: PathTrieNode<data>,
  key: string,
  trackEncodedTrie: PathTrie<data> | null = null,
): PathTrieNode<data> {
  if (node.static !== null) {
    let existing = node.static.get(key)
    if (existing !== undefined) return existing
    let created = createPathTrieNode<data>()
    node.static.set(key, created)
    markEncodedStatic(trackEncodedTrie, key)
    return created
  }
  if (node.staticKeys !== null) {
    let keys = node.staticKeys
    let children = node.staticChildren!
    for (let i = 0; i < keys.length; i++) {
      if (keys[i] === key) return children[i]
    }
    let created = createPathTrieNode<data>()
    markEncodedStatic(trackEncodedTrie, key)
    if (keys.length < 4) {
      keys.push(key)
      children.push(created)
      return created
    }
    let map = new Map<string, PathTrieNode<data>>()
    for (let i = 0; i < keys.length; i++) map.set(keys[i], children[i])
    map.set(key, created)
    node.static = map
    node.staticKeys = null
    node.staticChildren = null
    return created
  }
  if (node.staticKey === null) {
    let created = createPathTrieNode<data>()
    node.staticKey = key
    node.staticChild = created
    markEncodedStatic(trackEncodedTrie, key)
    return created
  }
  if (node.staticKey === key) return node.staticChild!
  let created = createPathTrieNode<data>()
  markEncodedStatic(trackEncodedTrie, key)
  node.staticKeys = [node.staticKey, key]
  node.staticChildren = [node.staticChild!, created]
  node.staticKey = null
  node.staticChild = null
  return created
}

function markEncodedStatic<data>(trie: PathTrie<data> | null, key: string): void {
  if (trie !== null && encodedPathnameLength(key, 0, key.length) !== key.length) {
    trie.hasEncodedStaticChars = true
  }
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
  let keys = node.staticKeys
  if (keys !== null) {
    for (let i = 0; i < keys.length; i++) {
      let k = keys[i]
      if (segLen === k.length && rawPath.startsWith(k, pos)) return node.staticChildren![i]
    }
    return undefined
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
  let keys = node.staticKeys
  if (keys !== null) {
    for (let i = 0; i < keys.length; i++) {
      if (keys[i] === key) return node.staticChildren![i]
    }
    return undefined
  }
  return node.static?.get(key)
}

function createPathTrieNode<data>(): PathTrieNode<data> {
  return {
    staticKey: null,
    staticChild: null,
    staticKeys: null,
    staticChildren: null,
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
    staticKey: null,
    staticChild: null,
    static: null,
    param: null,
    leadingWildcards: null,
    pathTrie: null,
  }
}
