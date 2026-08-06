/**
 * Synchronous module customization hooks used by the asset server's script pipeline.
 *
 * These hooks follow Node's `registerHooks()` chaining contract, with a few asset-pipeline-specific
 * constraints: only ES modules and `file:` resolutions are compiled, import attributes are not
 * supported, and load hooks receive JavaScript after the asset server's TypeScript/JavaScript
 * transform. Each hook must delegate to its `next*` callback or return `shortCircuit: true`.
 */
export interface ModuleHooks {
  /** Post-processes compiled JavaScript before HMR analysis and minification. */
  load?: ModuleLoadHook
  /** Resolves an import specifier while the asset server builds the module graph. */
  resolve?: ModuleResolveHook
}

/**
 * Resolves an import specifier or delegates it to the next configured resolver.
 *
 * @param specifier Import specifier as it appears in the compiled module.
 * @param context Conditions, attributes, and importing module URL for this resolution.
 * @param nextResolve Next hook in the chain, ending with the asset server's default resolver.
 * @returns A Node-compatible module resolution result.
 */
export type ModuleResolveHook = (
  specifier: string,
  context: ModuleResolveContext,
  nextResolve: ModuleResolveHookNext,
) => ModuleResolveResult

/**
 * Continues resolution through the remaining module-hook chain.
 *
 * Omitted context fields retain their current values.
 *
 * @param specifier Import specifier to pass to the remaining hooks.
 * @param context Context fields to override for the remainder of this resolution.
 * @returns The resolution produced by the remaining hooks or default resolver.
 */
export type ModuleResolveHookNext = (
  specifier: string,
  context?: Partial<ModuleResolveContext>,
) => ModuleResolveResult

/** State passed through a module `resolve` hook chain. */
export interface ModuleResolveContext {
  /** Package export conditions used by the asset server, including `browser`, `import`, and `module-sync`. */
  conditions: string[]
  /** Import attributes supplied by the previous hook. Authored import attributes are unsupported. */
  importAttributes: Record<string, string | undefined>
  /** `file:` URL of the module containing the import, when one is available. */
  parentURL: string | undefined
}

/** Resolution returned by a module `resolve` hook. */
export interface ModuleResolveResult {
  /** Module format passed to load hooks. Only `'module'` is supported for compiled files. */
  format?: string | null
  /** Import attributes forwarded to later module processing. Authored attributes are unsupported. */
  importAttributes?: Record<string, string | undefined>
  /** Whether this result intentionally ends the hook chain without calling `nextResolve`. */
  shortCircuit?: boolean
  /** Resolved module URL. Only `file:` URLs are compiled; other URLs remain external. */
  url: string
}

/**
 * Rewrites compiled module source or delegates it to the next configured loader.
 *
 * @param url Resolved `file:` URL for the module being compiled.
 * @param context Format, conditions, attributes, and public asset URL for this load.
 * @param nextLoad Next hook in the chain, ending with the asset server's compiled JavaScript.
 * @returns A Node-compatible load result containing ES module source.
 */
export type ModuleLoadHook = (
  url: string,
  context: ModuleLoadContext,
  nextLoad: ModuleLoadHookNext,
) => ModuleLoadResult

/**
 * Continues loading through the remaining module-hook chain.
 *
 * Omitted context fields retain their current values.
 *
 * @param url Module URL to pass to the remaining hooks.
 * @param context Context fields to override for the remainder of this load.
 * @returns The source produced by the remaining hooks or the asset compiler.
 */
export type ModuleLoadHookNext = (
  url: string,
  context?: Partial<ModuleLoadContext>,
) => ModuleLoadResult

/** State passed through a module `load` hook chain. */
export interface ModuleLoadContext {
  /** Package export conditions used while compiling this module. */
  conditions: string[]
  /** Current module format. Asset-server load hooks must ultimately return `'module'`. */
  format: string | null | undefined
  /** Import attributes supplied by the previous hook. Authored import attributes are unsupported. */
  importAttributes: Record<string, string | undefined>
  /**
   * Stable public URL path used to request this module from the asset server.
   *
   * Unlike Node's standard load context, this field is provided so transforms can use the browser
   * module identity rather than its private filesystem URL.
   */
  moduleUrl?: string
}

/** Source returned by a module `load` hook. */
export interface ModuleLoadResult {
  /** Loaded module format. Must be `'module'` for asset-server scripts. */
  format: string | null | undefined
  /** Whether this result intentionally ends the hook chain without calling `nextLoad`. */
  shortCircuit?: boolean
  /** Compiled JavaScript source, optionally rewritten by the hook. */
  source?: string | ArrayBuffer | NodeJS.TypedArray
}
