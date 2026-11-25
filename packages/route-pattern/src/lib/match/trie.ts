import type { PartPattern, RoutePattern, RoutePatternParts } from '../route-pattern.ts'
import { parsePattern } from '../route-pattern/parse.ts'
import { serializeSearch } from '../route-pattern/serialize.ts'
import { compare, compareHostnameRanges, comparePathnameRanges } from '../specificity.ts'
import { decodeHostname } from './decode.ts'
import {
  canonicalizePatternSegmentText,
  canonicalizeUrlPart,
  compilePart,
  encodedPathnameLength,
  ensureUnitProgram,
  matchPartString,
  matchPartUnits,
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
  // For dynamic-hostname trie entries, param names in right-to-left label order (and trailing/leading wildcard name if any)
  readonly hostnameParamNames: ReadonlyArray<string>
  readonly hostnameWildcardName: string | null
  readonly hostnameProgram: PartProgram | null
  pathnameProgram: PartProgram | null
}

type PathLeaf<data> = {
  readonly entry: Entry<data>
  readonly paramNames: ReadonlyArray<string>
  readonly wildcardName: string | null
  // True when every declared capture name in `entry.allCaptureNames` is covered by `paramNames` + `wildcardName`
  readonly coversAllCaptures: boolean
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
  hasDynamic: boolean
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
  readonly type: ':' | '*'
  readonly segStart: number
  readonly segEnd: number
  // For decoded % pathnames, index into segments (-1 for raw fast-path)
  readonly decodedSegIndex: number
  // True when an optParam matched empty segment "" (omitted)
  readonly omitted: boolean
}

type CandidateMatch<data> = {
  readonly entry: Entry<data>
  readonly hostnameMeta: ReadonlyArray<MatchParamMeta>
  readonly pathnameMeta: ReadonlyArray<MatchParamMeta>
  // Deferred pathname capture construction when matched via fast-path trie
  readonly deferredLeaf: PathLeaf<data> | null
  readonly deferredCaps: Array<PendingCapture> | null
  readonly deferredWildcardStart: number
  readonly deferredWildcardDecodedSeg: number
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
      // Right-to-left labels
      readonly labels: ReadonlyArray<
        | { readonly kind: 'static'; readonly text: string }
        | { readonly kind: 'param'; readonly name: string }
      >
      readonly leadingWildcard: string | null
    }
  | { readonly kind: 'complex' }

// Precomputed 128-byte ASCII fast check for whether a raw pathname has any char with encoded len !== 1
// (i.e. anything other than unreserved ASCII + '/' + '.')
const plainAsciiLen1 = new Uint8Array(128)
for (let c = 48; c <= 57; c++) plainAsciiLen1[c] = 1
for (let c = 65; c <= 90; c++) plainAsciiLen1[c] = 1
for (let c = 97; c <= 122; c++) plainAsciiLen1[c] = 1
plainAsciiLen1[33] = 1 // !
plainAsciiLen1[39] = 1 // '
plainAsciiLen1[40] = 1 // (
plainAsciiLen1[41] = 1 // )
plainAsciiLen1[42] = 1 // *
plainAsciiLen1[45] = 1 // -
plainAsciiLen1[46] = 1 // .
plainAsciiLen1[47] = 1 // /
plainAsciiLen1[95] = 1 // _
plainAsciiLen1[126] = 1 // ~

// Reusable growable capture stacks for trie traversal (synchronous & non-reentrant)
let capTypeStack = new Uint8Array(256) // 0 = ':', 1 = '*', 2 = omitted
let capBeginStack = new Int32Array(256)
let capEndStack = new Int32Array(256)
let capSegIdxStack = new Int32Array(256)
let lastFastInsertion = 0

function growCapStacks(minLength: number): void {
  let nextLen = capTypeStack.length
  while (nextLen < minLength) nextLen *= 2

  let nextType = new Uint8Array(nextLen)
  nextType.set(capTypeStack)
  capTypeStack = nextType

  let nextBegin = new Int32Array(nextLen)
  nextBegin.set(capBeginStack)
  capBeginStack = nextBegin

  let nextEnd = new Int32Array(nextLen)
  nextEnd.set(capEndStack)
  capEndStack = nextEnd

  let nextSegIdx = new Int32Array(nextLen)
  nextSegIdx.set(capSegIdxStack)
  capSegIdxStack = nextSegIdx
}

function setCapFrame(
  depth: number,
  type: number,
  begin: number,
  end: number,
  segIdx: number,
): void {
  if (depth >= capTypeStack.length) growCapStacks(depth + 1)
  capTypeStack[depth] = type
  capBeginStack[depth] = begin
  capEndStack[depth] = end
  capSegIdxStack[depth] = segIdx
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
    this.#budget = createMatchWorkBudget(this.#limits.maxMatchWork)
  }

  insert(pattern: string | RoutePattern, data: data): void {
    let patternSize: number
    if (typeof pattern === 'string') {
      let source = pattern
      patternSize = this.#checkSizeLimits(source)
      pattern = parsePattern(pattern)
      let canonicalSize = serializedPatternUtf8Size(pattern._parts)
      if (canonicalSize !== patternSize) {
        checkMatcherLimit('maxPatternSize', this.#limits.maxPatternSize, canonicalSize)
        checkMatcherLimit('maxMatcherSize', this.#limits.maxMatcherSize, this.#size + canonicalSize)
        patternSize = canonicalSize
      }
    } else {
      let canonicalSize = serializedPatternUtf8Size(pattern._parts)
      checkMatcherLimit('maxPatternSize', this.#limits.maxPatternSize, canonicalSize)
      checkMatcherLimit('maxMatcherSize', this.#limits.maxMatcherSize, this.#size + canonicalSize)
      patternSize = canonicalSize
    }

    let parts = pattern._parts
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

    let allCaptureNames = collectAllCaptureNames(parts)

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
      pathClass.kind === 'complex'
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
        if (this.#staticHostTries === null) this.#staticHostTries = new Map()
        let pathTrie = this.#staticHostTries.get(hostClass.host)
        if (pathTrie === undefined) {
          pathTrie = createPathTrie<data>()
          this.#staticHostTries.set(hostClass.host, pathTrie)
        }
        insertIntoPathTrie(pathTrie, pathClass, entry)
      } else if (hostClass.kind === 'trie') {
        if (this.#dynamicHostRoot === null) this.#dynamicHostRoot = createHostTrieNode<data>()
        let node = this.#dynamicHostRoot
        for (let label of hostClass.labels) {
          if (label.kind === 'static') {
            if (node.static === null) node.static = new Map()
            let next = node.static.get(label.text)
            if (next === undefined) {
              next = createHostTrieNode<data>()
              node.static.set(label.text, next)
            }
            node = next
          } else {
            if (node.param === null) node.param = createHostTrieNode<data>()
            node = node.param
          }
        }
        let targetTrie: PathTrie<data>
        if (hostClass.leadingWildcard !== null) {
          if (node.leadingWildcards === null) node.leadingWildcards = createPathTrie<data>()
          targetTrie = node.leadingWildcards
        } else {
          if (node.pathTrie === null) node.pathTrie = createPathTrie<data>()
          targetTrie = node.pathTrie
        }
        insertIntoPathTrie(targetTrie, pathClass, entry)
      } else {
        // complex hostname: always need pathnameProgram if not already compiled?
        // Actually we can evaluate pathname via compilePart lazily or eagerly here.
        if (entry.pathnameProgram === null) {
          entry.pathnameProgram = compilePart(parts.pathname, { ignoreCase: this.ignoreCase })
        }
        if (this.#complexHostEntries === null) this.#complexHostEntries = []
        this.#complexHostEntries.push(entry)
      }
    }

    this.#size += patternSize
  }

  #checkSizeLimits(source: string): number {
    let size = utf8Size(source)
    checkMatcherLimit('maxPatternSize', this.#limits.maxPatternSize, size)
    checkMatcherLimit('maxMatcherSize', this.#limits.maxMatcherSize, this.#size + size)
    return size
  }

  matchBest(url: URL): Match<string, data> | null {
    let proto = url.protocol
    if (proto !== 'https:' && proto !== 'http:') return null
    if (this.#insertion === 0) return null

    let budget = this.#budget
    budget.actual = 0

    let rawPathname = url.pathname
    let pathLen = rawPathname.length - 1
    consumeMatchWork(budget, pathLen)

    let hasPercent = rawPathname.indexOf('%') !== -1
    let decodedPath: DecodedPathname | null = null
    let matchRawPath: string
    if (hasPercent) {
      decodedPath = decodeUrlPathname(rawPathname, this.ignoreCase, budget)
      if (decodedPath === null) return null
      matchRawPath = '/' + decodedPath.fullDecoded
    } else {
      matchRawPath = this.ignoreCase ? rawPathname.toLowerCase() : rawPathname
    }

    if (!this.#hasOriginPatterns) {
      let pathTrie = this.#pathnameOnlyTrie
      let optParamEmptyRisk =
        !hasPercent && pathTrie.hasOptParam && hasEmptyPathSegment(matchRawPath)

      // O(1) static exact match fast path
      if (
        !hasPercent &&
        pathTrie.staticMap !== null &&
        !pathTrie.hasComplex &&
        !pathTrie.hasMixedOriginRank &&
        !optParamEmptyRisk
      ) {
        let leaves = pathTrie.staticMap.get(matchRawPath)
        if (leaves !== undefined) {
          let winner =
            pathTrie.firstProtocolRank === 0 && pathTrie.firstPortRank === 0
              ? findBestOriginlessStaticLeaf(leaves, url, budget)
              : findBestStaticLeaf(leaves, url, proto, budget)
          if (winner !== null) {
            return materializeStaticOriginlessMatch(url, winner)
          }
        }
      }

      // Zero-intermediate-allocation direct dynamic fast path
      if (
        !hasPercent &&
        pathTrie.root !== null &&
        !pathTrie.hasComplex &&
        !pathTrie.hasMixedOriginRank &&
        !optParamEmptyRisk &&
        pathTrie.firstProtocolRank === 0 &&
        pathTrie.firstPortRank === 0
      ) {
        return matchRawOriginlessFast(pathTrie.root, matchRawPath, 1, 0, url, budget)
      }

      let best = searchPathTrieBest(
        pathTrie,
        url,
        proto,
        matchRawPath,
        decodedPath,
        emptyMeta,
        null,
        null,
        null,
        budget,
        this.ignoreCase,
      )
      if (best === null) return null
      let decodedHostname = decodeHostname(url.hostname)
      let wildcardHostMeta: ReadonlyArray<MatchParamMeta> = [
        { type: '*', name: '*', value: decodedHostname, begin: 0, end: decodedHostname.length },
      ]
      return materializeCandidate(url, best, wildcardHostMeta, matchRawPath, decodedPath)
    }

    // General path with origin (hostname/protocol/port) patterns
    let rawHostname = url.hostname
    consumeMatchWork(budget, rawHostname.length)
    let decodedHostname = decodeHostname(rawHostname)
    let lowerHostname = decodedHostname.toLowerCase()
    let best: CandidateMatch<data> | null = null

    // 1. Exact static hostname lookup
    if (this.#staticHostTries !== null) {
      let staticHostTrie = this.#staticHostTries.get(lowerHostname)
      if (staticHostTrie !== undefined) {
        best = searchPathTrieBest(
          staticHostTrie,
          url,
          proto,
          matchRawPath,
          decodedPath,
          emptyMeta,
          lowerHostname,
          best,
          null,
          budget,
          this.ignoreCase,
        )
      }
    }

    // 2. Dynamic hostname trie (reversed labels: right-to-left)
    if (this.#dynamicHostRoot !== null) {
      best = searchDynamicHostTrieBest(
        this.#dynamicHostRoot,
        lowerHostname,
        url,
        proto,
        matchRawPath,
        decodedPath,
        best,
        budget,
        this.ignoreCase,
      )
    }

    // 3. Complex hostname entries
    if (this.#complexHostEntries !== null) {
      best = searchComplexHostEntriesBest(
        this.#complexHostEntries,
        lowerHostname,
        url,
        proto,
        matchRawPath,
        decodedPath,
        best,
        budget,
        this.ignoreCase,
      )
    }

    // 4. Origin-less pathname trie:
    // If we already have a best match from an explicit-hostname pattern that is NOT a full-hostname
    // wildcard (i.e. it has better protocol, port, or hostname specificity than origin-less),
    // we only need to check #pathnameOnlyTrie if best could possibly be beaten (e.g., if
    // #pathnameOnlyTrie has explicit protocol or best had full-hostname wildcard).
    let wildcardHostMeta: ReadonlyArray<MatchParamMeta> = [
      { type: '*', name: '*', value: decodedHostname, begin: 0, end: decodedHostname.length },
    ]
    let needOriginless =
      best === null ||
      this.#hasFullWildcardHostname ||
      this.#pathnameOnlyTrie.firstProtocolRank === 1 ||
      this.#pathnameOnlyTrie.hasMixedOriginRank
    if (needOriginless) {
      best = searchPathTrieBest(
        this.#pathnameOnlyTrie,
        url,
        proto,
        matchRawPath,
        decodedPath,
        wildcardHostMeta,
        lowerHostname,
        best,
        null,
        budget,
        this.ignoreCase,
      )
    }

    if (best === null) return null
    return materializeCandidate(url, best, best.hostnameMeta, matchRawPath, decodedPath)
  }

  searchAll(url: URL): Array<Match<string, data>> {
    let proto = url.protocol
    if (proto !== 'https:' && proto !== 'http:') return []
    if (this.#insertion === 0) return []

    let budget = this.#budget
    budget.actual = 0

    let rawPathname = url.pathname
    let pathLen = rawPathname.length - 1
    consumeMatchWork(budget, pathLen)

    let hasPercent = rawPathname.indexOf('%') !== -1
    let decodedPath: DecodedPathname | null = null
    let matchRawPath: string
    if (hasPercent) {
      decodedPath = decodeUrlPathname(rawPathname, this.ignoreCase, budget)
      if (decodedPath === null) return []
      matchRawPath = '/' + decodedPath.fullDecoded
    } else {
      matchRawPath = this.ignoreCase ? rawPathname.toLowerCase() : rawPathname
    }

    let decodedHostname = decodeHostname(url.hostname)
    let wildcardHostMeta: ReadonlyArray<MatchParamMeta> = [
      { type: '*', name: '*', value: decodedHostname, begin: 0, end: decodedHostname.length },
    ]

    let results: Array<{ match: Match<string, data>; insertion: number }> = []
    let leafBatchCount = 0
    let singleBatchAlreadySorted = true

    let onLeafBatch = (sorted: boolean) => {
      leafBatchCount += 1
      if (!sorted || leafBatchCount > 1) singleBatchAlreadySorted = false
    }

    searchPathTrieAll(
      this.#pathnameOnlyTrie,
      url,
      proto,
      matchRawPath,
      decodedPath,
      wildcardHostMeta,
      results,
      budget,
      this.ignoreCase,
      onLeafBatch,
    )

    if (this.#hasOriginPatterns) {
      consumeMatchWork(budget, url.hostname.length)
      let lowerHostname = decodedHostname.toLowerCase()
      if (this.#staticHostTries !== null) {
        let staticHostTrie = this.#staticHostTries.get(lowerHostname)
        if (staticHostTrie !== undefined) {
          searchPathTrieAll(
            staticHostTrie,
            url,
            proto,
            matchRawPath,
            decodedPath,
            emptyMeta,
            results,
            budget,
            this.ignoreCase,
            onLeafBatch,
          )
        }
      }
      if (this.#dynamicHostRoot !== null) {
        searchDynamicHostTrieAll(
          this.#dynamicHostRoot,
          lowerHostname,
          url,
          proto,
          matchRawPath,
          decodedPath,
          results,
          budget,
          this.ignoreCase,
          onLeafBatch,
        )
      }
      if (this.#complexHostEntries !== null) {
        searchComplexHostEntriesAll(
          this.#complexHostEntries,
          lowerHostname,
          url,
          proto,
          matchRawPath,
          decodedPath,
          results,
          budget,
          this.ignoreCase,
          onLeafBatch,
        )
      }
    }

    if (results.length <= 1) {
      return results.length === 1 ? [results[0].match] : []
    }

    if (singleBatchAlreadySorted) {
      let out = new Array<Match<string, data>>(results.length)
      for (let i = 0; i < results.length; i++) out[i] = results[i].match
      return out
    }

    // Preserve insertion order before stable descending specificity sort
    results.sort((a, b) => a.insertion - b.insertion)
    let out = new Array<Match<string, data>>(results.length)
    for (let i = 0; i < results.length; i++) out[i] = results[i].match
    return out.sort((a, b) => compare(a, b) * -1)
  }
}

// ============================================================================
// Pattern Classification & Insertion
// ============================================================================

function classifyHostname(part: PartPattern | null): HostClassification {
  if (part === null) return { kind: 'none' }

  let tokens = part.tokens
  if (tokens.length === 0) return { kind: 'static', host: '' }

  // Check for optionals first -> complex
  if (part.optionals.size > 0) return { kind: 'complex' }

  // Split tokens by '.' separator into left-to-right labels
  let labels: Array<
    | { readonly kind: 'static'; readonly text: string }
    | { readonly kind: 'param'; readonly name: string }
    | { readonly kind: 'wildcard'; readonly name: string }
  > = []

  let i = 0
  while (true) {
    let segStart = i
    while (i < tokens.length && tokens[i].type !== 'separator') i += 1
    let segLen = i - segStart

    if (segLen === 0) {
      labels.push({ kind: 'static', text: '' })
    } else if (segLen === 1) {
      let tok = tokens[segStart]
      if (tok.type === 'text') {
        let canon = canonicalizePatternSegmentText(tok.text, 'hostname', true)
        if (canon.hasNonStructuralSep) return { kind: 'complex' }
        labels.push({ kind: 'static', text: canon.text })
      } else if (tok.type === ':') {
        labels.push({ kind: 'param', name: tok.name })
      } else if (tok.type === '*') {
        // Leading wildcard is only allowed at label 0 (before first '.')
        if (labels.length !== 0) return { kind: 'complex' }
        labels.push({ kind: 'wildcard', name: tok.name })
      } else {
        return { kind: 'complex' }
      }
    } else {
      return { kind: 'complex' }
    }

    if (i >= tokens.length) break
    i += 1 // skip separator
  }

  let hasDynamic = false
  for (let l of labels) {
    if (l.kind !== 'static') {
      hasDynamic = true
      break
    }
  }

  if (!hasDynamic) {
    let host = ''
    for (let j = 0; j < labels.length; j++) {
      if (j > 0) host += '.'
      host += (labels[j] as { kind: 'static'; text: string }).text
    }
    return { kind: 'static', host }
  }

  let leadingWildcard: string | null = null
  let startIdx = 0
  if (labels[0].kind === 'wildcard') {
    leadingWildcard = labels[0].name
    startIdx = 1
  }

  // Reverse labels for right-to-left trie
  let reversed: Array<
    | { readonly kind: 'static'; readonly text: string }
    | { readonly kind: 'param'; readonly name: string }
  > = []
  for (let j = labels.length - 1; j >= startIdx; j--) {
    let l = labels[j]
    if (l.kind === 'wildcard') return { kind: 'complex' }
    reversed.push(l)
  }

  return { kind: 'trie', labels: reversed, leadingWildcard }
}

function classifyPathname(part: PartPattern, ignoreCase: boolean): PathClassification {
  let tokens = part.tokens
  if (tokens.length === 0) return { kind: 'static', key: '/' }

  // Fast check for pure static pathname
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
      let hasNonStructuralSep = false
      for (let i = 0; i < tokens.length; i++) {
        let tok = tokens[i]
        if (tok.type === 'separator') {
          key += '/'
        } else if (tok.type === 'text') {
          let canon = canonicalizePatternSegmentText(tok.text, 'pathname', ignoreCase)
          if (canon.hasNonStructuralSep) {
            hasNonStructuralSep = true
            break
          }
          key += canon.text
        }
      }
      if (!hasNonStructuralSep) {
        return { kind: 'static', key }
      }
      return { kind: 'complex', leadingPrefix: [], trailingSuffix: [] }
    }
  }

  // Try to parse as segment-trie path (supports static, :param, (:param) whole-segment optParam,
  // trailing nested optional segments (/seg(/seg...)), and trailing /*wildcard)
  let segments: Array<PathSegmentSpec> = []
  let terminalIndices: Array<number> = []
  let trailingWildcard: string | null = null
  let expectedCloseIdx = tokens.length - 1
  let optParamCount = 0
  let i = 0
  let canBeTrie = true

  while (true) {
    // Check for trailing wildcard at start of segment: *name followed by end (or closing ')'s)
    if (i < tokens.length && tokens[i].type === '*') {
      if (i === expectedCloseIdx) {
        trailingWildcard = (tokens[i] as { type: '*'; name: string }).name
        break
      }
      canBeTrie = false
      break
    }

    // Check for whole-segment (:param) optional: '(', ':', ')', followed by separator or end
    if (
      i + 2 < tokens.length &&
      tokens[i].type === '(' &&
      tokens[i + 1].type === ':' &&
      tokens[i + 2].type === ')' &&
      optParamCount < 2
    ) {
      let after = i + 3
      if (after > expectedCloseIdx) {
        segments.push({
          kind: 'optParam',
          name: (tokens[i + 1] as { type: ':'; name: string }).name,
        })
        optParamCount += 1
        terminalIndices.push(segments.length)
        break
      }
      if (tokens[after].type === 'separator') {
        segments.push({
          kind: 'optParam',
          name: (tokens[i + 1] as { type: ':'; name: string }).name,
        })
        optParamCount += 1
        i = after + 1
        continue
      }
      // Trailing nested optional starting right after (:param), e.g. (:a)(/:b)
      if (
        tokens[after].type === '(' &&
        part.optionals.get(after) === expectedCloseIdx &&
        after + 1 < tokens.length &&
        tokens[after + 1].type === 'separator'
      ) {
        segments.push({
          kind: 'optParam',
          name: (tokens[i + 1] as { type: ':'; name: string }).name,
        })
        optParamCount += 1
        terminalIndices.push(segments.length)
        expectedCloseIdx -= 1
        i = after + 2
        continue
      }
      canBeTrie = false
      break
    }

    // Scan segment up to separator, trailing nested '(', or expectedCloseIdx
    let segStart = i
    while (i <= expectedCloseIdx && tokens[i].type !== 'separator' && tokens[i].type !== '(') {
      i += 1
    }
    let segLen = i - segStart

    if (segLen === 0) {
      // Empty segment before '/' (e.g. //start) or end after trailing '/' (e.g. /:a/)
      segments.push({ kind: 'static', text: '' })
    } else if (segLen === 1) {
      let tok = tokens[segStart]
      if (tok.type === 'text') {
        let canon = canonicalizePatternSegmentText(tok.text, 'pathname', ignoreCase)
        if (canon.hasNonStructuralSep) {
          canBeTrie = false
          break
        }
        segments.push({ kind: 'static', text: canon.text })
      } else if (tok.type === ':') {
        segments.push({ kind: 'param', name: tok.name })
      } else {
        canBeTrie = false
        break
      }
    } else {
      canBeTrie = false
      break
    }

    if (i > expectedCloseIdx) {
      terminalIndices.push(segments.length)
      break
    }

    if (tokens[i].type === 'separator') {
      i += 1
      continue
    }

    // tokens[i].type === '(' -> check if it's a trailing nested optional starting with '/'
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

  // Complex pattern: extract safe deterministic leading prefix segments & trailing suffix segments
  let leadingPrefix = extractComplexLeadingPrefix(part, ignoreCase)
  let trailingSuffix =
    leadingPrefix.length === 0 ? extractComplexTrailingSuffix(part, ignoreCase) : []

  return { kind: 'complex', leadingPrefix, trailingSuffix }
}

// A leading segment is only anchored when every continuation begins with '/' or end-of-pattern.
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
    let seg: PathSegmentSpec | null = null
    if (segLen === 0) {
      if (i < tokens.length && tokens[i].type === 'separator') {
        seg = { kind: 'static', text: '' }
      } else {
        break
      }
    } else if (segLen === 1) {
      let tok = tokens[segStart]
      if (tok.type === 'text') {
        let canon = canonicalizePatternSegmentText(tok.text, 'pathname', ignoreCase)
        if (canon.hasNonStructuralSep) break
        seg = { kind: 'static', text: canon.text }
      } else if (tok.type === ':') {
        seg = { kind: 'param', name: tok.name }
      } else {
        break
      }
    } else {
      break
    }

    if (i >= tokens.length) {
      prefix.push(seg)
      break
    }
    if (tokens[i].type === 'separator') {
      prefix.push(seg)
      i += 1
      continue
    }
    // tokens[i].type === '(': only safe to include `seg` if every possible next consuming token is '/' or end
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

// Trailing segments (right-to-left) at optionalDepth === 0 preceded by a mandatory '/'.
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
    // Must be preceded by a '/' separator so this is guaranteed to be a complete trailing segment
    if (i < 0 || tokens[i].type !== 'separator') break

    let segStart = i + 1
    let segLen = segEnd - segStart
    if (segLen === 0) {
      suffix.push({ kind: 'static', text: '' })
    } else if (segLen === 1) {
      let tok = tokens[segStart]
      if (tok.type === 'text') {
        let canon = canonicalizePatternSegmentText(tok.text, 'pathname', ignoreCase)
        if (canon.hasNonStructuralSep) break
        suffix.push({ kind: 'static', text: canon.text })
      } else if (tok.type === ':') {
        suffix.push({ kind: 'param', name: tok.name })
      } else {
        break
      }
    } else {
      break
    }

    i -= 1 // step before '/'
  }

  return suffix
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
    if (pathTrie.staticMap === null) pathTrie.staticMap = new Map()
    let list = pathTrie.staticMap.get(pathClass.key)
    let leaf: PathLeaf<data> = {
      entry,
      paramNames: emptyStrings,
      wildcardName: null,
      coversAllCaptures: entry.allCaptureNames.length === 0,
    }
    if (list === undefined) {
      pathTrie.staticMap.set(pathClass.key, [leaf])
    } else {
      insertSortedLeaf(list, leaf)
    }
    return
  }

  pathTrie.hasDynamic = true
  if (pathTrie.root === null) pathTrie.root = createPathTrieNode<data>()

  if (pathClass.kind === 'trie') {
    let node = pathTrie.root
    let paramNames: Array<string> = []
    let staticPrefixSoFar = ''
    let allStaticSoFar = true
    let termPos = 0

    // Check if terminal at depth 0 (cannot happen for non-empty segments, handled above)
    for (let s = 0; s < pathClass.segments.length; s++) {
      let seg = pathClass.segments[s]
      if (seg.kind === 'static') {
        if (allStaticSoFar) staticPrefixSoFar += '/' + seg.text
        node = getOrCreatePathStaticChild(node, seg.text)
      } else if (seg.kind === 'param') {
        allStaticSoFar = false
        paramNames.push(seg.name)
        if (node.param === null) node.param = createPathTrieNode<data>()
        node = node.param
      } else {
        allStaticSoFar = false
        pathTrie.hasOptParam = true
        paramNames.push(seg.name)
        if (node.optParam === null) node.optParam = createPathTrieNode<data>()
        node = node.optParam
      }

      if (
        termPos < pathClass.terminalIndices.length &&
        pathClass.terminalIndices[termPos] === s + 1
      ) {
        termPos += 1
        if (allStaticSoFar) {
          // Base static terminal of a trailing-optional route (e.g. /api/resource/3 from /api/resource/3(/:version))
          // Place directly in staticMap so static lookups find it in O(1) with exact tiebreaking!
          if (pathTrie.staticMap === null) pathTrie.staticMap = new Map()
          let leaf: PathLeaf<data> = {
            entry,
            paramNames: emptyStrings,
            wildcardName: null,
            coversAllCaptures: entry.allCaptureNames.length === 0,
          }
          let list = pathTrie.staticMap.get(staticPrefixSoFar)
          if (list === undefined) {
            pathTrie.staticMap.set(staticPrefixSoFar, [leaf])
          } else {
            insertSortedLeaf(list, leaf)
          }
        } else {
          let pNames = paramNames.length > 0 ? paramNames.slice() : emptyStrings
          let leaf: PathLeaf<data> = {
            entry,
            paramNames: pNames,
            wildcardName: null,
            coversAllCaptures: leafCoversAllCaptures(entry, pNames, null),
          }
          if (node.entries === null) node.entries = [leaf]
          else insertSortedLeaf(node.entries, leaf)
        }
      }
    }

    if (pathClass.trailingWildcard !== null) {
      let pNames = paramNames.length > 0 ? paramNames.slice() : emptyStrings
      let leaf: PathLeaf<data> = {
        entry,
        paramNames: pNames,
        wildcardName: pathClass.trailingWildcard,
        coversAllCaptures: leafCoversAllCaptures(entry, pNames, pathClass.trailingWildcard),
      }
      if (node.trailingWildcards === null) node.trailingWildcards = [leaf]
      else insertSortedLeaf(node.trailingWildcards, leaf)
    }
    return
  }

  // Complex pattern
  pathTrie.hasComplex = true
  if (pathClass.leadingPrefix.length > 0) {
    let node = pathTrie.root
    for (let seg of pathClass.leadingPrefix) {
      if (seg.kind === 'static') {
        node = getOrCreatePathStaticChild(node, seg.text)
      } else {
        if (node.param === null) node.param = createPathTrieNode<data>()
        node = node.param
      }
    }
    if (node.complex === null) node.complex = [entry]
    else node.complex.push(entry)
  } else if (pathClass.trailingSuffix.length > 0) {
    if (pathTrie.suffixRoot === null) pathTrie.suffixRoot = createPathTrieNode<data>()
    let node = pathTrie.suffixRoot
    for (let seg of pathClass.trailingSuffix) {
      if (seg.kind === 'static') {
        node = getOrCreatePathStaticChild(node, seg.text)
      } else {
        if (node.param === null) node.param = createPathTrieNode<data>()
        node = node.param
      }
    }
    if (node.complex === null) node.complex = [entry]
    else node.complex.push(entry)
  } else {
    if (pathTrie.root.complex === null) pathTrie.root.complex = [entry]
    else pathTrie.root.complex.push(entry)
  }
}

// Keep leaves at the same trie node sorted by descending specificity and ascending insertion order.
function insertSortedLeaf<data>(list: Array<PathLeaf<data>>, leaf: PathLeaf<data>): void {
  let e = leaf.entry
  let idx = list.length
  while (idx > 0) {
    let prev = list[idx - 1].entry
    if (compareStaticEntryPriority(prev, e) <= 0) break
    idx -= 1
  }
  if (idx === list.length) {
    list.push(leaf)
  } else {
    list.splice(idx, 0, leaf)
  }
}

function compareStaticEntryPriority<data>(a: Entry<data>, b: Entry<data>): number {
  if (a.protocolRank !== b.protocolRank) return b.protocolRank - a.protocolRank
  if (a.portRank !== b.portRank) return b.portRank - a.portRank
  if (a.searchKeyValue !== b.searchKeyValue) return b.searchKeyValue - a.searchKeyValue
  if (a.searchKey !== b.searchKey) return b.searchKey - a.searchKey
  return a.insertion - b.insertion
}

// ============================================================================
// Best-Match Search (`match()`)
// ============================================================================

function findBestOriginlessStaticLeaf<data>(
  leaves: ReadonlyArray<PathLeaf<data>>,
  url: URL,
  budget: MatchWorkBudget,
): PathLeaf<data> | null {
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
    return leaf
  }
  return null
}

function findBestStaticLeaf<data>(
  leaves: ReadonlyArray<PathLeaf<data>>,
  url: URL,
  proto: 'http:' | 'https:',
  budget: MatchWorkBudget,
): PathLeaf<data> | null {
  for (let i = 0; i < leaves.length; i++) {
    let leaf = leaves[i]
    let entry = leaf.entry
    consumeMatchWork(budget, 1)
    if (!matchesProtocolAndPort(entry.patternParts, proto, url.port)) continue
    if (
      entry.patternParts.search.size > 0 &&
      !matchSearch(url, entry.patternParts.search, budget)
    ) {
      continue
    }
    return leaf
  }
  return null
}

// Direct fast path for origin-less dynamic tries without complex or mixed-origin entries.
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

    // Check if static matches (inline single-child check avoids substring slice & Map lookup!)
    let staticChild = lookupPathStaticRaw(node, rawPath, pos, segEnd, segLen)

    let hasAnyFallback =
      node.param !== null || node.optParam !== null || node.trailingWildcards !== null

    // Fast straight-line iteration when ONLY staticChild matches and no fallback exists
    if (staticChild !== undefined && !hasAnyFallback) {
      if (isLastSeg) {
        return matchFirstFastLeaf(staticChild.entries, capDepth, -1, rawPath, url, budget)
      }
      node = staticChild
      pos = slash + 1
      continue
    }

    // Try static branch first (highest specificity)
    if (staticChild !== undefined) {
      let match = isLastSeg
        ? matchFirstFastLeaf(staticChild.entries, capDepth, -1, rawPath, url, budget)
        : matchRawOriginlessFast(staticChild, rawPath, slash + 1, capDepth, url, budget)
      if (match !== null) return match
    }

    // Empty segment with optParam (omitted = static specificity)
    if (segLen === 0 && node.optParam !== null) {
      setCapFrame(capDepth, 2, pos, pos, -1)
      if (isLastSeg) {
        let match = matchFirstFastLeaf(
          node.optParam.entries,
          capDepth + 1,
          -1,
          rawPath,
          url,
          budget,
        )
        if (match !== null) return match
      } else if (node.trailingWildcards === null) {
        node = node.optParam
        pos = slash + 1
        capDepth += 1
        continue
      } else {
        let match = matchRawOriginlessFast(
          node.optParam,
          rawPath,
          slash + 1,
          capDepth + 1,
          url,
          budget,
        )
        if (match !== null) return match
      }
    } else if (
      segLen > 0 &&
      (node.param !== null || node.optParam !== null) &&
      !hasDotInRange(rawPath, pos, segEnd)
    ) {
      setCapFrame(capDepth, 0, pos, segEnd, -1)

      // Fast straight-line iteration when ONLY param (or ONLY optParam) exists and no trailing wildcard
      if (node.param !== null && node.optParam === null && node.trailingWildcards === null) {
        if (isLastSeg) {
          return matchFirstFastLeaf(node.param.entries, capDepth + 1, -1, rawPath, url, budget)
        }
        node = node.param
        pos = slash + 1
        capDepth += 1
        continue
      }
      if (node.optParam !== null && node.param === null && node.trailingWildcards === null) {
        if (isLastSeg) {
          return matchFirstFastLeaf(node.optParam.entries, capDepth + 1, -1, rawPath, url, budget)
        }
        node = node.optParam
        pos = slash + 1
        capDepth += 1
        continue
      }

      if (node.param !== null && node.optParam !== null) {
        // Both branches consume ':' at this segment; check both and compare specificity + insertion order.
        let paramMatch = isLastSeg
          ? matchFirstFastLeaf(node.param.entries, capDepth + 1, -1, rawPath, url, budget)
          : matchRawOriginlessFast(node.param, rawPath, slash + 1, capDepth + 1, url, budget)
        let paramInsertion = lastFastInsertion
        let optMatch = isLastSeg
          ? matchFirstFastLeaf(node.optParam.entries, capDepth + 1, -1, rawPath, url, budget)
          : matchRawOriginlessFast(node.optParam, rawPath, slash + 1, capDepth + 1, url, budget)
        let optInsertion = lastFastInsertion
        if (paramMatch !== null && optMatch !== null) {
          let cmp = compare(optMatch, paramMatch)
          if (cmp > 0 || (cmp === 0 && optInsertion < paramInsertion)) {
            lastFastInsertion = optInsertion
            return optMatch
          }
          lastFastInsertion = paramInsertion
          return paramMatch
        }
        if (paramMatch !== null) {
          lastFastInsertion = paramInsertion
          return paramMatch
        }
        if (optMatch !== null) {
          lastFastInsertion = optInsertion
          return optMatch
        }
      } else if (node.param !== null) {
        let match = isLastSeg
          ? matchFirstFastLeaf(node.param.entries, capDepth + 1, -1, rawPath, url, budget)
          : matchRawOriginlessFast(node.param, rawPath, slash + 1, capDepth + 1, url, budget)
        if (match !== null) return match
      } else if (node.optParam !== null) {
        let match = isLastSeg
          ? matchFirstFastLeaf(node.optParam.entries, capDepth + 1, -1, rawPath, url, budget)
          : matchRawOriginlessFast(node.optParam, rawPath, slash + 1, capDepth + 1, url, budget)
        if (match !== null) return match
      }
    }

    // Lowest specificity: trailing wildcards
    if (node.trailingWildcards !== null) {
      return matchFirstFastLeaf(node.trailingWildcards, capDepth, pos, rawPath, url, budget)
    }

    return null
  }
}

function matchFirstFastLeaf<data>(
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
    return materializeFastOriginlessMatch(url, leaf, capDepth, wildcardStart, rawPath)
  }
  return null
}

function materializeFastOriginlessMatch<data>(
  url: URL,
  leaf: PathLeaf<data>,
  capDepth: number,
  wildcardStart: number,
  rawPath: string,
): Match<string, data> {
  let entry = leaf.entry
  lastFastInsertion = entry.insertion
  let paramNames = leaf.paramNames
  let wildcardName = leaf.wildcardName
  let params: Record<string, string | undefined> = {}

  let hasOmitted = false
  for (let i = 0; i < capDepth; i++) {
    if (capTypeStack[i] === 2) {
      hasOmitted = true
      break
    }
  }
  if (!leaf.coversAllCaptures || hasOmitted) {
    let names = entry.allCaptureNames
    for (let i = 0; i < names.length; i++) params[names[i]] = undefined
  }

  let pathnameMeta: Array<MatchParamMeta> = []
  let rawPosCursor = 1
  let rawEncCursor = 0

  for (let i = 0; i < capDepth; i++) {
    if (capTypeStack[i] === 2) continue
    let sBegin = capBeginStack[i]
    let sEnd = capEndStack[i]
    rawEncCursor += fastRawEncodedLength(rawPath, rawPosCursor, sBegin)
    let begin = rawEncCursor
    rawEncCursor += fastRawEncodedLength(rawPath, sBegin, sEnd)
    let end = rawEncCursor
    rawPosCursor = sEnd
    let value = rawPath.slice(sBegin, sEnd)
    let name = paramNames[i]
    params[name] = value
    pathnameMeta.push({ type: ':', name, value, begin, end })
  }

  if (wildcardName !== null) {
    rawEncCursor += fastRawEncodedLength(rawPath, rawPosCursor, wildcardStart)
    let begin = rawEncCursor
    let end = begin + fastRawEncodedLength(rawPath, wildcardStart, rawPath.length)
    let value = rawPath.slice(wildcardStart)
    if (wildcardName !== '*') params[wildcardName] = value
    pathnameMeta.push({ type: '*', name: wildcardName, value, begin, end })
  }

  let decodedHostname = decodeHostname(url.hostname)
  return {
    url,
    pattern: entry.pattern,
    data: entry.data,
    params,
    paramsMeta: {
      hostname: [
        { type: '*', name: '*', value: decodedHostname, begin: 0, end: decodedHostname.length },
      ],
      pathname: pathnameMeta,
    },
  }
}

function leafCoversAllCaptures<data>(
  entry: Entry<data>,
  paramNames: ReadonlyArray<string>,
  wildcardName: string | null,
): boolean {
  let all = entry.allCaptureNames
  if (all.length === 0) return true
  for (let i = 0; i < all.length; i++) {
    let name = all[i]
    if (wildcardName === name) continue
    if (!paramNames.includes(name)) return false
  }
  return true
}

function searchPathTrieBest<data>(
  pathTrie: PathTrie<data>,
  url: URL,
  proto: 'http:' | 'https:',
  rawPath: string,
  decodedPath: DecodedPathname | null,
  hostnameMeta: ReadonlyArray<MatchParamMeta>,
  lowerHostname: string | null,
  best: CandidateMatch<data> | null,
  hostEntryFilter: ((entry: Entry<data>) => ReadonlyArray<MatchParamMeta>) | null,
  budget: MatchWorkBudget,
  ignoreCase: boolean,
): CandidateMatch<data> | null {
  let canUseStaticMap = decodedPath === null || !decodedPath.anyNonStructuralSep

  // 1. Check exact staticMap first
  if (canUseStaticMap && pathTrie.staticMap !== null) {
    let leaves = pathTrie.staticMap.get(rawPath)
    if (leaves !== undefined) {
      for (let i = 0; i < leaves.length; i++) {
        let leaf = leaves[i]
        let entry = leaf.entry
        consumeMatchWork(budget, 1)
        if (!matchesProtocolAndPort(entry.patternParts, proto, url.port)) continue
        if (
          entry.patternParts.search.size > 0 &&
          !matchSearch(url, entry.patternParts.search, budget)
        ) {
          continue
        }
        let hMeta = hostEntryFilter !== null ? hostEntryFilter(entry) : hostnameMeta
        best = pickBetterCandidate(
          best,
          {
            entry,
            hostnameMeta: hMeta,
            pathnameMeta: emptyMeta,
            deferredLeaf: leaf,
            deferredCaps: null,
            deferredWildcardStart: -1,
            deferredWildcardDecodedSeg: -1,
          },
          lowerHostname,
          rawPath,
          decodedPath,
        )
        // Leaves in staticMap are sorted by (protocol, port, search, insertion), so first match wins this bucket
        break
      }

      if (
        best !== null &&
        best.pathnameMeta.length === 0 &&
        best.deferredCaps === null &&
        best.deferredWildcardStart === -1 &&
        best.deferredWildcardDecodedSeg === -1 &&
        !pathTrie.hasComplex &&
        !pathTrie.hasMixedOriginRank &&
        !(pathTrie.hasOptParam && hasEmptyPathSegment(rawPath))
      ) {
        return best
      }
    }
  }

  if (!pathTrie.hasDynamic) return best

  let allowEarlyExit =
    !pathTrie.hasComplex && !pathTrie.hasMixedOriginRank && hostEntryFilter === null
  let canonicalPath: CanonicalText | null | undefined = undefined
  let plainPath: string | null = null
  let getCanonicalPath = (): CanonicalText | null => {
    if (canonicalPath === undefined) {
      canonicalPath = canonicalizeUrlPart(url.pathname.slice(1), 'pathname', {
        budget,
        ignoreCase,
      })
    }
    return canonicalPath
  }

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
      consumeMatchWork(budget, 1)
      if (!matchesProtocolAndPort(entry.patternParts, proto, url.port)) continue
      if (
        entry.patternParts.search.size > 0 &&
        !matchSearch(url, entry.patternParts.search, budget)
      ) {
        continue
      }

      let hMeta = hostEntryFilter !== null ? hostEntryFilter(entry) : hostnameMeta
      best = pickBetterCandidate(
        best,
        {
          entry,
          hostnameMeta: hMeta,
          pathnameMeta: emptyMeta,
          deferredLeaf: leaf,
          deferredCaps: snapshotPendingCaps(capDepth),
          deferredWildcardStart: wildcardStart,
          deferredWildcardDecodedSeg: wildcardDecodedSeg,
        },
        lowerHostname,
        rawPath,
        decodedPath,
      )
      if (hostEntryFilter === null) break
    }
  }

  let evalComplex = (entries: ReadonlyArray<Entry<data>> | null) => {
    if (entries === null) return
    for (let i = 0; i < entries.length; i++) {
      let entry = entries[i]
      consumeMatchWork(budget, 1)
      if (!matchesProtocolAndPort(entry.patternParts, proto, url.port)) continue
      if (
        entry.patternParts.search.size > 0 &&
        !matchSearch(url, entry.patternParts.search, budget)
      ) {
        continue
      }

      let program = entry.pathnameProgram!
      let pathnameMeta: ReadonlyArray<MatchParamMeta> | null
      if (
        !program.hasNonStructuralSep &&
        (decodedPath === null || !decodedPath.anyNonStructuralSep)
      ) {
        if (plainPath === null) {
          plainPath = decodedPath === null ? rawPath.slice(1) : decodedPath.fullDecoded
        }
        pathnameMeta = matchPartString(program, plainPath, budget)
      } else {
        let canonical = getCanonicalPath()
        if (canonical === null) continue
        let unitProg = ensureUnitProgram(entry.patternParts.pathname, program, ignoreCase)
        pathnameMeta = matchPartUnits(
          unitProg.tokens,
          unitProg.optionals,
          'pathname',
          canonical,
          budget,
        )
      }
      if (pathnameMeta === null) continue

      let hMeta = hostEntryFilter !== null ? hostEntryFilter(entry) : hostnameMeta
      best = pickBetterCandidate(
        best,
        {
          entry,
          hostnameMeta: hMeta,
          pathnameMeta,
          deferredLeaf: null,
          deferredCaps: null,
          deferredWildcardStart: -1,
          deferredWildcardDecodedSeg: -1,
        },
        lowerHostname,
        rawPath,
        decodedPath,
      )
    }
  }

  // 2. Walk forward segment trie
  if (pathTrie.root !== null) {
    if (decodedPath === null) {
      let len = rawPath.length
      let walkRaw = (node: PathTrieNode<data>, pos: number, capDepth: number) => {
        consumeMatchWork(budget, 1)
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
      let segs = decodedPath.segments
      let walkDecoded = (node: PathTrieNode<data>, segIdx: number, capDepth: number) => {
        consumeMatchWork(budget, 1)
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
  }

  // 3. Walk reversed-segment suffix trie (ONLY for leading-wildcard complex entries)
  if (pathTrie.suffixRoot !== null) {
    if (decodedPath === null) {
      let walkSuffixRaw = (node: PathTrieNode<data>, endPos: number) => {
        consumeMatchWork(budget, 1)
        evalComplex(node.complex)
        if (endPos < 1) return
        let slash = rawPath.lastIndexOf('/', endPos - 1)
        if (slash < 0) return
        let segStart = slash + 1
        let child = lookupPathStaticRaw(node, rawPath, segStart, endPos, endPos - segStart)
        if (child !== undefined) walkSuffixRaw(child, slash)
        if (node.param !== null && endPos > segStart && !hasDotInRange(rawPath, segStart, endPos)) {
          walkSuffixRaw(node.param, slash)
        }
      }
      walkSuffixRaw(pathTrie.suffixRoot, rawPath.length)
    } else {
      let segs = decodedPath.segments
      let walkSuffixDecoded = (node: PathTrieNode<data>, segIdx: number) => {
        consumeMatchWork(budget, 1)
        evalComplex(node.complex)
        if (segIdx < 0) return
        let seg = segs[segIdx]
        if (!seg.hasNonStructuralSep) {
          let child = lookupPathStaticKey(node, seg.decoded)
          if (child !== undefined) walkSuffixDecoded(child, segIdx - 1)
        }
        if (node.param !== null && seg.decoded.length > 0 && !seg.hasStructuralDot) {
          walkSuffixDecoded(node.param, segIdx - 1)
        }
      }
      walkSuffixDecoded(pathTrie.suffixRoot, segs.length - 1)
    }
  }

  return best
}

// ============================================================================
// Dynamic & Complex Hostname Search (`match()`)
// ============================================================================

function searchDynamicHostTrieBest<data>(
  root: HostTrieNode<data>,
  lowerHostname: string,
  url: URL,
  proto: 'http:' | 'https:',
  rawPath: string,
  decodedPath: DecodedPathname | null,
  best: CandidateMatch<data> | null,
  budget: MatchWorkBudget,
  ignoreCase: boolean,
): CandidateMatch<data> | null {
  let hostCapBegins: Array<number> = []
  let hostCapEnds: Array<number> = []

  let walk = (node: HostTrieNode<data>, segEnd: number) => {
    consumeMatchWork(budget, 1)

    // Check leading wildcard pathTrie (e.g. `*host.example.com`)
    if (node.leadingWildcards !== null) {
      let wcEnd = segEnd
      let depth = hostCapBegins.length
      let filter = (entry: Entry<data>): ReadonlyArray<MatchParamMeta> =>
        buildHostMetaFromCaptures(
          lowerHostname,
          entry.hostnameParamNames,
          hostCapBegins,
          hostCapEnds,
          depth,
          entry.hostnameWildcardName,
          wcEnd,
        )
      best = searchPathTrieBest(
        node.leadingWildcards,
        url,
        proto,
        rawPath,
        decodedPath,
        emptyMeta,
        lowerHostname,
        best,
        filter,
        budget,
        ignoreCase,
      )
    }

    let dot = segEnd === 0 ? -1 : lowerHostname.lastIndexOf('.', segEnd - 1)
    let segBegin = dot + 1
    let isLeftmost = dot === -1

    // 1. Static label (highest hostname specificity at this label)
    if (node.static !== null) {
      let label = lowerHostname.slice(segBegin, segEnd)
      let child = node.static.get(label)
      if (child !== undefined) {
        if (isLeftmost) {
          if (child.pathTrie !== null) {
            let depth = hostCapBegins.length
            let filter = (entry: Entry<data>): ReadonlyArray<MatchParamMeta> =>
              buildHostMetaFromCaptures(
                lowerHostname,
                entry.hostnameParamNames,
                hostCapBegins,
                hostCapEnds,
                depth,
                null,
                -1,
              )
            best = searchPathTrieBest(
              child.pathTrie,
              url,
              proto,
              rawPath,
              decodedPath,
              emptyMeta,
              lowerHostname,
              best,
              filter,
              budget,
              ignoreCase,
            )
          }
        } else {
          walk(child, dot)
        }
      }
    }

    // 2. Param label (`:` requires non-empty label)
    if (node.param !== null && segEnd > segBegin) {
      hostCapBegins.push(segBegin)
      hostCapEnds.push(segEnd)
      if (isLeftmost) {
        if (node.param.pathTrie !== null) {
          let depth = hostCapBegins.length
          let filter = (entry: Entry<data>): ReadonlyArray<MatchParamMeta> =>
            buildHostMetaFromCaptures(
              lowerHostname,
              entry.hostnameParamNames,
              hostCapBegins,
              hostCapEnds,
              depth,
              null,
              -1,
            )
          best = searchPathTrieBest(
            node.param.pathTrie,
            url,
            proto,
            rawPath,
            decodedPath,
            emptyMeta,
            lowerHostname,
            best,
            filter,
            budget,
            ignoreCase,
          )
        }
      } else {
        walk(node.param, dot)
      }
      hostCapBegins.pop()
      hostCapEnds.pop()
    }
  }

  walk(root, lowerHostname.length)
  return best
}

function searchComplexHostEntriesBest<data>(
  entries: ReadonlyArray<Entry<data>>,
  lowerHostname: string,
  url: URL,
  proto: 'http:' | 'https:',
  rawPath: string,
  decodedPath: DecodedPathname | null,
  best: CandidateMatch<data> | null,
  budget: MatchWorkBudget,
  ignoreCase: boolean,
): CandidateMatch<data> | null {
  let canonicalHost: CanonicalText | null | undefined = undefined
  let canonicalPath: CanonicalText | null | undefined = undefined
  let plainPath: string | null = null

  for (let i = 0; i < entries.length; i++) {
    let entry = entries[i]
    consumeMatchWork(budget, 1)
    if (!matchesProtocolAndPort(entry.patternParts, proto, url.port)) continue
    if (
      entry.patternParts.search.size > 0 &&
      !matchSearch(url, entry.patternParts.search, budget)
    ) {
      continue
    }

    let hProg = entry.hostnameProgram!
    let hMeta: ReadonlyArray<MatchParamMeta> | null
    if (!hProg.hasNonStructuralSep) {
      hMeta = matchPartString(hProg, lowerHostname, budget)
    } else {
      if (canonicalHost === undefined) {
        canonicalHost = canonicalizeUrlPart(lowerHostname, 'hostname', { budget, ignoreCase: true })
      }
      if (canonicalHost === null) continue
      let unitProg = ensureUnitProgram(entry.patternParts.hostname!, hProg, true)
      hMeta = matchPartUnits(unitProg.tokens, unitProg.optionals, 'hostname', canonicalHost, budget)
    }
    if (hMeta === null) continue

    let pProg = entry.pathnameProgram!
    let pMeta: ReadonlyArray<MatchParamMeta> | null
    if (!pProg.hasNonStructuralSep && (decodedPath === null || !decodedPath.anyNonStructuralSep)) {
      if (plainPath === null)
        plainPath = decodedPath === null ? rawPath.slice(1) : decodedPath.fullDecoded
      pMeta = matchPartString(pProg, plainPath, budget)
    } else {
      if (canonicalPath === undefined) {
        canonicalPath = canonicalizeUrlPart(url.pathname.slice(1), 'pathname', {
          budget,
          ignoreCase,
        })
      }
      if (canonicalPath === null) continue
      let unitProg = ensureUnitProgram(entry.patternParts.pathname, pProg, ignoreCase)
      pMeta = matchPartUnits(unitProg.tokens, unitProg.optionals, 'pathname', canonicalPath, budget)
    }
    if (pMeta === null) continue

    best = pickBetterCandidate(
      best,
      {
        entry,
        hostnameMeta: hMeta,
        pathnameMeta: pMeta,
        deferredLeaf: null,
        deferredCaps: null,
        deferredWildcardStart: -1,
        deferredWildcardDecodedSeg: -1,
      },
      lowerHostname,
      rawPath,
      decodedPath,
    )
  }
  return best
}

// ============================================================================
// Match-All Search (`matchAll()`)
// ============================================================================

function searchPathTrieAll<data>(
  pathTrie: PathTrie<data>,
  url: URL,
  proto: 'http:' | 'https:',
  rawPath: string,
  decodedPath: DecodedPathname | null,
  hostnameMeta: ReadonlyArray<MatchParamMeta>,
  results: Array<{ match: Match<string, data>; insertion: number }>,
  budget: MatchWorkBudget,
  ignoreCase: boolean,
  onLeafBatch: (sorted: boolean) => void,
  hostEntryFilter?: (entry: Entry<data>) => ReadonlyArray<MatchParamMeta>,
): void {
  let canUseStaticMap = decodedPath === null || !decodedPath.anyNonStructuralSep

  if (canUseStaticMap && pathTrie.staticMap !== null) {
    let leaves = pathTrie.staticMap.get(rawPath)
    if (leaves !== undefined) {
      let emitted = 0
      for (let i = 0; i < leaves.length; i++) {
        let leaf = leaves[i]
        let entry = leaf.entry
        consumeMatchWork(budget, 1)
        if (!matchesProtocolAndPort(entry.patternParts, proto, url.port)) continue
        if (
          entry.patternParts.search.size > 0 &&
          !matchSearch(url, entry.patternParts.search, budget)
        ) {
          continue
        }
        let hMeta = hostEntryFilter !== undefined ? hostEntryFilter(entry) : hostnameMeta
        results.push({
          match: buildMatch(url, entry, hMeta, emptyMeta),
          insertion: entry.insertion,
        })
        emitted += 1
      }
      if (emitted > 0) onLeafBatch(hostEntryFilter === undefined)
    }
  }

  if (!pathTrie.hasDynamic) return

  let canonicalPath: CanonicalText | null | undefined = undefined
  let getCanonicalPath = (): CanonicalText | null => {
    if (canonicalPath === undefined) {
      canonicalPath = canonicalizeUrlPart(url.pathname.slice(1), 'pathname', {
        budget,
        ignoreCase,
      })
    }
    return canonicalPath
  }

  let emitLeaves = (
    leaves: ReadonlyArray<PathLeaf<data>> | null,
    capDepth: number,
    wildcardStart: number,
    wildcardDecodedSeg: number,
  ) => {
    if (leaves === null) return
    // Precompute shared capture slices & canonical offsets ONCE across all leaves at this node!
    let sharedValues: Array<string> | null = null
    let sharedBegins: Array<number> | null = null
    let sharedEnds: Array<number> | null = null
    let sharedOmitted: Array<boolean> | null = null
    let sharedWildcardValue = ''
    let sharedWildcardBegin = 0
    let sharedWildcardEnd = 0
    let hasWildcard = wildcardStart !== -1 || wildcardDecodedSeg !== -1

    let isRaw = decodedPath === null
    if (capDepth > 0 || hasWildcard) {
      let rawPosCursor = 1
      let rawEncCursor = 0
      if (capDepth > 0) {
        sharedValues = new Array<string>(capDepth)
        sharedBegins = new Array<number>(capDepth)
        sharedEnds = new Array<number>(capDepth)
        sharedOmitted = new Array<boolean>(capDepth)
        for (let k = 0; k < capDepth; k++) {
          if (capTypeStack[k] === 2) {
            sharedOmitted[k] = true
            sharedValues[k] = ''
            sharedBegins[k] = 0
            sharedEnds[k] = 0
            continue
          }
          sharedOmitted[k] = false
          if (isRaw) {
            let sBegin = capBeginStack[k]
            let sEnd = capEndStack[k]
            rawEncCursor += fastRawEncodedLength(rawPath, rawPosCursor, sBegin)
            sharedBegins[k] = rawEncCursor
            rawEncCursor += fastRawEncodedLength(rawPath, sBegin, sEnd)
            sharedEnds[k] = rawEncCursor
            rawPosCursor = sEnd
            sharedValues[k] = rawPath.slice(sBegin, sEnd)
          } else {
            let seg = decodedPath!.segments[capSegIdxStack[k]]
            sharedValues[k] = seg.decoded
            sharedBegins[k] = seg.encBegin
            sharedEnds[k] = seg.encEnd
          }
        }
      }
      if (hasWildcard) {
        if (isRaw) {
          rawEncCursor += fastRawEncodedLength(rawPath, rawPosCursor, wildcardStart)
          sharedWildcardBegin = rawEncCursor
          sharedWildcardEnd =
            sharedWildcardBegin + fastRawEncodedLength(rawPath, wildcardStart, rawPath.length)
          sharedWildcardValue = rawPath.slice(wildcardStart)
        } else {
          let segs = decodedPath!.segments
          sharedWildcardBegin = segs[wildcardDecodedSeg].encBegin
          sharedWildcardEnd = decodedPath!.totalEncLen
          let val = ''
          for (let j = wildcardDecodedSeg; j < segs.length; j++) {
            if (j > wildcardDecodedSeg) val += '/'
            val += segs[j].decoded
          }
          sharedWildcardValue = val
        }
      }
    }

    let emitted = 0
    for (let i = 0; i < leaves.length; i++) {
      let leaf = leaves[i]
      let entry = leaf.entry
      consumeMatchWork(budget, 1)
      if (!matchesProtocolAndPort(entry.patternParts, proto, url.port)) continue
      if (
        entry.patternParts.search.size > 0 &&
        !matchSearch(url, entry.patternParts.search, budget)
      ) {
        continue
      }
      let hMeta = hostEntryFilter !== undefined ? hostEntryFilter(entry) : hostnameMeta
      let pMeta: ReadonlyArray<MatchParamMeta>
      if (capDepth === 0 && !hasWildcard) {
        pMeta = emptyMeta
      } else {
        let meta: Array<MatchParamMeta> = []
        if (sharedValues !== null) {
          let pNames = leaf.paramNames
          for (let k = 0; k < capDepth; k++) {
            if (sharedOmitted![k]) continue
            meta.push({
              type: ':',
              name: pNames[k],
              value: sharedValues[k],
              begin: sharedBegins![k],
              end: sharedEnds![k],
            })
          }
        }
        if (hasWildcard && leaf.wildcardName !== null) {
          meta.push({
            type: '*',
            name: leaf.wildcardName,
            value: sharedWildcardValue,
            begin: sharedWildcardBegin,
            end: sharedWildcardEnd,
          })
        }
        pMeta = meta
      }
      results.push({ match: buildMatch(url, entry, hMeta, pMeta), insertion: entry.insertion })
      emitted += 1
    }
    if (emitted > 0) onLeafBatch(hostEntryFilter === undefined)
  }

  let evalComplex = (entries: ReadonlyArray<Entry<data>> | null) => {
    if (entries === null) return
    let plainPath: string | null = null
    for (let i = 0; i < entries.length; i++) {
      let entry = entries[i]
      consumeMatchWork(budget, 1)
      if (!matchesProtocolAndPort(entry.patternParts, proto, url.port)) continue
      if (
        entry.patternParts.search.size > 0 &&
        !matchSearch(url, entry.patternParts.search, budget)
      ) {
        continue
      }
      let program = entry.pathnameProgram!
      let pMeta: ReadonlyArray<MatchParamMeta> | null
      if (
        !program.hasNonStructuralSep &&
        (decodedPath === null || !decodedPath.anyNonStructuralSep)
      ) {
        if (plainPath === null)
          plainPath = decodedPath === null ? rawPath.slice(1) : decodedPath.fullDecoded
        pMeta = matchPartString(program, plainPath, budget)
      } else {
        let canonical = getCanonicalPath()
        if (canonical === null) continue
        let unitProg = ensureUnitProgram(entry.patternParts.pathname, program, ignoreCase)
        pMeta = matchPartUnits(unitProg.tokens, unitProg.optionals, 'pathname', canonical, budget)
      }
      if (pMeta === null) continue
      let hMeta = hostEntryFilter !== undefined ? hostEntryFilter(entry) : hostnameMeta
      results.push({ match: buildMatch(url, entry, hMeta, pMeta), insertion: entry.insertion })
      onLeafBatch(false)
    }
  }

  if (pathTrie.root !== null) {
    if (decodedPath === null) {
      let walk = (node: PathTrieNode<data>, pos: number, capDepth: number) => {
        consumeMatchWork(budget, 1)
        evalComplex(node.complex)
        if (node.trailingWildcards !== null) emitLeaves(node.trailingWildcards, capDepth, pos, -1)

        let len = rawPath.length
        let slash = rawPath.indexOf('/', pos)
        let segEnd = slash === -1 ? len : slash
        let isLastSeg = slash === -1
        let nextPos = isLastSeg ? len + 1 : slash + 1

        let child = lookupPathStaticRaw(node, rawPath, pos, segEnd, segEnd - pos)
        if (child !== undefined) {
          if (isLastSeg) {
            emitLeaves(child.entries, capDepth, -1, -1)
            evalComplex(child.complex)
          } else {
            walk(child, nextPos, capDepth)
          }
        }

        let segLen = segEnd - pos
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
      let segs = decodedPath.segments
      let walk = (node: PathTrieNode<data>, segIdx: number, capDepth: number) => {
        consumeMatchWork(budget, 1)
        evalComplex(node.complex)
        if (node.trailingWildcards !== null)
          emitLeaves(node.trailingWildcards, capDepth, -1, segIdx)

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
  }

  if (pathTrie.suffixRoot !== null) {
    if (decodedPath === null) {
      let walk = (node: PathTrieNode<data>, endPos: number) => {
        consumeMatchWork(budget, 1)
        evalComplex(node.complex)
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
      walk(pathTrie.suffixRoot, rawPath.length)
    } else {
      let segs = decodedPath.segments
      let walk = (node: PathTrieNode<data>, segIdx: number) => {
        consumeMatchWork(budget, 1)
        evalComplex(node.complex)
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
      walk(pathTrie.suffixRoot, segs.length - 1)
    }
  }
}

function searchDynamicHostTrieAll<data>(
  root: HostTrieNode<data>,
  lowerHostname: string,
  url: URL,
  proto: 'http:' | 'https:',
  rawPath: string,
  decodedPath: DecodedPathname | null,
  results: Array<{ match: Match<string, data>; insertion: number }>,
  budget: MatchWorkBudget,
  ignoreCase: boolean,
  onLeafBatch: (sorted: boolean) => void,
): void {
  let hostCapBegins: Array<number> = []
  let hostCapEnds: Array<number> = []

  let walk = (node: HostTrieNode<data>, segEnd: number) => {
    consumeMatchWork(budget, 1)

    if (node.leadingWildcards !== null) {
      let wcEnd = segEnd
      let depth = hostCapBegins.length
      searchPathTrieAll(
        node.leadingWildcards,
        url,
        proto,
        rawPath,
        decodedPath,
        emptyMeta,
        results,
        budget,
        ignoreCase,
        onLeafBatch,
        (entry) =>
          buildHostMetaFromCaptures(
            lowerHostname,
            entry.hostnameParamNames,
            hostCapBegins,
            hostCapEnds,
            depth,
            entry.hostnameWildcardName,
            wcEnd,
          ),
      )
    }

    let dot = segEnd === 0 ? -1 : lowerHostname.lastIndexOf('.', segEnd - 1)
    let segBegin = dot + 1
    let isLeftmost = dot === -1

    if (node.static !== null) {
      let child = node.static.get(lowerHostname.slice(segBegin, segEnd))
      if (child !== undefined) {
        if (isLeftmost) {
          if (child.pathTrie !== null) {
            let depth = hostCapBegins.length
            searchPathTrieAll(
              child.pathTrie,
              url,
              proto,
              rawPath,
              decodedPath,
              emptyMeta,
              results,
              budget,
              ignoreCase,
              onLeafBatch,
              (entry) =>
                buildHostMetaFromCaptures(
                  lowerHostname,
                  entry.hostnameParamNames,
                  hostCapBegins,
                  hostCapEnds,
                  depth,
                  null,
                  -1,
                ),
            )
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
          let depth = hostCapBegins.length
          searchPathTrieAll(
            node.param.pathTrie,
            url,
            proto,
            rawPath,
            decodedPath,
            emptyMeta,
            results,
            budget,
            ignoreCase,
            onLeafBatch,
            (entry) =>
              buildHostMetaFromCaptures(
                lowerHostname,
                entry.hostnameParamNames,
                hostCapBegins,
                hostCapEnds,
                depth,
                null,
                -1,
              ),
          )
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

function searchComplexHostEntriesAll<data>(
  entries: ReadonlyArray<Entry<data>>,
  lowerHostname: string,
  url: URL,
  proto: 'http:' | 'https:',
  rawPath: string,
  decodedPath: DecodedPathname | null,
  results: Array<{ match: Match<string, data>; insertion: number }>,
  budget: MatchWorkBudget,
  ignoreCase: boolean,
  onLeafBatch: (sorted: boolean) => void,
): void {
  let canonicalHost: CanonicalText | null | undefined = undefined
  let canonicalPath: CanonicalText | null | undefined = undefined
  let plainPath: string | null = null

  for (let i = 0; i < entries.length; i++) {
    let entry = entries[i]
    consumeMatchWork(budget, 1)
    if (!matchesProtocolAndPort(entry.patternParts, proto, url.port)) continue
    if (
      entry.patternParts.search.size > 0 &&
      !matchSearch(url, entry.patternParts.search, budget)
    ) {
      continue
    }

    let hProg = entry.hostnameProgram!
    let hMeta: ReadonlyArray<MatchParamMeta> | null
    if (!hProg.hasNonStructuralSep) {
      hMeta = matchPartString(hProg, lowerHostname, budget)
    } else {
      if (canonicalHost === undefined) {
        canonicalHost = canonicalizeUrlPart(lowerHostname, 'hostname', { budget, ignoreCase: true })
      }
      if (canonicalHost === null) continue
      let unitProg = ensureUnitProgram(entry.patternParts.hostname!, hProg, true)
      hMeta = matchPartUnits(unitProg.tokens, unitProg.optionals, 'hostname', canonicalHost, budget)
    }
    if (hMeta === null) continue

    let pProg = entry.pathnameProgram!
    let pMeta: ReadonlyArray<MatchParamMeta> | null
    if (!pProg.hasNonStructuralSep && (decodedPath === null || !decodedPath.anyNonStructuralSep)) {
      if (plainPath === null)
        plainPath = decodedPath === null ? rawPath.slice(1) : decodedPath.fullDecoded
      pMeta = matchPartString(pProg, plainPath, budget)
    } else {
      if (canonicalPath === undefined) {
        canonicalPath = canonicalizeUrlPart(url.pathname.slice(1), 'pathname', {
          budget,
          ignoreCase,
        })
      }
      if (canonicalPath === null) continue
      let unitProg = ensureUnitProgram(entry.patternParts.pathname, pProg, ignoreCase)
      pMeta = matchPartUnits(unitProg.tokens, unitProg.optionals, 'pathname', canonicalPath, budget)
    }
    if (pMeta === null) continue

    results.push({ match: buildMatch(url, entry, hMeta, pMeta), insertion: entry.insertion })
    onLeafBatch(false)
  }
}

// ============================================================================
// Candidate Comparison & Materialization
// ============================================================================

function resolveCandidatePathMeta<data>(
  c: CandidateMatch<data>,
  rawPath: string,
  decodedPath: DecodedPathname | null,
): ReadonlyArray<MatchParamMeta> {
  if (c.deferredLeaf === null) return c.pathnameMeta
  return materializePendingPathMeta(
    c.deferredLeaf,
    c.deferredCaps,
    c.deferredWildcardStart,
    c.deferredWildcardDecodedSeg,
    rawPath,
    decodedPath,
  )
}

function pickBetterCandidate<data>(
  best: CandidateMatch<data> | null,
  candidate: CandidateMatch<data>,
  lowerHostname: string | null,
  rawPath: string,
  decodedPath: DecodedPathname | null,
): CandidateMatch<data> {
  if (best === null) return candidate

  let a = candidate.entry
  let b = best.entry

  if (a.protocolRank !== b.protocolRank) return a.protocolRank > b.protocolRank ? candidate : best
  if (a.portRank !== b.portRank) return a.portRank > b.portRank ? candidate : best

  if (lowerHostname !== null) {
    let hostCmp = compareHostnameRanges(lowerHostname, candidate.hostnameMeta, best.hostnameMeta)
    if (hostCmp !== 0) return hostCmp > 0 ? candidate : best
  }

  let aPathMeta = resolveCandidatePathMeta(candidate, rawPath, decodedPath)
  let bPathMeta = resolveCandidatePathMeta(best, rawPath, decodedPath)
  let pathCmp = comparePathnameRanges(aPathMeta, bPathMeta)
  if (pathCmp !== 0) return pathCmp > 0 ? candidate : best

  if (a.searchKeyValue !== b.searchKeyValue) {
    return a.searchKeyValue > b.searchKeyValue ? candidate : best
  }
  if (a.searchKey !== b.searchKey) {
    return a.searchKey > b.searchKey ? candidate : best
  }

  return a.insertion < b.insertion ? candidate : best
}

function materializeStaticOriginlessMatch<data>(
  url: URL,
  leaf: PathLeaf<data>,
): Match<string, data> {
  let entry = leaf.entry
  let decodedHostname = decodeHostname(url.hostname)
  let params: Record<string, string | undefined> = {}
  let names = entry.allCaptureNames
  for (let i = 0; i < names.length; i++) params[names[i]] = undefined

  return {
    url,
    pattern: entry.pattern,
    data: entry.data,
    params,
    paramsMeta: {
      hostname: [
        { type: '*', name: '*', value: decodedHostname, begin: 0, end: decodedHostname.length },
      ],
      pathname: [],
    },
  }
}

function materializeCandidate<data>(
  url: URL,
  candidate: CandidateMatch<data>,
  hostnameMeta: ReadonlyArray<MatchParamMeta>,
  rawPath: string,
  decodedPath: DecodedPathname | null,
): Match<string, data> {
  let pathnameMeta = resolveCandidatePathMeta(candidate, rawPath, decodedPath)
  return buildMatch(url, candidate.entry, hostnameMeta, pathnameMeta)
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
    let t = capTypeStack[i]
    result[i] = {
      type: t === 1 ? '*' : ':',
      segStart: capBeginStack[i],
      segEnd: capEndStack[i],
      decodedSegIndex: capSegIdxStack[i],
      omitted: t === 2,
    }
  }
  return result
}

function materializePendingPathMeta<data>(
  leaf: PathLeaf<data>,
  caps: Array<PendingCapture> | null,
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
        rawEncCursor += fastRawEncodedLength(rawPath, rawPosCursor, c.segStart)
        let begin = rawEncCursor
        rawEncCursor += fastRawEncodedLength(rawPath, c.segStart, c.segEnd)
        let end = rawEncCursor
        rawPosCursor = c.segEnd
        result.push({
          type: c.type,
          name,
          value: rawPath.slice(c.segStart, c.segEnd),
          begin,
          end,
        })
      } else {
        let seg = decodedPath!.segments[c.decodedSegIndex]
        result.push({
          type: c.type,
          name,
          value: seg.decoded,
          begin: seg.encBegin,
          end: seg.encEnd,
        })
      }
    }
  }

  if (wildcardName !== null) {
    if (isRaw) {
      rawEncCursor += fastRawEncodedLength(rawPath, rawPosCursor, wildcardStart)
      let begin = rawEncCursor
      let end = begin + fastRawEncodedLength(rawPath, wildcardStart, rawPath.length)
      result.push({
        type: '*',
        name: wildcardName,
        value: rawPath.slice(wildcardStart),
        begin,
        end,
      })
    } else {
      let segs = decodedPath!.segments
      let begin = segs[wildcardDecodedSeg].encBegin
      let end = decodedPath!.totalEncLen
      let value = ''
      for (let j = wildcardDecodedSeg; j < segs.length; j++) {
        if (j > wildcardDecodedSeg) value += '/'
        value += segs[j].decoded
      }
      result.push({
        type: '*',
        name: wildcardName,
        value,
        begin,
        end,
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
  // Emit left-to-right: leading wildcard first (at index 0), then param captures in reverse of RTL order
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

    if (segEnd === pos) {
      segments.push({
        decoded: '',
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
          hasStructuralDot: hasDot,
          hasNonStructuralSep: false,
          encBegin: segBeginOffset,
          encEnd: encOffset,
        })
        fullDecoded += decoded
      } else {
        // Split segment by structural '.' so encoded %2E / %2F are tracked accurately
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
            // Compute canonical encoded length of data chars ('.' and '/' here are non-structural = 3)
            for (let k = 0; k < decoded.length; k++) {
              let code = decoded.charCodeAt(k)
              if (code === 46 || code === 47) {
                encOffset += 3
              } else if (code < 128) {
                encOffset += plainAsciiLen1[code] === 1 ? 1 : 3
              } else if (code >= 0xd800 && code <= 0xdbff && k + 1 < decoded.length) {
                encOffset += 12
                k += 1
              } else if (code <= 0x7ff) {
                encOffset += 6
              } else {
                encOffset += 9
              }
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
  return {
    segments,
    fullDecoded,
    totalEncLen: encOffset,
    anyNonStructuralSep,
  }
}

function fastRawEncodedLength(rawPath: string, start: number, end: number): number {
  let len = 0
  for (let i = start; i < end; i++) {
    let code = rawPath.charCodeAt(i)
    if (code < 128) {
      len += plainAsciiLen1[code] === 1 ? 1 : 3
    } else {
      return len + encodedPathnameLength(rawPath, i, end)
    }
  }
  return len
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
    if (expectedProto === 'https') {
      if (proto !== 'https:') return false
    } else if (proto !== 'http:') {
      return false
    }
  }

  let expectedPort = parts.port
  if (expectedPort === null) {
    return parts.hostname === null || actualPort === ''
  }
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
          if (seen === null) seen = new Set(names)
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
      let len = text.length
      for (let j = 0; j < len; j++) {
        let code = text.charCodeAt(j)
        if (code <= 0x7f) {
          // Special chars : * ( ) \ are escaped with a leading '\'
          size += code === 58 || code === 42 || code === 40 || code === 41 || code === 92 ? 2 : 1
        } else if (code <= 0x7ff) {
          size += 2
        } else if (code >= 0xd800 && code <= 0xdbff && j + 1 < len) {
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
    hasDynamic: false,
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
  let map = node.static
  if (map === null) return undefined
  return map.get(rawPath.slice(pos, segEnd))
}

function lookupPathStaticKey<data>(
  node: PathTrieNode<data>,
  key: string,
): PathTrieNode<data> | undefined {
  let singleKey = node.staticKey
  if (singleKey !== null) {
    return key === singleKey ? node.staticChild! : undefined
  }
  let map = node.static
  if (map === null) return undefined
  return map.get(key)
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
