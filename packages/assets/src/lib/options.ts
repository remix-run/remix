import type * as esbuild from 'esbuild'

/**
 * Explicit list of esbuild options supported in dev mode.
 *
 * This is the single source of truth for both the TypeScript type and runtime filtering.
 * Options not listed here are silently ignored to prevent build-specific options
 * (minify, splitting, outdir, etc.) from affecting dev behavior.
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
  // Extensibility
  'plugins',
  'loader',
  // Source maps
  'sourcemap', // false stays false, other values → 'inline' in dev
  'sourceRoot',
  'sourcesContent',
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
