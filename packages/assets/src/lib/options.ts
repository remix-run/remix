import type * as esbuild from 'esbuild'
import type { FilesConfig } from './files.ts'

/**
 * Explicit list of esbuild options supported in dev mode.
 *
 * This is the single source of truth for both the TypeScript type and runtime filtering.
 * Options not listed here are silently ignored. Build-only options (minify, etc.)
 * are filtered out in dev so they don't affect dev behavior.
 */
export const SUPPORTED_ESBUILD_OPTIONS = [
  // Entry points and target
  'entryPoints', // Ignored in dev (no restrictions), used as-is in prod
  'target', // Browser compatibility
  // JSX configuration
  'jsx',
  'jsxDev',
  'jsxFactory',
  'jsxFragment',
  'jsxImportSource',
  'jsxSideEffects',
  // TypeScript configuration
  'tsconfig',
  'tsconfigRaw',
  // Module resolution
  'conditions',
  'mainFields',
  'alias',
  'resolveExtensions',
  'nodePaths',
  'platform',
  'packages',
  'external', // Imports to skip rewriting (for import maps, CDNs)
  // Transforms and code generation
  'define',
  'pure',
  'supported',
  'keepNames',
  'drop',
  'charset',
  // Minify (prod only; ignored in dev)
  'minify',
  'minifyWhitespace',
  'minifyIdentifiers',
  'minifySyntax',
  // Legal comments, banner, footer (prod only; ignored in dev)
  'legalComments',
  'banner',
  'footer',
  // Optimization / output (prod only; ignored in dev)
  'ignoreAnnotations',
  'dropLabels',
  'lineLimit',
  // Extensibility
  'plugins',
  'loader',
  'inject', // prod only; inlined into importers, not emitted as separate files
  // Source maps: prod = full esbuild range; dev = on/off only (sourceRoot/sourcesContent ignored in dev)
  'sourcemap',
  'sourceRoot', // prod only; ignored in dev
  'sourcesContent', // prod only; ignored in dev
  // Logging
  'logLevel',
  'logLimit',
  'logOverride',
  'color',
] as const satisfies ReadonlyArray<keyof esbuild.BuildOptions>

/**
 * Supported esbuild options for dev/prod config sharing.
 */
export type DevAssetsEsbuildConfig = Pick<
  esbuild.BuildOptions,
  (typeof SUPPORTED_ESBUILD_OPTIONS)[number]
>

/**
 * Options for createDevAssetsHandler.
 */
export interface CreateDevAssetsHandlerOptions {
  /** Project root. Default: process.cwd(). Use "." for cwd. */
  root?: string
  allow: string[]
  deny?: string[]
  /** Workspace root for /__@workspace/ URLs. When set, workspace allow/deny default to top-level allow/deny. */
  workspaceRoot?: string
  /** Allow patterns for workspace paths. Defaults to allow when workspaceRoot is set. */
  workspaceAllow?: string[]
  /** Deny patterns for workspace paths. Defaults to deny when workspaceRoot is set. */
  workspaceDeny?: string[]
  /** Enable source maps (inline). Default: true. */
  sourcemap?: boolean
  /** Import specifiers to leave unchanged (e.g. CDN URLs, bare specifiers for import maps). */
  external?: string | string[]
  /** File transformation rules used by assets.get(path, variant?) in development. */
  files?: FilesConfig
  /**
   * Persistent cache location for transformed file variants in development.
   * Set to false to disable filesystem caching for transformed files.
   * Default: './.assets/files-cache'
   */
  filesCache?: string | false
}

/**
 * Options for the programmatic build API.
 * No allow/deny—build is graph-driven from entryPoints.
 */
export interface BuildOptions {
  /** Script entry paths relative to root (e.g. ['app/entry.tsx']) */
  scripts?: string[]
  /** @deprecated Use scripts. Entry paths relative to root (e.g. ['app/entry.tsx']) */
  entryPoints?: string[]
  /** Project root. Default: process.cwd(). Use "." for cwd. */
  root?: string
  /** Output directory (e.g. './build') */
  outDir: string
  /** Empty outDir before writing. Default: true when outDir is within root, false otherwise. Set explicitly to preserve or clear. */
  emptyOutDir?: boolean
  /** Minify output. Default: false. */
  minify?: boolean
  /** Emit source maps: 'inline' (embed in output) or 'external' (.map files). Omit for no source maps. */
  sourcemap?: BuildSourcemapMode
  /** Include sources content in source maps. Default: true. */
  sourcesContent?: boolean
  /** Source root URL for emitted source maps (prod only). */
  sourceRoot?: string
  /** Import specifiers to leave unchanged (e.g. CDN URLs, bare specifiers for import maps). */
  external?: string | string[]
  /**
   * Output path template. Placeholders: [dir] (path dir of module), [name] (base name), [hash] (content hash including module path so same name+content in different dirs get different hashes).
   * Extension .js is always appended. Default: '[name]-[hash]'.
   */
  fileNames?: string
  /** Workspace root for /__@workspace/ output (optional). No allow/deny—build is graph-driven. */
  workspaceRoot?: string
  /** Path to emit manifest (AssetManifest) or false to skip (default: false) */
  manifest?: string | false
  /** File transformation rules for non-JS assets. */
  files?: FilesConfig
}

/** Source map mode supported by build (and passed to transform). */
export type BuildSourcemapMode = 'inline' | 'external'

/**
 * Internal config built from public options and passed to transform.
 * Only includes options we explicitly support; do not pass through to esbuild blindly.
 * @internal
 */
export type InternalTransformConfig = {
  minify?: boolean
  sourcemap?: BuildSourcemapMode
  sourcesContent?: boolean
  sourceRoot?: string
}
