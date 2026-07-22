/** Script syntax presented to an asset script transform. */
export type AssetScriptFormat = 'js' | 'jsx' | 'ts' | 'tsx'

/** Source map accepted from an asset script transform. */
export type AssetScriptSourceMap = string | Uint8Array | object

/** Context provided to an asset script transform. */
export interface AssetScriptTransformContext {
  /** Absolute path of the module being transformed. */
  filePath: string
  /** Source syntax inferred from the module extension. */
  format: AssetScriptFormat
  /** Whether the module belongs to a dependency rather than application source. */
  isDependency: boolean
  /** Current source map from the transform pipeline, serialized as JSON when present. */
  sourceMap: string | null
  /** Public asset URL pathname for the module. */
  urlPathname: string
}

/** Result returned by an asset script transform. */
export interface AssetScriptTransformResult {
  /** Transformed module source. */
  code: string
  /** Source map from the returned code to the input code. */
  sourceMap?: AssetScriptSourceMap | null
  /** Additional files that invalidate this module when watch mode is enabled. */
  watchFiles?: readonly string[]
}

/** Handler for transforming a browser-delivered script before Remix lowers TypeScript and JSX. */
export type AssetScriptTransformHandler = (
  code: string,
  context: AssetScriptTransformContext,
) =>
  | string
  | AssetScriptTransformResult
  | null
  | Promise<string | AssetScriptTransformResult | null>

/** Configures one transform in the asset script pipeline. */
export interface AssetScriptTransform {
  /** Run this transform for dependency modules as well as application source. (default: `false`) */
  includeDependencies?: boolean
  /** Optional name used to identify the transform in diagnostics. */
  name?: string
  /**
   * Transforms module source before Remix lowers TypeScript and JSX.
   *
   * @param code Current module source.
   * @param context Current module and source map context.
   * @returns Transformed source, a structured result, or `null` to leave the module unchanged.
   */
  transform: AssetScriptTransformHandler
}

/** Script-specific options for {@link createAssetServer}. */
export interface AssetServerScriptOptions {
  /**
   * Replace global expressions with constant values during transform, e.g.
   * `{ 'process.env.NODE_ENV': '"production"' }`.
   */
  define?: Record<string, string>
  /** Import specifiers to leave unrewritten, such as CDN URLs or import map entries. */
  external?: string[]
  /** Ordered source transforms that run before Remix lowers TypeScript and JSX. */
  transforms?: readonly AssetScriptTransform[]
}

export interface ResolvedAssetScriptTransform {
  includeDependencies: boolean
  name?: string
  transform: AssetScriptTransformHandler
}

export function normalizeScriptTransforms(
  transforms: readonly AssetScriptTransform[] | undefined,
): readonly ResolvedAssetScriptTransform[] {
  if (transforms === undefined) return []
  if (!Array.isArray(transforms)) {
    throw new TypeError('scripts.transforms must be an array')
  }

  return transforms.map((transform, index) => {
    if (transform === null || typeof transform !== 'object' || Array.isArray(transform)) {
      throw new TypeError(`scripts.transforms[${index}] must be an object`)
    }
    if (typeof transform.transform !== 'function') {
      throw new TypeError(`scripts.transforms[${index}] must define a transform() function`)
    }
    if (
      transform.includeDependencies !== undefined &&
      typeof transform.includeDependencies !== 'boolean'
    ) {
      throw new TypeError(`scripts.transforms[${index}].includeDependencies must be a boolean`)
    }
    if (transform.name !== undefined && typeof transform.name !== 'string') {
      throw new TypeError(`scripts.transforms[${index}].name must be a string`)
    }

    return {
      includeDependencies: transform.includeDependencies ?? false,
      name: transform.name,
      transform: transform.transform,
    }
  })
}
