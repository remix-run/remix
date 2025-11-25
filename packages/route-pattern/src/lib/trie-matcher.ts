import type { Matcher, MatchResult } from './matcher.ts'
import { parse, type Token, type ParseResult } from './parse.ts'
import { RoutePattern } from './route-pattern.ts'
import { parseSearch, type SearchConstraints } from './search-constraints.ts'
import { stringifyTokens } from './stringify.ts'

interface TrieNode {
  // Unique ID for deduplication
  id?: number

  // Exact literal segments (fast path) - using plain object for better V8 optimization
  staticChildren: Record<string, TrieNode>

  // Parametric segment shapes with precompiled matchers
  shapeChildren: Map<string, { node: TrieNode; tokens: Token[]; ignoreCase: boolean }>

  // Fallback for unconstrained single-segment variables
  variableChild?: VariableNode

  // Wildcard edge that can consume 0..n segments and continue matching
  wildcardEdge?: WildcardEdge

  // Optional edges that can be taken or skipped
  optionalEdges: OptionalEdge[]

  // Terminal patterns that end at this node
  patterns: PatternMatch<any>[]

  // Depth metadata for wildcard pruning
  minDepthToTerminal?: number
  maxDepthToTerminal?: number

  // Track if any patterns reachable from this node have ignoreCase
  hasIgnoreCasePatterns?: boolean

  // Parent node for incremental depth updates
  parent?: TrieNode
}

interface VariableNode extends TrieNode {
  paramName: string
}

interface WildcardEdge {
  paramName?: string // undefined for unnamed wildcards
  continuation: TrieNode
}

interface OptionalEdge {
  // Where to continue after the optional (for both take and skip paths)
  continuation: TrieNode
}

interface PatternMatch<T = any> {
  pattern: RoutePattern
  node: T
  paramNames: string[]
  matchOrigin: boolean
  // Search constraints applied after structural match
  searchConstraints?: SearchConstraints
  // Precomputed specificity for deterministic ranking
  specificity: number
  // Case sensitivity for pathname matching
  ignoreCase: boolean
}

// Origin trie for full URL patterns
interface OriginTrieNode {
  // Static protocol patterns (case-insensitive)
  protocolChildren: Map<string, ProtocolNode>
  // Variable protocol patterns
  protocolVariableChild?: { paramName: string; node: ProtocolNode }
  // Catch-all for any protocol (no protocol specified in pattern)
  anyProtocolChild?: ProtocolNode
}

interface ProtocolNode {
  // Hostname trie (reversed labels, case-insensitive)
  hostnameRoot: HostnameTrieNode
}

interface HostnameTrieNode {
  // Literal hostname labels (reversed: com -> example -> api) - using plain object for better V8 optimization
  staticChildren: Record<string, HostnameTrieNode>
  // Variable hostname labels
  variableChild?: { paramName: string; node: HostnameTrieNode }
  // Wildcard hostname labels
  wildcardChild?: { paramName?: string; node: HostnameTrieNode }
  // Port-specific pathname tries
  portChildren: Map<string, TrieNode>
  // Default pathname trie (any port)
  defaultPathnameTrie?: TrieNode

  // Parent node for incremental depth updates
  parent?: HostnameTrieNode
}

interface MatchState {
  segments: string[]
  segmentIndex: number
  params: Record<string, string>
  specificity: number
  // For deduplication in best-first traversal
  nodeId?: number
  wildcardSpan?: string // e.g., "3-5" for wildcard consuming segments 3 to 5
}

// Priority queue item for best-first traversal
interface TraversalState {
  node: TrieNode
  state: MatchState
  // Priority based on combined specificity + estimated remaining depth
  priority: number
}

// Add interface ParsedURL {
interface ParsedURL {
  protocol: string
  hostname: string
  hostnameLabels: string[]
  port: string | undefined
  pathname: string
  segments: string[]
  search: string
  searchParsed: ReturnType<typeof parseSearch>
}

/**
 * Options for the `TrieMatcher`.
 */
export interface TrieMatcherOptions {
  /**
   * The maximum number of traversal states to explore during matching.
   *
   * This prevents excessive computation in cases with high branching (e.g., many optionals or
   * wildcards). Increase for more complex routes if you encounter truncated results.
   *
   * @default 10_000
   */
  maxTraversalStates?: number
  /**
   * The maximum depth of nested optionals to explore in traversal.
   *
   * Limits branching in patterns like `/api(/v1(/v2(/v3)))` to prevent exponential state growth.
   * Adjust higher for apps with deeply nested optionals.
   *
   * @default 5
   */
  maxOptionalDepth?: number
}

/**
 * A trie-based matcher optimized for large route sets with repeated matching.
 *
 * **Use TrieMatcher when:**
 * - You have 100+ route patterns
 * - Patterns are registered once and matched repeatedly (e.g., web server routing)
 * - Match performance matters more than build time
 * - You need exhaustive matching via `matchAll()`
 */
export class TrieMatcher<T = any> implements Matcher<T> {
  #pathnameOnlyRoot: TrieNode
  #originRoot: OriginTrieNode
  #patternCount = 0
  #maxTraversalStates: number
  #nodeIdCounter = 0
  #maxOptionalDepth = 5
  #prefixMatcherCache = new Map<string, (segment: string) => boolean>()

  /**
   * @param options Options for the matcher
   */
  constructor(options?: TrieMatcherOptions) {
    this.#pathnameOnlyRoot = this.#createNode()
    this.#originRoot = this.#createOriginNode()
    this.#maxTraversalStates = options?.maxTraversalStates ?? 10_000
    this.#maxOptionalDepth = options?.maxOptionalDepth ?? 5
  }

  /**
   * Add a pattern to the trie.
   *
   * @param pattern The pattern to add
   * @param node The data to associate with the pattern
   */
  add(pattern: string | RoutePattern, node: T): void {
    let routePattern = typeof pattern === 'string' ? new RoutePattern(pattern) : pattern
    let parsed = parse(routePattern.source)

    // Enforce maxOptionalDepth across all token groups in this pattern
    let maxDepthInPattern = 0
    if (parsed.protocol)
      maxDepthInPattern = Math.max(
        maxDepthInPattern,
        this.#maxOptionalDepthInTokens(parsed.protocol),
      )
    if (parsed.hostname)
      maxDepthInPattern = Math.max(
        maxDepthInPattern,
        this.#maxOptionalDepthInTokens(parsed.hostname),
      )
    if (parsed.pathname)
      maxDepthInPattern = Math.max(
        maxDepthInPattern,
        this.#maxOptionalDepthInTokens(parsed.pathname),
      )
    if (maxDepthInPattern > this.#maxOptionalDepth) {
      throw new Error(
        `Pattern exceeds maxOptionalDepth (${this.#maxOptionalDepth}): ${routePattern.source}`,
      )
    }

    let isOrigin = parsed.protocol || parsed.hostname || parsed.port
    if (isOrigin) {
      // Build origin structure
      // Handle protocol
      if (parsed.protocol) {
        if (parsed.protocol.length === 1 && parsed.protocol[0].type === 'variable') {
          // Variable protocol pattern
          if (!this.#originRoot.protocolVariableChild) {
            this.#originRoot.protocolVariableChild = {
              paramName: parsed.protocol[0].name,
              node: { hostnameRoot: this.#createHostnameNode() },
            }
          }
          this.#addHostnamePattern(
            this.#originRoot.protocolVariableChild.node.hostnameRoot,
            parsed.hostname || [],
            parsed.port,
            parsed.pathname,
            routePattern,
            node,
            parsed.searchConstraints,
            parsed,
          )
        } else {
          let protocolVariants = this.#expandProtocolOptionals(parsed.protocol)

          for (let protocolKey of protocolVariants) {
            let existing = this.#originRoot.protocolChildren.get(protocolKey)
            if (!existing) {
              existing = { hostnameRoot: this.#createHostnameNode() }
              this.#originRoot.protocolChildren.set(protocolKey, existing)
            }
            this.#addHostnamePattern(
              existing.hostnameRoot,
              parsed.hostname || [],
              parsed.port,
              parsed.pathname,
              routePattern,
              node,
              parsed.searchConstraints,
              parsed,
            )
          }
        }
      } else {
        // Any protocol pattern (no protocol specified)
        if (!this.#originRoot.anyProtocolChild) {
          this.#originRoot.anyProtocolChild = { hostnameRoot: this.#createHostnameNode() }
        }
        this.#addHostnamePattern(
          this.#originRoot.anyProtocolChild.hostnameRoot,
          parsed.hostname || [],
          parsed.port,
          parsed.pathname,
          routePattern,
          node,
          parsed.searchConstraints,
          parsed,
        )
      }
    } else {
      let root = this.#pathnameOnlyRoot
      if (!parsed.pathname) {
        // Empty pattern matches root
        this.#addPatternMatch(root, routePattern, node, [], false, parsed.searchConstraints, parsed)
        this.#updateDepthUp(root)
        this.#patternCount++
        return
      }

      this.#buildPathTrie(
        root,
        parsed.pathname,
        routePattern,
        node,
        parsed.searchConstraints,
        parsed,
      )
    }

    this.#patternCount++
  }

  /**
   * Find the best match for a URL.
   *
   * @param url The URL to match
   * @return The match result, or `null` if no match was found
   */
  match(url: string | URL): MatchResult<T> | null {
    let urlObj = typeof url === 'string' ? new URL(url) : url

    let parsedUrl: ParsedURL = {
      protocol: urlObj.protocol.slice(0, -1).toLowerCase(),
      hostname: urlObj.hostname.toLowerCase(),
      hostnameLabels: urlObj.hostname.toLowerCase().split('.').reverse(),
      port: urlObj.port,
      pathname: urlObj.pathname.replace(/^\/+/, '').replace(/\/+$/, ''),
      segments: urlObj.pathname
        .replace(/^\/+/, '')
        .replace(/\/+$/, '')
        .split('/')
        .filter((s) => s !== ''),
      search: urlObj.search,
      searchParsed: parseSearch(urlObj.search),
    }

    let segments = parsedUrl.segments

    let originMatch = null
    if (parsedUrl.protocol || parsedUrl.hostname || parsedUrl.port) {
      originMatch = this.#tryOriginMatch(parsedUrl, segments, urlObj)
      if (originMatch) return originMatch
    }

    let staticMatch = this.#tryStaticPathMatch(segments, urlObj.search, urlObj)
    if (staticMatch) return staticMatch

    let pathnameMatches = this.#findPathnameMatches(segments, urlObj.search, true)
    if (pathnameMatches.length > 0) {
      let best = pathnameMatches[0]
      return { data: best.match.node, params: best.state.params, url: urlObj }
    }

    return null
  }

  /**
   * Find all matches for a URL.
   *
   * @param url The URL to match
   * @return A generator that yields all matches
   */
  *matchAll(url: string | URL): Generator<MatchResult<T>> {
    let urlObj = typeof url === 'string' ? new URL(url) : url
    let pathname = urlObj.pathname

    // Normalize pathname - remove leading and trailing slashes
    if (pathname.startsWith('/')) {
      pathname = pathname.slice(1)
    }
    if (pathname.endsWith('/') && pathname.length > 0) {
      pathname = pathname.slice(0, -1)
    }

    let segments = pathname === '' ? [] : pathname.split('/').filter((s) => s !== '')

    // Combine origin and pathname matches (no early exit for matchAll)
    let allMatches: Array<{ match: PatternMatch<any>; state: MatchState }> = []

    // Add origin matches (higher priority) - no early exit
    allMatches.push(...this.#findOriginMatches(urlObj, segments, urlObj.search, false))

    let staticAll = this.#tryStaticPathAll(segments, urlObj.search, urlObj)
    allMatches.push(...staticAll)

    // Add pathname matches (lower priority) - no early exit
    allMatches.push(...this.#findPathnameMatches(segments, urlObj.search, false))

    // Already filtered by inline search checks, just sort
    allMatches.sort(
      (a, b) => this.#finalScore(b.match, b.state) - this.#finalScore(a.match, a.state),
    )

    for (let match of allMatches) {
      yield {
        data: match.match.node,
        params: match.state.params,
        url: urlObj,
      }
    }
  }

  /**
   * The number of patterns in the trie.
   */
  get size(): number {
    return this.#patternCount
  }

  // Private implementation methods

  #finalScore(match: PatternMatch<any>, state: MatchState): number {
    return match.specificity + state.specificity
  }

  #updateDepthUp(node: TrieNode): void {
    let minD = node.patterns.length > 0 ? 0 : Infinity
    let maxD = node.patterns.length > 0 ? 0 : 0

    let updateDepth = (child: TrieNode, minIncrement: number, maxIncrement: number) => {
      let childDMin = child.minDepthToTerminal ?? Infinity
      let childDMax = child.maxDepthToTerminal ?? 0
      minD = Math.min(minD, childDMin + minIncrement)
      maxD = Math.max(maxD, childDMax + maxIncrement)
    }

    // Static, shape, and variable children all increment depth by 1
    for (let child of Object.values(node.staticChildren)) updateDepth(child, 1, 1)
    for (let entry of node.shapeChildren.values()) updateDepth(entry.node, 1, 1)
    if (node.variableChild) updateDepth(node.variableChild, 1, 1)

    // Wildcard and optional edges don't increment min depth
    if (node.wildcardEdge) updateDepth(node.wildcardEdge.continuation, 0, 100)
    for (let opt of node.optionalEdges) updateDepth(opt.continuation, 0, 0)

    node.minDepthToTerminal = minD === Infinity ? undefined : minD
    node.maxDepthToTerminal = maxD

    if (node.parent) this.#updateDepthUp(node.parent)
  }

  #createNode(): TrieNode {
    let node: any = {
      staticChildren: {},
      shapeChildren: new Map(),
      optionalEdges: [],
      patterns: [],
      minDepthToTerminal: undefined,
      maxDepthToTerminal: undefined,
      parent: undefined,
    }
    // Assign unique ID for deduplication
    node.id = this.#nodeIdCounter++
    return node
  }

  #createOriginNode(): OriginTrieNode {
    return {
      protocolChildren: new Map(),
    }
  }

  #createHostnameNode(): HostnameTrieNode {
    return {
      staticChildren: {},
      portChildren: new Map(),
    }
  }

  #expandProtocolOptionals(protocolTokens: Token[]): string[] {
    // Handle simple "text + optional(text)" pattern like http(s):// -> ["http", "https"]
    if (
      protocolTokens.length !== 2 ||
      protocolTokens[0].type !== 'text' ||
      protocolTokens[1].type !== 'optional'
    ) {
      return [stringifyTokens(protocolTokens).toLowerCase()]
    }

    let baseText = protocolTokens[0].value
    let optionalToken = protocolTokens[1] as { type: 'optional'; tokens: Token[] }

    if (optionalToken.tokens.length !== 1 || optionalToken.tokens[0].type !== 'text') {
      return [stringifyTokens(protocolTokens).toLowerCase()]
    }

    let optionalText = optionalToken.tokens[0].value
    return [baseText.toLowerCase(), (baseText + optionalText).toLowerCase()]
  }

  #addHostnamePattern(
    hostnameNode: HostnameTrieNode,
    hostnameTokens: Token[],
    port: string | undefined,
    pathnameTokens: Token[] | undefined,
    pattern: RoutePattern,
    userNode: T,
    searchConstraints?: SearchConstraints,
    parsed?: ParseResult,
  ): void {
    // Reverse hostname labels for trie traversal (com.example.api -> api.example.com)
    let reversedLabels = this.#reverseHostnameLabels(hostnameTokens)
    let finalHostnameNode = this.#traverseHostnameLabels(hostnameNode, reversedLabels)

    // Get or create pathname trie for this hostname+port combination
    let pathnameTrie: TrieNode
    if (port !== undefined) {
      let existing = finalHostnameNode.portChildren.get(port)
      if (!existing) {
        existing = this.#createNode()
        finalHostnameNode.portChildren.set(port, existing)
      }
      pathnameTrie = existing
    } else {
      if (!finalHostnameNode.defaultPathnameTrie) {
        finalHostnameNode.defaultPathnameTrie = this.#createNode()
      }
      pathnameTrie = finalHostnameNode.defaultPathnameTrie
    }

    // Add pathname pattern to the trie
    if (pathnameTokens) {
      this.#buildPathTrie(
        pathnameTrie,
        pathnameTokens,
        pattern,
        userNode,
        searchConstraints,
        parsed,
      )
      this.#updateDepthUp(pathnameTrie)
    } else {
      this.#addPatternMatch(pathnameTrie, pattern, userNode, [], true, searchConstraints, parsed)
      this.#updateDepthUp(pathnameTrie)
    }
  }

  #reverseHostnameLabels(hostnameTokens: Token[]): Token[][] {
    // Group hostname tokens by separators, then reverse the order
    let labels = this.#groupTokensIntoSegments(hostnameTokens)
    return labels.reverse()
  }

  #traverseHostnameLabels(startNode: HostnameTrieNode, labels: Token[][]): HostnameTrieNode {
    let currentNode = startNode

    for (let label of labels) {
      if (label.length === 1 && label[0].type === 'text') {
        // Static label
        let labelText = label[0].value.toLowerCase()
        let child = currentNode.staticChildren[labelText]
        if (!child) {
          child = this.#createHostnameNode()
          currentNode.staticChildren[labelText] = child
          child.parent = currentNode
        }
        currentNode = child
      } else if (label.length === 1 && label[0].type === 'variable') {
        // Variable label
        if (!currentNode.variableChild) {
          let childNode = this.#createHostnameNode()
          childNode.parent = currentNode
          currentNode.variableChild = {
            paramName: label[0].name,
            node: childNode,
          }
        }
        currentNode = currentNode.variableChild.node
      } else if (label.length === 1 && label[0].type === 'wildcard') {
        // Wildcard label
        if (!currentNode.wildcardChild) {
          currentNode.wildcardChild = {
            paramName: label[0].name,
            node: this.#createHostnameNode(),
          }
          currentNode.wildcardChild.node.parent = currentNode
        }
        currentNode = currentNode.wildcardChild.node
      } else {
        // Complex hostname label, simplify and treat as variable
        if (!currentNode.variableChild) {
          currentNode.variableChild = {
            paramName: 'hostname_segment',
            node: this.#createHostnameNode(),
          }
          currentNode.variableChild.node.parent = currentNode
        }
        currentNode = currentNode.variableChild.node
      }
    }

    return currentNode
  }

  #buildPathTrie(
    node: TrieNode,
    tokens: Token[],
    pattern: RoutePattern,
    userNode: T,
    searchConstraints?: SearchConstraints,
    parsed?: ParseResult,
  ): void {
    this.#buildTokenPath(node, tokens, pattern, (finalNode) => {
      this.#addPatternMatch(finalNode, pattern, userNode, [], false, searchConstraints, parsed)
      this.#updateDepthUp(finalNode)
    })
  }

  #buildTokenPath(
    node: TrieNode,
    tokens: Token[],
    pattern: RoutePattern,
    onComplete: (node: TrieNode) => void,
  ): void {
    if (tokens.length === 0) {
      onComplete(node)
      return
    }

    // Check for inter-segment optional
    let optionalIdx = this.#findInterSegmentOptional(tokens)

    if (optionalIdx !== -1) {
      // Handle inter-segment optional with convergence
      let [before, opt, after] = [
        tokens.slice(0, optionalIdx),
        tokens[optionalIdx] as { type: 'optional'; tokens: Token[] },
        tokens.slice(optionalIdx + 1),
      ]

      let branchNode = before.length > 0 ? this.#walkTokens(node, before, pattern) : node
      let continuation = this.#createNode()
      continuation.parent = branchNode

      // Skip path
      branchNode.optionalEdges.push({ continuation })

      // Take path (routes to same continuation)
      if (opt.tokens.length > 0) {
        this.#buildTokenPath(branchNode, opt.tokens, pattern, (endNode) => {
          endNode.optionalEdges.push({ continuation })
        })
      }

      // Build suffix from shared continuation
      this.#buildTokenPath(continuation, after, pattern, onComplete)
      return
    }

    // Check for intra-segment optional and expand
    if (this.#hasIntraSegmentOptionals(tokens)) {
      for (let expanded of this.#expandIntraSegmentOptionals(tokens)) {
        let finalNode = this.#walkTokens(node, expanded, pattern)
        onComplete(finalNode)
      }
      return
    }

    // No optionals - simple walk
    let finalNode = this.#walkTokens(node, tokens, pattern)
    onComplete(finalNode)
  }

  #maxOptionalDepthInTokens(tokens: Token[]): number {
    let maxDepth = 0
    for (let token of tokens) {
      if (token.type === 'optional') {
        // Depth includes this optional + max depth of its children
        let childDepth = this.#maxOptionalDepthInTokens(token.tokens)
        maxDepth = Math.max(maxDepth, 1 + childDepth)
      }
    }
    return maxDepth
  }

  #walkTokens(node: TrieNode, tokens: Token[], pattern: RoutePattern): TrieNode {
    let current = node
    let segments = this.#groupTokensIntoSegments(tokens)

    for (let segment of segments) {
      current = this.#walkSegment(current, segment, pattern)
    }

    return current
  }

  #walkSegment(node: TrieNode, segment: Token[], pattern: RoutePattern): TrieNode {
    if (segment.length === 0) return node

    // Single-token segment
    if (segment.length === 1) {
      let token = segment[0]

      if (token.type === 'text') {
        let key = pattern.ignoreCase ? token.value.toLowerCase() : token.value
        let child = node.staticChildren[key]
        if (!child) {
          child = this.#createNode()
          node.staticChildren[key] = child
          child.parent = node
          if (pattern.ignoreCase) {
            node.hasIgnoreCasePatterns = true
            child.hasIgnoreCasePatterns = true
          }
        }
        return child
      }

      if (token.type === 'variable') {
        if (!node.variableChild) {
          node.variableChild = { ...this.#createNode(), paramName: token.name }
          node.variableChild.parent = node
        }
        return node.variableChild
      }

      if (token.type === 'wildcard') {
        if (!node.wildcardEdge) {
          let continuation = this.#createNode()
          continuation.parent = node
          node.wildcardEdge = { paramName: token.name, continuation }
        }
        return node.wildcardEdge.continuation
      }

      throw new Error(`Unexpected token type: ${token.type}`)
    }

    // Multi-token segment (shape)
    if (segment.length > 1) {
      let shapeKey = this.#getSimpleShapeKey(segment, pattern.ignoreCase)
      let shapeEntry = node.shapeChildren.get(shapeKey)
      if (!shapeEntry) {
        let child = this.#createNode()
        child.parent = node
        shapeEntry = { node: child, tokens: segment, ignoreCase: pattern.ignoreCase }
        node.shapeChildren.set(shapeKey, shapeEntry)
        if (pattern.ignoreCase) {
          node.hasIgnoreCasePatterns = true
          shapeEntry.node.hasIgnoreCasePatterns = true
        }
      }
      return shapeEntry.node
    }

    return node
  }

  #findInterSegmentOptional(tokens: Token[]): number {
    // Find the first optional that contains a path separator (spans segments)
    for (let i = 0; i < tokens.length; i++) {
      let token = tokens[i]
      if (token.type === 'optional') {
        // Check if this optional contains a path separator
        let hasPathSeparator = token.tokens.some(
          (t) => t.type === 'separator' && (tokens[i - 1]?.type !== 'separator' || i === 0),
        )
        if (hasPathSeparator) {
          return i
        }
      }
    }
    return -1
  }

  #hasIntraSegmentOptionals(tokens: Token[]): boolean {
    return tokens.some((t) => t.type === 'optional')
  }

  #expandIntraSegmentOptionals(tokens: Token[]): Token[][] {
    // Simple recursive expansion for intra-segment optionals
    let optionalIndex = tokens.findIndex((t) => t.type === 'optional')

    if (optionalIndex === -1) {
      return [tokens]
    }

    let beforeOptional = tokens.slice(0, optionalIndex)
    let optionalToken = tokens[optionalIndex] as { type: 'optional'; tokens: Token[] }
    let afterOptional = tokens.slice(optionalIndex + 1)

    let optionalExpansions = this.#expandIntraSegmentOptionals(optionalToken.tokens)
    let remainingExpansions = this.#expandIntraSegmentOptionals(afterOptional)

    let result: Token[][] = []

    // Skip optional
    for (let remaining of remainingExpansions) {
      result.push([...beforeOptional, ...remaining])
    }

    // Include optional
    for (let optionalExpansion of optionalExpansions) {
      for (let remaining of remainingExpansions) {
        result.push([...beforeOptional, ...optionalExpansion, ...remaining])
      }
    }

    return result
  }

  #groupTokensIntoSegments(tokens: Token[]): Token[][] {
    let segments: Token[][] = []
    let currentSegment: Token[] = []

    for (let token of tokens) {
      if (token.type === 'separator') {
        if (currentSegment.length > 0) {
          segments.push(currentSegment)
          currentSegment = []
        }
      } else {
        currentSegment.push(token)
      }
    }

    if (currentSegment.length > 0) {
      segments.push(currentSegment)
    }

    return segments
  }

  #getSimpleShapeKey(tokens: Token[], ignoreCase: boolean): string {
    return tokens
      .map((t) => {
        if (t.type === 'text') return `L:${ignoreCase ? t.value.toLowerCase() : t.value}`
        if (t.type === 'variable') return `V:${t.name}`
        if (t.type === 'wildcard') return `W:${t.name || ''}`
        return t.type
      })
      .join(',')
  }

  #addPatternMatch(
    node: TrieNode,
    pattern: RoutePattern,
    userNode: T,
    paramNames: string[],
    matchOrigin: boolean,
    searchConstraints?: SearchConstraints,
    parsed?: ParseResult,
  ): void {
    // Check if this pattern is already added to this node
    let existingPattern = node.patterns.find((p) => p.pattern.source === pattern.source)
    if (existingPattern) {
      return // Don't add duplicates
    }

    let specificity = this.#calculateSpecificity(parsed, searchConstraints)

    node.patterns.push({
      pattern,
      node: userNode,
      paramNames,
      matchOrigin,
      searchConstraints,
      specificity,
      ignoreCase: pattern.ignoreCase,
    })

    // Keep patterns sorted by specificity (highest first)
    node.patterns.sort((a, b) => b.specificity - a.specificity)

    this.#updateDepthUp(node)
  }

  #calculateSpecificity(
    parsed: ParseResult | undefined,
    searchConstraints?: SearchConstraints,
  ): number {
    let specificity = 0

    if (!parsed) {
      return specificity
    }

    // Origin patterns get higher base specificity
    if (parsed.protocol || parsed.hostname || parsed.port) {
      specificity += 10000
    }

    // Search constraints add specificity
    if (searchConstraints && searchConstraints.size > 0) {
      specificity += 1000
    }

    if (parsed.pathname) {
      for (let token of parsed.pathname) {
        if (token.type === 'text') {
          specificity += 100 // Static segments are most specific
        } else if (token.type === 'variable') {
          specificity += 10 // Variables are less specific
        } else if (token.type === 'wildcard') {
          specificity += 1 // Wildcards are least specific
        } else if (token.type === 'optional') {
          // Optionals reduce specificity slightly
          specificity -= 1
        }
      }
    }

    return specificity
  }

  #matchShape(
    shapeEntry: { node: TrieNode; tokens: Token[]; ignoreCase: boolean },
    segment: string,
  ): { params: Record<string, string>; specificity: number } | null {
    let normalizedSegment = shapeEntry.ignoreCase ? segment.toLowerCase() : segment
    let pos = 0
    let params: Record<string, string> = {}
    let spec = 0

    for (let i = 0; i < shapeEntry.tokens.length; i++) {
      let token = shapeEntry.tokens[i]
      if (token.type === 'text') {
        let lit = shapeEntry.ignoreCase ? token.value.toLowerCase() : token.value
        if (!normalizedSegment.startsWith(lit, pos)) return null
        pos += lit.length
        spec += 100
      } else if (token.type === 'variable') {
        let start = pos
        let nextLit = ''
        for (let j = i + 1; j < shapeEntry.tokens.length; j++) {
          let nextToken = shapeEntry.tokens[j]
          if (nextToken.type === 'text') {
            nextLit = shapeEntry.ignoreCase ? nextToken.value.toLowerCase() : nextToken.value
            break
          }
        }
        let end = nextLit ? normalizedSegment.indexOf(nextLit, pos) : normalizedSegment.length
        if (end === -1 && nextLit) return null
        let value = segment.slice(start, end !== -1 ? end : undefined)
        params[token.name] = value
        pos = end !== -1 ? end : pos
        spec += 10
      } else if (token.type === 'wildcard') {
        let value = segment.slice(pos)
        if (token.name) params[token.name] = value
        pos = segment.length
        spec += 1
      }
    }
    if (pos !== normalizedSegment.length) return null
    return { params, specificity: spec }
  }

  #findOriginMatches(
    url: URL,
    segments: string[],
    urlSearch: string | undefined,
    earlyExit: boolean,
  ): Array<{ match: PatternMatch<any>; state: MatchState }> {
    let results: Array<{ match: PatternMatch<any>; state: MatchState }> = []

    let protocol = url.protocol.slice(0, -1).toLowerCase() // Remove trailing ':'

    // Try specific protocol patterns
    let protocolNode = this.#originRoot.protocolChildren.get(protocol)
    if (protocolNode) {
      this.#matchHostnameAndPathname(protocolNode, url, segments, results, {}, urlSearch, earlyExit)
      if (earlyExit && results.length > 0) return results
    }

    // Try variable protocol patterns
    if (this.#originRoot.protocolVariableChild) {
      let protocolParams = { [this.#originRoot.protocolVariableChild.paramName]: protocol }
      this.#matchHostnameAndPathname(
        this.#originRoot.protocolVariableChild.node,
        url,
        segments,
        results,
        protocolParams,
        urlSearch,
        earlyExit,
      )
      if (earlyExit && results.length > 0) return results
    }

    // Try any-protocol patterns
    if (this.#originRoot.anyProtocolChild) {
      this.#matchHostnameAndPathname(
        this.#originRoot.anyProtocolChild,
        url,
        segments,
        results,
        {},
        urlSearch,
        earlyExit,
      )
      if (earlyExit && results.length > 0) return results
    }

    // Sort only for matchAll (when !earlyExit)
    if (!earlyExit) {
      results.sort(
        (a, b) => this.#finalScore(b.match, b.state) - this.#finalScore(a.match, a.state),
      )
    }

    return results
  }

  #findPathnameMatches(
    segments: string[],
    urlSearch: string | undefined,
    earlyExit: boolean,
  ): Array<{ match: PatternMatch<any>; state: MatchState }> {
    let initialState: MatchState = {
      segments,
      segmentIndex: 0,
      params: {},
      specificity: 0,
      nodeId: this.#pathnameOnlyRoot.id,
    }

    return this.#bestFirstTraversal(this.#pathnameOnlyRoot, initialState, earlyExit, urlSearch)
  }

  #matchHostnameAndPathname(
    protocolNode: ProtocolNode,
    url: URL,
    segments: string[],
    results: Array<{ match: PatternMatch<any>; state: MatchState }>,
    protocolParams: Record<string, string>,
    urlSearch: string | undefined,
    earlyExit: boolean,
  ): void {
    // Parse hostname into reversed labels
    let hostname = url.hostname.toLowerCase()
    let hostnameLabels = hostname.split('.').reverse()

    // Find matching hostname nodes
    let hostnameMatches = this.#matchHostnameLabels(protocolNode.hostnameRoot, hostnameLabels, 0, {
      ...protocolParams,
    })

    for (let { node: hostnameNode, params: hostnameParams } of hostnameMatches) {
      // Try port-specific pathname tries
      if (url.port) {
        let portTrie = hostnameNode.portChildren.get(url.port)
        if (portTrie) {
          this.#matchPathnameInTrie(
            portTrie,
            segments,
            hostnameParams,
            results,
            urlSearch,
            earlyExit,
          )
        }
      }

      // Try default pathname trie (matches any port or no port)
      if (hostnameNode.defaultPathnameTrie) {
        this.#matchPathnameInTrie(
          hostnameNode.defaultPathnameTrie,
          segments,
          hostnameParams,
          results,
          urlSearch,
          earlyExit,
        )
      }
    }
  }

  #matchHostnameLabels(
    node: HostnameTrieNode,
    labels: string[],
    labelIndex: number,
    params: Record<string, string>,
  ): Array<{ node: HostnameTrieNode; params: Record<string, string> }> {
    let results: Array<{ node: HostnameTrieNode; params: Record<string, string> }> = []

    // If we've consumed all labels, this is a potential match
    if (labelIndex >= labels.length) {
      results.push({ node, params })
      return results
    }

    let currentLabel = labels[labelIndex]

    // Try static children
    let staticChild = node.staticChildren[currentLabel]
    if (staticChild) {
      results.push(...this.#matchHostnameLabels(staticChild, labels, labelIndex + 1, params))
    }

    // Try variable child
    if (node.variableChild) {
      let newParams = { ...params }
      newParams[node.variableChild.paramName] = currentLabel
      results.push(
        ...this.#matchHostnameLabels(node.variableChild.node, labels, labelIndex + 1, newParams),
      )
    }

    // Try wildcard child (consumes remaining labels)
    if (node.wildcardChild) {
      let remainingLabels = labels.slice(labelIndex).reverse().join('.')
      let newParams = { ...params }
      if (node.wildcardChild.paramName) {
        newParams[node.wildcardChild.paramName] = remainingLabels
      }
      results.push({ node: node.wildcardChild.node, params: newParams })
    }

    return results
  }

  #matchPathnameInTrie(
    pathnameTrie: TrieNode,
    segments: string[],
    hostnameParams: Record<string, string>,
    results: Array<{ match: PatternMatch<any>; state: MatchState }>,
    urlSearch: string | undefined,
    earlyExit: boolean,
  ): void {
    let initialState: MatchState = {
      segments,
      segmentIndex: 0,
      params: { ...hostnameParams },
      specificity: 1000, // Origin patterns get higher base specificity
      nodeId: pathnameTrie.id,
    }

    let traversalResults = this.#bestFirstTraversal(
      pathnameTrie,
      initialState,
      earlyExit,
      urlSearch,
    )
    results.push(...traversalResults)
  }

  #matchSearch(search: string, constraints: SearchConstraints): boolean {
    let { namesWithoutAssignment, namesWithAssignment, valuesByKey } = parseSearch(search)

    for (let [key, constraint] of constraints) {
      let hasAssigned = namesWithAssignment.has(key)
      let hasBare = namesWithoutAssignment.has(key)
      let values = valuesByKey.get(key)

      if (constraint.requiredValues && constraint.requiredValues.size > 0) {
        if (!values) return false
        for (let value of constraint.requiredValues) {
          if (!values.has(value)) return false
        }
        continue
      }

      if (constraint.requireAssignment) {
        if (!hasAssigned) return false
        continue
      }

      if (!(hasAssigned || hasBare)) return false
    }

    return true
  }

  /**
   * Best-first traversal with priority queue
   * Returns results sorted by combined specificity (highest first)
   * If earlyExit is true, returns immediately after finding first valid match
   */
  #bestFirstTraversal(
    startNode: TrieNode,
    startState: MatchState,
    earlyExit: boolean,
    urlSearch?: string,
  ): Array<{ match: PatternMatch<any>; state: MatchState }> {
    let results: Array<{ match: PatternMatch<any>; state: MatchState }> = []
    let bestSpec = earlyExit ? -Infinity : 0 // Track best for pruning

    // Stack for DFS: high priority first
    let stack: TraversalState[] = []
    let initial: TraversalState = {
      node: startNode,
      state: startState,
      priority: this.#calculatePriority(startNode, startState),
    }
    stack.push(initial)

    let visited = new Set<number | string>()
    let statesExplored = 0

    while (stack.length > 0 && statesExplored < this.#maxTraversalStates) {
      let current = stack.pop()!
      statesExplored++

      let { node, state } = current

      // Optimize dedup key: use numeric key for common case (no wildcard)
      let dedupKey: number | string
      if (state.wildcardSpan) {
        // Wildcard case: use string key
        dedupKey = `${state.nodeId ?? node.id}:${state.segmentIndex}:${state.wildcardSpan}`
      } else {
        // Common case: use numeric key (nodeId in high 16 bits, segmentIndex in low 16 bits)
        dedupKey = ((state.nodeId ?? node.id ?? 0) << 16) | state.segmentIndex
      }

      if (visited.has(dedupKey)) continue
      visited.add(dedupKey)

      // Prune if low priority and earlyExit
      if (earlyExit && state.specificity < bestSpec - 100) continue // Threshold for low spec

      if (state.segmentIndex === state.segments.length) {
        // Fast path: single pattern with no search constraints
        if (node.patterns.length === 1 && !node.patterns[0].searchConstraints) {
          let pattern = node.patterns[0]
          let score = this.#finalScore(pattern, state)
          results.push({ match: pattern, state: { ...state } })
          if (earlyExit) {
            return results.slice(0, 1)
          }
        } else {
          // General case: multiple patterns or search constraints
          for (let pattern of node.patterns) {
            if (pattern.searchConstraints) {
              let searchToMatch = urlSearch ?? ''
              if (!this.#matchSearch(searchToMatch, pattern.searchConstraints)) continue
            }

            let score = this.#finalScore(pattern, state)
            results.push({ match: pattern, state: { ...state } })
            if (earlyExit) {
              bestSpec = Math.max(bestSpec, score)
              // Sort results if multiple, but early exit after first batch
              if (results.length > 1)
                results.sort(
                  (a, b) => this.#finalScore(b.match, b.state) - this.#finalScore(a.match, a.state),
                )
              return results.slice(0, 1) // Only best
            }
          }
        }
      }

      // Optional edges
      let optionalStates: TraversalState[] = []
      for (let optionalEdge of node.optionalEdges) {
        this.#expandOptionalStates(optionalEdge, node, state, optionalStates, earlyExit, bestSpec)
      }
      // Prune low priority
      optionalStates = optionalStates.filter((s) => !earlyExit || s.priority >= bestSpec - 50)
      optionalStates.sort((a, b) => b.priority - a.priority)
      for (let i = optionalStates.length - 1; i >= 0; i--) {
        stack.push(optionalStates[i])
      }

      if (state.segmentIndex >= state.segments.length) continue

      let childStates: TraversalState[] = []
      this.#expandTraversalState(node, state, childStates, earlyExit, bestSpec)
      // Prune low
      childStates = childStates.filter((s) => !earlyExit || s.priority >= bestSpec - 50)
      childStates.sort((a, b) => b.priority - a.priority)
      for (let i = childStates.length - 1; i >= 0; i--) {
        stack.push(childStates[i])
      }
    }

    results.sort((a, b) => this.#finalScore(b.match, b.state) - this.#finalScore(a.match, a.state))
    return results
  }

  /**
   * Helper to create MatchState without object spreading (faster allocation)
   */
  #createMatchState(
    baseState: MatchState,
    segmentIndex: number,
    params: Record<string, string>,
    specificity: number,
    nodeId: number | undefined,
    wildcardSpan?: string,
  ): MatchState {
    return {
      segments: baseState.segments,
      segmentIndex,
      params,
      specificity,
      nodeId,
      wildcardSpan,
    }
  }

  /**
   * JIT-compile a fast prefix matching function for static segments
   * Inspired by find-my-way's optimization technique
   */
  #compilePrefixMatcher(prefix: string, ignoreCase: boolean): (segment: string) => boolean {
    if (prefix.length === 1) {
      // Single character - ultra fast path
      let charCode = ignoreCase ? prefix.toLowerCase().charCodeAt(0) : prefix.charCodeAt(0)
      if (ignoreCase) {
        return new Function(
          'segment',
          `return segment.length === 1 && (segment.charCodeAt(0) === ${charCode} || segment.charCodeAt(0) === ${prefix.toUpperCase().charCodeAt(0)})`,
        ) as (segment: string) => boolean
      }
      return new Function(
        'segment',
        `return segment.length === 1 && segment.charCodeAt(0) === ${charCode}`,
      ) as (segment: string) => boolean
    }

    // Multi-character - generate inline character code checks
    let checks: string[] = []
    let targetPrefix = ignoreCase ? prefix.toLowerCase() : prefix

    for (let i = 0; i < targetPrefix.length; i++) {
      let charCode = targetPrefix.charCodeAt(i)
      if (ignoreCase && prefix.charCodeAt(i) >= 65 && prefix.charCodeAt(i) <= 90) {
        // Uppercase letter - check both cases
        let upperCode = prefix.toUpperCase().charCodeAt(i)
        let lowerCode = prefix.toLowerCase().charCodeAt(i)
        checks.push(
          `(segment.charCodeAt(${i}) === ${upperCode} || segment.charCodeAt(${i}) === ${lowerCode})`,
        )
      } else {
        checks.push(`segment.charCodeAt(${i}) === ${charCode}`)
      }
    }

    // Generate optimized function
    let fnBody = `return segment.length === ${targetPrefix.length} && ${checks.join(' && ')}`
    return new Function('segment', fnBody) as (segment: string) => boolean
  }

  #calculatePriority(node: TrieNode, state: MatchState): number {
    let currentSpecificity = state.specificity
    let remainingSegments = state.segments.length - state.segmentIndex

    let estimatedRemaining = 0
    if (node.minDepthToTerminal !== undefined && remainingSegments > 0) {
      // Better: assume mix of static/var: avg 50 per segment
      estimatedRemaining = Math.min(remainingSegments, node.minDepthToTerminal) * 50
    } else {
      estimatedRemaining = remainingSegments * 50 // Default avg
    }

    return currentSpecificity + estimatedRemaining
  }

  #getStaticChild(node: TrieNode, segment: string): TrieNode | undefined {
    // Fast path: exact lookup
    let child = node.staticChildren[segment]
    if (child) return child

    // Case-insensitive fallback
    if (node.hasIgnoreCasePatterns) {
      child = node.staticChildren[segment.toLowerCase()]
    }

    return child
  }

  #expandTraversalState(
    node: TrieNode,
    state: MatchState,
    states: TraversalState[], // Collect
    earlyExit: boolean,
    bestSpec: number,
  ): void {
    let currentSegment = state.segments[state.segmentIndex]

    // Try static children first (highest priority)
    let staticChild = this.#getStaticChild(node, currentSegment)

    if (staticChild) {
      let newState = this.#createMatchState(
        state,
        state.segmentIndex + 1,
        state.params,
        state.specificity + 100,
        staticChild.id,
      )
      let ts: TraversalState = {
        node: staticChild,
        state: newState,
        priority: this.#calculatePriority(staticChild, newState),
      }
      if (!earlyExit || ts.priority >= bestSpec - 50) {
        states.push(ts)
      }
    }

    // Try shape children
    for (let [shapeKey, shapeEntry] of node.shapeChildren) {
      let matchResult = this.#matchShape(shapeEntry, currentSegment)
      if (matchResult) {
        let newState = this.#createMatchState(
          state,
          state.segmentIndex + 1,
          { ...state.params, ...matchResult.params },
          state.specificity + matchResult.specificity,
          shapeEntry.node.id,
        )
        let ts: TraversalState = {
          node: shapeEntry.node,
          state: newState,
          priority: this.#calculatePriority(shapeEntry.node, newState),
        }
        if (!earlyExit || ts.priority >= bestSpec - 50) {
          states.push(ts)
        }
      }
    }

    // Try variable child
    if (node.variableChild) {
      let newParams = { ...state.params }
      newParams[node.variableChild.paramName] = currentSegment
      let newState = this.#createMatchState(
        state,
        state.segmentIndex + 1,
        newParams,
        state.specificity + 10,
        node.variableChild.id,
      )
      let ts: TraversalState = {
        node: node.variableChild,
        state: newState,
        priority: this.#calculatePriority(node.variableChild, newState),
      }
      if (!earlyExit || ts.priority >= bestSpec - 50) {
        states.push(ts)
      }
    }

    // Try wildcard edge
    if (node.wildcardEdge) {
      this.#expandWildcardStates(node.wildcardEdge, state, states, earlyExit, bestSpec)
    }
  }

  #expandOptionalStates(
    optionalEdge: OptionalEdge,
    currentNode: TrieNode,
    state: MatchState,
    states: TraversalState[], // Now collects
    earlyExit: boolean,
    bestSpec: number,
  ): void {
    // Option 1: Skip the optional, go directly to continuation
    let skipState: MatchState = {
      ...state,
      nodeId: optionalEdge.continuation.id,
      // Lower priority for skipping (less specific)
      specificity: state.specificity - 1,
    }
    let skipTraversal: TraversalState = {
      node: optionalEdge.continuation,
      state: skipState,
      priority: this.#calculatePriority(optionalEdge.continuation, skipState),
    }
    if (!earlyExit || skipTraversal.priority >= bestSpec - 50) {
      states.push(skipTraversal)
    }
  }

  #expandWildcardStates(
    wildcardEdge: WildcardEdge,
    state: MatchState,
    states: TraversalState[],
    earlyExit: boolean,
    bestSpec: number,
  ): void {
    let remaining = state.segments.length - state.segmentIndex
    let continuation = wildcardEdge.continuation
    let minConsume = 0
    let maxConsume = remaining

    if (continuation.minDepthToTerminal !== undefined) {
      maxConsume = Math.min(maxConsume, remaining - continuation.minDepthToTerminal)
    }
    if (continuation.maxDepthToTerminal !== undefined) {
      minConsume = Math.max(minConsume, remaining - continuation.maxDepthToTerminal)
    }

    if (minConsume > maxConsume) return

    // Greedy-first: try larger consumption counts first
    for (let consumeCount = maxConsume; consumeCount >= minConsume; consumeCount--) {
      let consumedSegments = state.segments.slice(
        state.segmentIndex,
        state.segmentIndex + consumeCount,
      )
      let newParams = { ...state.params }
      if (wildcardEdge.paramName) {
        newParams[wildcardEdge.paramName] = consumedSegments.join('/')
      }
      let newState = this.#createMatchState(
        state,
        state.segmentIndex + consumeCount,
        newParams,
        state.specificity + 1,
        continuation.id,
        `${state.segmentIndex}-${state.segmentIndex + consumeCount}`,
      )
      let ts: TraversalState = {
        node: continuation,
        state: newState,
        priority: this.#calculatePriority(continuation, newState),
      }
      if (!earlyExit || ts.priority >= bestSpec - 50) {
        states.push(ts)
      }
    }
  }

  #tryOriginMatch(parsedUrl: ParsedURL, segments: string[], urlObj: URL): MatchResult<T> | null {
    let results = this.#findOriginMatches(urlObj, segments, parsedUrl.search, true)
    if (results.length > 0) {
      let best = results[0]
      return { data: best.match.node, params: best.state.params, url: urlObj }
    }
    return null
  }

  #tryPathnameMatch(
    pathnameTrie: TrieNode,
    segments: string[],
    baseParams: Record<string, string>,
    search: string,
    urlObj: URL,
  ): MatchResult<T> | null {
    let initialState: MatchState = {
      segments,
      segmentIndex: 0,
      params: { ...baseParams },
      specificity: 1000,
      nodeId: pathnameTrie.id,
    }
    let results = this.#bestFirstTraversal(pathnameTrie, initialState, true, search)
    if (results.length > 0) {
      let best = results[0]
      return { data: best.match.node, params: best.state.params, url: urlObj }
    }
    return null
  }

  #tryStaticPathMatch(segments: string[], search: string, url: URL): MatchResult<T> | null {
    let results = this.#walkStaticPath(segments, search, false)
    if (results.length > 0) {
      let best = results[0]
      return { data: best.match.node, params: {}, url }
    }
    return null
  }

  #tryStaticPathAll(
    segments: string[],
    search: string,
    url: URL,
  ): { match: PatternMatch<any>; state: MatchState }[] {
    return this.#walkStaticPath(segments, search, true)
  }

  #walkStaticPath(
    segments: string[],
    search: string,
    collectAll: boolean,
  ): { match: PatternMatch<any>; state: MatchState }[] {
    let current = this.#pathnameOnlyRoot
    let pathNodes: TrieNode[] = collectAll ? [current] : []

    // Fast path: walk static children only
    for (let i = 0; i < segments.length; i++) {
      let seg = segments[i]
      let child = this.#getStaticChild(current, seg)
      if (!child) return []
      current = child
      if (collectAll) pathNodes.push(current)
    }

    let matches: { match: PatternMatch<any>; state: MatchState }[] = []
    let nodesToCheck = collectAll ? pathNodes : [current]

    for (let node of nodesToCheck) {
      // Fast path: single pattern with no constraints
      if (node.patterns.length === 1 && !node.patterns[0].searchConstraints) {
        let pattern = node.patterns[0]
        let state: MatchState = {
          segments,
          segmentIndex: segments.length,
          params: {},
          specificity: pattern.specificity,
          nodeId: node.id,
        }
        matches.push({ match: pattern, state })
        if (!collectAll) return matches
        continue
      }

      // General case: check all patterns
      for (let pattern of node.patterns) {
        if (pattern.searchConstraints && !this.#matchSearch(search, pattern.searchConstraints))
          continue
        let state: MatchState = {
          segments,
          segmentIndex: segments.length,
          params: {},
          specificity: pattern.specificity,
          nodeId: node.id,
        }
        matches.push({ match: pattern, state })
        if (!collectAll) return matches
      }
    }

    return matches.sort((a, b) => b.match.specificity - a.match.specificity)
  }
}
