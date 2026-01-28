/**
 * Module graph for tracking import relationships and caching transforms.
 *
 * The graph is built incrementally as files are served during development.
 * It tracks:
 * - Import relationships (who imports whom) for HMR propagation
 * - Transform caching (esbuild output + source maps)
 * - File change timestamps for cache busting
 */

export interface ModuleNode {
  /** URL that identifies this module (e.g., '/app/entry.tsx' or '/__@workspace/node_modules/pkg/index.js') */
  url: string
  /** Absolute file path on disk */
  file: string
  /** Modules that import this module (for cache invalidation and HMR) */
  importers: Set<ModuleNode>
  /** Modules that this module imports (for cache invalidation and HMR) */
  importedModules: Set<ModuleNode>
  /** Cached transform result (code + source map) */
  transformResult?: { code: string; map: string | null }
  /** Last modified time in milliseconds (for cache invalidation) */
  lastModified?: number
  /** Whether this module is a component (HMR boundary) */
  isComponent?: boolean
  /** Timestamp from file change event (for browser cache busting via query params) */
  changeTimestamp?: number
}

/**
 * Module graph for tracking import relationships and caching transforms.
 * Built incrementally as files are served.
 */
export interface ModuleGraph {
  /** Map from URL to module node */
  urlToModule: Map<string, ModuleNode>
  /** Map from absolute file path to module node */
  fileToModule: Map<string, ModuleNode>
}

/**
 * Creates a new empty module graph.
 *
 * @returns A new module graph with empty URL and file indexes
 */
export function createModuleGraph(): ModuleGraph {
  return {
    urlToModule: new Map(),
    fileToModule: new Map(),
  }
}

/**
 * Gets or creates a module node in the graph.
 * If a node exists by URL but has an empty file path, updates it with the provided file path.
 *
 * @param graph The module graph to add the node to
 * @param url The URL that identifies this module
 * @param file The absolute file path on disk (can be empty for placeholder nodes)
 * @returns The module node (existing or newly created)
 */
export function ensureModuleNode(graph: ModuleGraph, url: string, file: string): ModuleNode {
  // Check by URL first (primary key)
  let existing = graph.urlToModule.get(url)
  if (existing) {
    // If this is a placeholder node (empty file), update with real file path
    if (!existing.file && file) {
      existing.file = file
      graph.fileToModule.set(file, existing)
    }
    return existing
  }

  // Check by file path (secondary key) - only if file is provided
  if (file) {
    existing = graph.fileToModule.get(file)
    if (existing) {
      // Update URL mapping if file is accessed via different URL
      graph.urlToModule.set(url, existing)
      return existing
    }
  }

  // Create new node
  let node: ModuleNode = {
    url,
    file,
    importers: new Set(),
    importedModules: new Set(),
  }

  graph.urlToModule.set(url, node)
  if (file) {
    graph.fileToModule.set(file, node)
  }

  return node
}

/**
 * Gets a module node by its URL.
 *
 * @param graph The module graph to search
 * @param url The URL to look up
 * @returns The module node, or undefined if not found
 */
export function getModuleByUrl(graph: ModuleGraph, url: string): ModuleNode | undefined {
  return graph.urlToModule.get(url)
}

/**
 * Gets a module node by its file path.
 *
 * @param graph The module graph to search
 * @param file The absolute file path to look up
 * @returns The module node, or undefined if not found
 */
export function getModuleByFile(graph: ModuleGraph, file: string): ModuleNode | undefined {
  return graph.fileToModule.get(file)
}

/**
 * Invalidates a module's transform cache and propagates to importers.
 * This is recursive: when a module is invalidated, all modules that import it are also invalidated.
 *
 * @param node The module node to invalidate
 * @param visited Set of already-visited nodes (for preventing infinite loops in circular dependencies)
 */
export function invalidateModule(node: ModuleNode, visited = new Set<ModuleNode>()): void {
  // Prevent infinite loops from circular dependencies
  if (visited.has(node)) {
    return
  }
  visited.add(node)

  // Clear this module's cache
  node.transformResult = undefined
  node.lastModified = undefined

  // Propagate to importers
  for (let importer of node.importers) {
    invalidateModule(importer, visited)
  }
}
