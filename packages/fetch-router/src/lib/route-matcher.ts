import type { RoutePattern } from '@remix-run/route-pattern'
import { createMultiMatcher } from '@remix-run/route-pattern/match'
import type { Match, MultiMatcher } from '@remix-run/route-pattern/match'

import type { RequestContext } from './request-context.ts'
import type { RequestMethod } from './request-methods.ts'
import type { RouteEntry } from './router.ts'

// Conservative ASCII subset of WHATWG path characters (unreserved + sub-delims) that URL
// serialization preserves without percent-encoding, plus '/', ':', '*' parsed per segment below.
const plainPatternChars = new Uint8Array(128)
for (let c = 48; c <= 57; c++) plainPatternChars[c] = 1 // 0-9
for (let c = 65; c <= 90; c++) plainPatternChars[c] = 1 // A-Z
for (let c = 97; c <= 122; c++) plainPatternChars[c] = 1 // a-z
plainPatternChars[33] = 1 // !
plainPatternChars[36] = 1 // $
plainPatternChars[38] = 1 // &
plainPatternChars[39] = 1 // '
plainPatternChars[42] = 1 // *
plainPatternChars[43] = 1 // +
plainPatternChars[44] = 1 // ,
plainPatternChars[45] = 1 // -
plainPatternChars[46] = 1 // .
plainPatternChars[47] = 1 // /
plainPatternChars[58] = 1 // :
plainPatternChars[59] = 1 // ;
plainPatternChars[61] = 1 // =
plainPatternChars[64] = 1 // @
plainPatternChars[95] = 1 // _
plainPatternChars[126] = 1 // ~

type SegmentSpec =
  | { readonly kind: 'static'; readonly text: string }
  | { readonly kind: 'param'; readonly name: string }

type FastPattern =
  | { readonly kind: 'static'; readonly path: string }
  | {
      readonly kind: 'trie'
      readonly segments: ReadonlyArray<SegmentSpec>
      readonly trailingWildcard: string | null
    }

type StoredRoute = {
  readonly entry: RouteEntry
  readonly parsed: FastPattern | null
}

type TrieLeaf = {
  readonly entry: RouteEntry
  readonly paramNames: ReadonlyArray<string>
  readonly paramCount: number
  readonly namedWildcard: string | null
}

type RadixNode = {
  prefix: string
  staticKey: string | null
  staticChild: RadixNode | null
  staticMap: Record<string, RadixNode> | null
  param: RadixNode | null
  wildcard: TrieLeaf | null
  leaf: TrieLeaf | null
}

type FastBucket = {
  readonly kind: 'fast'
  readonly staticMap: Record<string, RouteEntry>
  readonly root: RadixNode
  hasStatic: boolean
  hasDynamic: boolean
}

type MatcherBucket = {
  readonly kind: 'matcher'
  readonly matcher: MultiMatcher<RouteEntry>
}

type MethodBucket = FastBucket | MatcherBucket

export const MATCH_MISS = 0
export const MATCH_HIT = 1
export const MATCH_FALLBACK = 2

export type FastMatchStatus = typeof MATCH_MISS | typeof MATCH_HIT | typeof MATCH_FALLBACK

export interface FastMatchResult {
  entry: RouteEntry | undefined
  params: Record<string, string> | undefined
  isHeadFallback: boolean
}

// Reusable scratch buffers for synchronous, non-reentrant trie matching
const captureScratch = {
  starts: new Int32Array(32),
  ends: new Int32Array(32),
}

function setCapture(depth: number, start: number, end: number): void {
  if (depth >= captureScratch.starts.length) {
    let nextLen = captureScratch.starts.length * 2
    while (nextLen <= depth) nextLen *= 2
    let nextStarts = new Int32Array(nextLen)
    nextStarts.set(captureScratch.starts)
    captureScratch.starts = nextStarts
    let nextEnds = new Int32Array(nextLen)
    nextEnds.set(captureScratch.ends)
    captureScratch.ends = nextEnds
  }
  captureScratch.starts[depth] = start
  captureScratch.ends[depth] = end
}

// Matches route-pattern's identifier grammar ([A-Za-z_$][A-Za-z0-9_$]*)
function isIdentifierStart(code: number): boolean {
  return (
    (code >= 97 && code <= 122) || // a-z
    (code >= 65 && code <= 90) || // A-Z
    code === 95 || // _
    code === 36 // $
  )
}

function isIdentifierContinue(code: number): boolean {
  return isIdentifierStart(code) || (code >= 48 && code <= 57) // 0-9
}

function isWholeSegmentIdentifier(raw: string, start: number, end: number): boolean {
  if (start >= end || !isIdentifierStart(raw.charCodeAt(start))) {
    return false
  }
  for (let i = start + 1; i < end; i++) {
    if (!isIdentifierContinue(raw.charCodeAt(i))) {
      return false
    }
  }
  return true
}

function classifyFastPathname(raw: string): FastPattern | null {
  let len = raw.length
  if (len === 0) {
    return { kind: 'static', path: '/' }
  }

  let hasDynamic = false
  for (let i = 0; i < len; i++) {
    let c = raw.charCodeAt(i)
    if (c >= 128 || plainPatternChars[c] !== 1) {
      return null
    }
    if (c === 58 || c === 42) {
      hasDynamic = true
    }
  }

  if (!hasDynamic) {
    return { kind: 'static', path: '/' + raw }
  }

  let segments: Array<SegmentSpec> = []
  let trailingWildcard: string | null = null
  let pos = 0

  while (true) {
    let slash = raw.indexOf('/', pos)
    let segEnd = slash === -1 ? len : slash
    let isLast = slash === -1
    let segLen = segEnd - pos
    let first = segLen > 0 ? raw.charCodeAt(pos) : -1

    if (first === 42) {
      // Wildcards are only fast-indexed when they span the entire trailing segment
      if (!isLast) return null
      if (segLen === 1) {
        trailingWildcard = '*'
      } else {
        if (!isWholeSegmentIdentifier(raw, pos + 1, segEnd)) return null
        let name = raw.slice(pos + 1, segEnd)
        if (name === '__proto__') return null
        trailingWildcard = name
      }
      break
    }

    if (first === 58) {
      // Params are only fast-indexed when the identifier spans the entire segment
      if (!isWholeSegmentIdentifier(raw, pos + 1, segEnd)) return null
      let name = raw.slice(pos + 1, segEnd)
      if (name === '__proto__') return null
      segments.push({ kind: 'param', name })
    } else {
      for (let i = pos; i < segEnd; i++) {
        let c = raw.charCodeAt(i)
        if (c === 58 || c === 42) return null
      }
      segments.push({ kind: 'static', text: raw.slice(pos, segEnd) })
    }

    if (isLast) break
    pos = slash + 1
  }

  return { kind: 'trie', segments, trailingWildcard }
}

function classifyFastPattern(pattern: RoutePattern, rawSource?: string): FastPattern | null {
  if (
    rawSource !== undefined &&
    rawSource.length > 0 &&
    rawSource.charCodeAt(0) === 47 &&
    (rawSource.length === 1 || rawSource.charCodeAt(1) !== 47)
  ) {
    return classifyFastPathname(rawSource.slice(1))
  }

  let json = pattern.toJSON()
  if (json.protocol !== '' || json.hostname !== '' || json.port !== '' || json.search !== '') {
    return null
  }

  return classifyFastPathname(json.pathname)
}

function buildLeafParams(
  leaf: TrieLeaf,
  path: string,
  capCount: number,
  wildcardStart: number,
): Record<string, string> | undefined {
  let count = leaf.paramCount
  let namedWildcard = leaf.namedWildcard

  if (count === 0 && namedWildcard === null) {
    return undefined
  }

  let params: Record<string, string> = {}
  let names = leaf.paramNames
  let starts = captureScratch.starts
  let ends = captureScratch.ends

  if (namedWildcard === null) {
    if (count === 1) {
      params[names[0]] = path.slice(starts[0], ends[0])
      return params
    }
    if (count === 2) {
      params[names[0]] = path.slice(starts[0], ends[0])
      params[names[1]] = path.slice(starts[1], ends[1])
      return params
    }
    if (count === 3) {
      params[names[0]] = path.slice(starts[0], ends[0])
      params[names[1]] = path.slice(starts[1], ends[1])
      params[names[2]] = path.slice(starts[2], ends[2])
      return params
    }
  }

  for (let i = 0; i < capCount; i++) {
    params[names[i]] = path.slice(starts[i], ends[i])
  }
  if (namedWildcard !== null) {
    params[namedWildcard] = path.slice(wildcardStart)
  }
  return params
}

function createRadixNode(): RadixNode {
  return {
    prefix: '',
    staticKey: null,
    staticChild: null,
    staticMap: null,
    param: null,
    wildcard: null,
    leaf: null,
  }
}

function insertIntoFastBucket(bucket: FastBucket, parsed: FastPattern, entry: RouteEntry): void {
  if (parsed.kind === 'static') {
    bucket.hasStatic = true
    if (bucket.staticMap[parsed.path] === undefined) {
      bucket.staticMap[parsed.path] = entry
    }
    return
  }

  bucket.hasDynamic = true
  let node = bucket.root
  let paramNames: Array<string> = []

  for (let i = 0; i < parsed.segments.length; i++) {
    let seg = parsed.segments[i]
    if (seg.kind === 'param') {
      paramNames.push(seg.name)
      if (node.param === null) node.param = createRadixNode()
      node = node.param
    } else {
      let key = seg.text
      if (node.staticKey === null && node.staticMap === null) {
        let child = createRadixNode()
        node.staticKey = key
        node.staticChild = child
        node = child
      } else if (node.staticKey === key) {
        node = node.staticChild!
      } else {
        if (node.staticMap === null) {
          let map: Record<string, RadixNode> = Object.create(null)
          map[node.staticKey!] = node.staticChild!
          node.staticMap = map
          node.staticKey = null
          node.staticChild = null
        }
        let child = node.staticMap[key]
        if (child === undefined) {
          child = createRadixNode()
          node.staticMap[key] = child
        }
        node = child
      }
    }
  }

  if (parsed.trailingWildcard !== null) {
    if (node.wildcard === null) {
      node.wildcard = {
        entry,
        paramNames,
        paramCount: paramNames.length,
        namedWildcard: parsed.trailingWildcard !== '*' ? parsed.trailingWildcard : null,
      }
    }
  } else if (node.leaf === null) {
    node.leaf = {
      entry,
      paramNames,
      paramCount: paramNames.length,
      namedWildcard: null,
    }
  }
}

function compressRadixNode(node: RadixNode): void {
  while (
    node.staticKey !== null &&
    node.staticKey.length > 0 &&
    node.staticMap === null &&
    node.param === null &&
    node.wildcard === null &&
    node.leaf === null
  ) {
    let child = node.staticChild!
    node.prefix = node.prefix.length > 0 ? node.prefix + '/' + node.staticKey : node.staticKey
    node.staticKey = child.staticKey
    node.staticChild = child.staticChild
    node.staticMap = child.staticMap
    node.param = child.param
    node.wildcard = child.wildcard
    node.leaf = child.leaf
  }

  if (node.staticChild !== null) {
    compressRadixNode(node.staticChild)
  }

  if (node.staticMap !== null) {
    for (let key in node.staticMap) {
      compressRadixNode(node.staticMap[key])
    }
  }

  if (node.param !== null) {
    compressRadixNode(node.param)
  }
}

function hasDotInRange(str: string, start: number, end: number): boolean {
  for (let i = start; i < end; i++) {
    if (str.charCodeAt(i) === 46) return true
  }
  return false
}

// Keep traversal semantics in sync with testRadix() below.
function matchRadix(
  node: RadixNode,
  path: string,
  pos: number,
  capCount: number,
  hasAnyDot: boolean,
  out: FastMatchResult,
): boolean {
  let len = path.length

  while (true) {
    let pfx = node.prefix
    if (pfx.length > 0) {
      if (!path.startsWith(pfx, pos)) return false
      pos += pfx.length
      if (pos === len) {
        let leaf = node.leaf
        if (leaf === null) return false
        out.entry = leaf.entry
        out.params = buildLeafParams(leaf, path, capCount, -1)
        return true
      }
      if (path.charCodeAt(pos) !== 47) return false
      pos += 1
    }

    let slash = path.indexOf('/', pos)
    let segEnd = slash === -1 ? len : slash
    let isLast = slash === -1
    let segLen = segEnd - pos

    let staticChild: RadixNode | undefined
    if (node.staticKey !== null) {
      let key = node.staticKey
      if (key.length === segLen && (segLen === 0 || path.startsWith(key, pos))) {
        staticChild = node.staticChild!
      }
    } else if (node.staticMap !== null) {
      staticChild = node.staticMap[path.slice(pos, segEnd)]
    }

    let hasFallback = node.param !== null || node.wildcard !== null

    if (staticChild !== undefined) {
      if (!hasFallback) {
        if (isLast) {
          let leaf = staticChild.prefix.length === 0 ? staticChild.leaf : null
          if (leaf === null) return false
          out.entry = leaf.entry
          out.params = buildLeafParams(leaf, path, capCount, -1)
          return true
        }
        node = staticChild
        pos = slash + 1
        continue
      }

      if (isLast) {
        let leaf = staticChild.prefix.length === 0 ? staticChild.leaf : null
        if (leaf !== null) {
          out.entry = leaf.entry
          out.params = buildLeafParams(leaf, path, capCount, -1)
          return true
        }
      } else if (matchRadix(staticChild, path, slash + 1, capCount, hasAnyDot, out)) {
        return true
      }
    }

    if (node.param !== null && segLen > 0 && (!hasAnyDot || !hasDotInRange(path, pos, segEnd))) {
      setCapture(capCount, pos, segEnd)
      let pNode = node.param

      if (node.wildcard === null) {
        if (isLast) {
          let leaf = pNode.prefix.length === 0 ? pNode.leaf : null
          if (leaf === null) return false
          out.entry = leaf.entry
          out.params = buildLeafParams(leaf, path, capCount + 1, -1)
          return true
        }
        node = pNode
        pos = slash + 1
        capCount += 1
        continue
      }

      if (isLast) {
        let leaf = pNode.prefix.length === 0 ? pNode.leaf : null
        if (leaf !== null) {
          out.entry = leaf.entry
          out.params = buildLeafParams(leaf, path, capCount + 1, -1)
          return true
        }
      } else if (matchRadix(pNode, path, slash + 1, capCount + 1, hasAnyDot, out)) {
        return true
      }
    }

    if (node.wildcard !== null) {
      let wc = node.wildcard
      out.entry = wc.entry
      out.params = buildLeafParams(wc, path, capCount, pos)
      return true
    }

    return false
  }
}

// Keep traversal semantics in sync with matchRadix() above.
function testRadix(node: RadixNode, path: string, pos: number, hasAnyDot: boolean): boolean {
  let len = path.length

  while (true) {
    let pfx = node.prefix
    if (pfx.length > 0) {
      if (!path.startsWith(pfx, pos)) return false
      pos += pfx.length
      if (pos === len) return node.leaf !== null
      if (path.charCodeAt(pos) !== 47) return false
      pos += 1
    }

    let slash = path.indexOf('/', pos)
    let segEnd = slash === -1 ? len : slash
    let isLast = slash === -1
    let segLen = segEnd - pos

    let staticChild: RadixNode | undefined
    if (node.staticKey !== null) {
      let key = node.staticKey
      if (key.length === segLen && (segLen === 0 || path.startsWith(key, pos))) {
        staticChild = node.staticChild!
      }
    } else if (node.staticMap !== null) {
      staticChild = node.staticMap[path.slice(pos, segEnd)]
    }

    let hasFallback = node.param !== null || node.wildcard !== null

    if (staticChild !== undefined) {
      if (!hasFallback) {
        if (isLast) return staticChild.prefix.length === 0 && staticChild.leaf !== null
        node = staticChild
        pos = slash + 1
        continue
      }

      if (isLast) {
        if (staticChild.prefix.length === 0 && staticChild.leaf !== null) return true
      } else if (testRadix(staticChild, path, slash + 1, hasAnyDot)) {
        return true
      }
    }

    if (node.param !== null && segLen > 0 && (!hasAnyDot || !hasDotInRange(path, pos, segEnd))) {
      let pNode = node.param
      if (node.wildcard === null) {
        if (isLast) return pNode.prefix.length === 0 && pNode.leaf !== null
        node = pNode
        pos = slash + 1
        continue
      }

      if (isLast) {
        if (pNode.prefix.length === 0 && pNode.leaf !== null) return true
      } else if (testRadix(pNode, path, slash + 1, hasAnyDot)) {
        return true
      }
    }

    return node.wildcard !== null
  }
}

export function extractPlainHttpPathname(url: string): string | null {
  let len = url.length
  if (
    len < 8 ||
    url.charCodeAt(0) !== 104 || // h
    url.charCodeAt(1) !== 116 || // t
    url.charCodeAt(2) !== 116 || // t
    url.charCodeAt(3) !== 112 // p
  ) {
    return null
  }

  let hostStart: number
  let c4 = url.charCodeAt(4)
  if (c4 === 58 && url.charCodeAt(5) === 47 && url.charCodeAt(6) === 47) {
    hostStart = 7 // http://
  } else if (
    c4 === 115 &&
    url.charCodeAt(5) === 58 &&
    url.charCodeAt(6) === 47 &&
    url.charCodeAt(7) === 47
  ) {
    hostStart = 8 // https://
  } else {
    return null
  }

  let start = url.indexOf('/', hostStart)
  if (start === -1) return '/'

  let q = url.indexOf('?', start)
  let h = url.indexOf('#', start)
  let end = q === -1 ? (h === -1 ? len : h) : h === -1 || q < h ? q : h

  // Standard Request URLs are already WHATWG-canonicalized (backslashes, dot segments, and
  // non-ASCII are normalized/percent-encoded); only '%' requires full URL/percent-decoding fallback.
  let pct = url.indexOf('%', start)
  if (pct !== -1 && pct < end) return null

  return end === len ? url.slice(start) : url.slice(start, end)
}

function buildBucket(items: ReadonlyArray<StoredRoute>): MethodBucket {
  let allFast = true
  for (let i = 0; i < items.length; i++) {
    if (items[i].parsed === null) {
      allFast = false
      break
    }
  }

  if (!allFast) {
    let matcher = createMultiMatcher<RouteEntry>()
    for (let i = 0; i < items.length; i++) {
      let entry = items[i].entry
      matcher.add(entry.pattern, entry)
    }
    return { kind: 'matcher', matcher }
  }

  let bucket: FastBucket = {
    kind: 'fast',
    staticMap: Object.create(null),
    root: createRadixNode(),
    hasStatic: false,
    hasDynamic: false,
  }

  for (let i = 0; i < items.length; i++) {
    insertIntoFastBucket(bucket, items[i].parsed!, items[i].entry)
  }

  if (bucket.hasDynamic) {
    compressRadixNode(bucket.root)
  }

  return bucket
}

export class RouteMatcher {
  #items: Array<StoredRoute> = []
  #hasExplicitHead = false
  #dirty = false
  #byMethod: Record<string, MethodBucket> = Object.create(null)
  #methods: Array<RequestMethod> = []
  #anyBucket: MethodBucket | null = null
  #allFast = true
  #fallbackMatcher: MultiMatcher<RouteEntry> | null = null

  // Shared scratch result reused across requests; callers must read fields synchronously
  // before invoking user middleware or handlers.
  readonly result: FastMatchResult = {
    entry: undefined,
    params: undefined,
    isHeadFallback: false,
  }

  add(entry: RouteEntry, rawSource?: string): void {
    this.#items.push({ entry, parsed: classifyFastPattern(entry.pattern, rawSource) })
    if (entry.method === 'HEAD') {
      this.#hasExplicitHead = true
    }
    this.#dirty = true
  }

  #ensureCompiled(): void {
    if (!this.#dirty) return

    let grouped: Record<string, Array<StoredRoute>> = Object.create(null)
    let methods: Array<RequestMethod> = []
    let anyItems: Array<StoredRoute> = []

    for (let i = 0; i < this.#items.length; i++) {
      let item = this.#items[i]
      let method = item.entry.method
      if (method === 'ANY') {
        anyItems.push(item)
      } else {
        let list = grouped[method]
        if (list === undefined) {
          list = []
          grouped[method] = list
          methods.push(method)
        }
        list.push(item)
      }
    }

    let byMethod: Record<string, MethodBucket> = Object.create(null)
    let allFast = true
    let hasAny = anyItems.length > 0

    for (let i = 0; i < methods.length; i++) {
      let method = methods[i]
      let list: Array<StoredRoute>
      if (!hasAny) {
        list = grouped[method]
      } else {
        // Preserve original registration order between method-specific and ANY routes
        list = []
        for (let j = 0; j < this.#items.length; j++) {
          let item = this.#items[j]
          if (item.entry.method === method || item.entry.method === 'ANY') {
            list.push(item)
          }
        }
      }
      let bucket = buildBucket(list)
      if (bucket.kind !== 'fast') allFast = false
      byMethod[method] = bucket
    }

    let anyBucket: MethodBucket | null = null
    if (hasAny) {
      anyBucket = buildBucket(anyItems)
      if (anyBucket.kind !== 'fast') allFast = false
    }

    this.#byMethod = byMethod
    this.#methods = methods
    this.#anyBucket = anyBucket
    this.#allFast = allFast
    this.#fallbackMatcher = null
    this.#dirty = false
  }

  match(
    method: string,
    requestUrl: string | undefined,
    contextUrl: URL | undefined,
    context: RequestContext,
  ): FastMatchStatus {
    if (this.#items.length === 0) return MATCH_MISS
    if (this.#dirty) this.#ensureCompiled()

    // Explicit HEAD or ANY routes can tie with GET routes on specificity; defer to full matchAll()
    if (method === 'HEAD' && (this.#hasExplicitHead || this.#anyBucket !== null)) {
      return MATCH_FALLBACK
    }

    let bucket =
      this.#byMethod[method] ??
      (method === 'HEAD' ? this.#byMethod['GET'] : undefined) ??
      this.#anyBucket

    if (bucket === null || bucket === undefined) {
      return MATCH_MISS
    }

    if (bucket.kind === 'fast') {
      let pathname: string | null
      if (contextUrl !== undefined) {
        let proto = contextUrl.protocol
        if (proto !== 'http:' && proto !== 'https:') return MATCH_FALLBACK
        pathname = contextUrl.pathname
        if (pathname.indexOf('%') !== -1) return MATCH_FALLBACK
      } else if (requestUrl !== undefined) {
        pathname = extractPlainHttpPathname(requestUrl)
        if (pathname === null) return MATCH_FALLBACK
      } else {
        return MATCH_FALLBACK
      }

      if (bucket.hasStatic) {
        let staticEntry = bucket.staticMap[pathname]
        if (staticEntry !== undefined) {
          this.result.entry = staticEntry
          this.result.params = undefined
          this.result.isHeadFallback = method === 'HEAD' && staticEntry.method === 'GET'
          return MATCH_HIT
        }
      }

      if (
        bucket.hasDynamic &&
        matchRadix(bucket.root, pathname, 1, 0, pathname.indexOf('.') !== -1, this.result)
      ) {
        this.result.isHeadFallback = method === 'HEAD' && this.result.entry!.method === 'GET'
        return MATCH_HIT
      }

      return MATCH_MISS
    }

    let match = bucket.matcher.match(contextUrl ?? context.url)
    if (match === null) return MATCH_MISS

    this.result.entry = match.data
    this.result.params = match.params as Record<string, string>
    this.result.isHeadFallback = method === 'HEAD' && match.data.method === 'GET'
    return MATCH_HIT
  }

  // Check whether any other registered method matches when the requested method missed,
  // avoiding full matchAll() construction on plain 404 misses.
  findAllowedMethodsFast(
    currentMethod: string,
    requestUrl: string | undefined,
    contextUrl: URL | undefined,
  ): Set<RequestMethod> | null | undefined {
    if (this.#items.length === 0) return null
    if (this.#dirty) this.#ensureCompiled()
    if (!this.#allFast) return undefined

    let pathname: string | null
    if (contextUrl !== undefined) {
      let proto = contextUrl.protocol
      if (proto !== 'http:' && proto !== 'https:') return undefined
      pathname = contextUrl.pathname
      if (pathname.indexOf('%') !== -1) return undefined
    } else if (requestUrl !== undefined) {
      pathname = extractPlainHttpPathname(requestUrl)
      if (pathname === null) return undefined
    } else {
      return undefined
    }

    let hasAnyDot: boolean | undefined
    let allowed: Set<RequestMethod> | null = null
    for (let i = 0; i < this.#methods.length; i++) {
      let method = this.#methods[i]
      if (method === currentMethod) continue
      let bucket = this.#byMethod[method] as FastBucket
      let matched =
        (bucket.hasStatic && bucket.staticMap[pathname] !== undefined) ||
        (bucket.hasDynamic &&
          testRadix(bucket.root, pathname, 1, (hasAnyDot ??= pathname.indexOf('.') !== -1)))
      if (matched) {
        allowed ??= new Set()
        allowed.add(method)
      }
    }

    return allowed
  }

  matchAllFallback(url: URL): Array<Match<string, RouteEntry>> {
    if (this.#dirty) this.#ensureCompiled()
    if (this.#fallbackMatcher === null) {
      let matcher = createMultiMatcher<RouteEntry>()
      for (let i = 0; i < this.#items.length; i++) {
        let entry = this.#items[i].entry
        matcher.add(entry.pattern, entry)
      }
      this.#fallbackMatcher = matcher
    }
    return this.#fallbackMatcher.matchAll(url)
  }
}
