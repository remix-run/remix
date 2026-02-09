import type * as esbuild from 'esbuild'

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
 * Options for workspace access via `/__@workspace/` URLs.
 */
export interface DevAssetsWorkspaceOptions {
  root: string
  allow: string[]
  deny?: string[]
}

/**
 * Options for createDevAssetsHandler.
 */
export interface CreateDevAssetsHandlerOptions {
  root?: string
  allow: string[]
  deny?: string[]
  workspace?: DevAssetsWorkspaceOptions
  esbuildConfig?: DevAssetsEsbuildConfig
}

/**
 * Options for the programmatic build API.
 * No allow/deny—build is graph-driven from entryPoints.
 */
export interface BuildOptions {
  /** Entry paths relative to root (e.g. ['app/entry.tsx']) */
  entryPoints: string[]
  /** Project root (default: process.cwd()) */
  root?: string
  /** Output directory (e.g. './build') */
  outDir: string
  /** Same supported options as dev (target, jsx, plugins, etc.) */
  esbuildConfig?: DevAssetsEsbuildConfig
  /**
   * Output path template. Placeholders: [dir] (path dir of module), [name] (base name), [hash] (content hash).
   * Extension .js is always appended. Default: '[name]-[hash]'.
   */
  fileNames?: string
  /** Workspace root for /__@workspace/ output (optional). No allow/deny—build is graph-driven. */
  workspace?: { root: string }
  /** Path to emit manifest (AssetManifest) or false to skip (default: false) */
  manifest?: string | false
}
