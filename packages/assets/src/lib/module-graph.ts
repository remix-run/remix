/**
 * Module graph for transform caching.
 *
 * Built incrementally as files are served. Maps URL/file to nodes that hold
 * cached transform result and last-modified time for cache invalidation.
 */

export interface ModuleNode {
  /** URL that identifies this module (e.g., '/__@assets/app/entry.tsx' or '/__@assets/__@workspace/node_modules/pkg/index.js') */
  url: string
  /** Absolute file path on disk */
  file: string
  /** Cached transform result (code + source map + hash for ETag) */
  transformResult?: { code: string; map: string | null; hash: string }
  /** Last modified time in milliseconds (for cache invalidation) */
  lastModified?: number
}

/**
 * Module graph for transform caching. Built incrementally as files are served.
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
  let node: ModuleNode = { url, file }

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
