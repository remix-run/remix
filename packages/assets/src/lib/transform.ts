import * as path from 'node:path'
import * as esbuild from 'esbuild'
import type { InternalTransformConfig } from './options.ts'

/** Supported sourcemap values we pass to esbuild (only these). */
const SUPPORTED_SOURCEMAP = new Set(['inline', 'external'] as const)

export interface TransformFileOptions {
  /** Override external list. */
  external?: string[]
}

/**
 * Transform a single file with esbuild (TypeScript/JSX to ESM).
 * Does not rewrite imports; use resolveSpecifiers + rewriteImports for that.
 * Only options we explicitly support are passed to esbuild (no leaking of unsupported features).
 *
 * @param filePath Absolute path to the file to transform
 * @param config Internal transform config (minify, sourcemap, sourcesContent, sourceRoot)
 * @param options Optional overrides (e.g. external)
 * @returns Transformed code and optional source map
 */
export async function transformFile(
  filePath: string,
  config?: InternalTransformConfig,
  options?: TransformFileOptions,
): Promise<{ code: string; map: string | null }> {
  let userConfig: Partial<esbuild.BuildOptions> = {}
  if (config) {
    if (typeof config.minify === 'boolean') userConfig.minify = config.minify
    if (config.sourcemap !== undefined && SUPPORTED_SOURCEMAP.has(config.sourcemap)) {
      userConfig.sourcemap = config.sourcemap
    }
    if (typeof config.sourcesContent === 'boolean')
      userConfig.sourcesContent = config.sourcesContent
    if (typeof config.sourceRoot === 'string') userConfig.sourceRoot = config.sourceRoot
  }

  // When 'inline', we need the map in outputFiles[1] to fix paths and then inline ourselves
  if (userConfig.sourcemap === 'inline') {
    userConfig.sourcemap = 'external'
  }

  // esbuild requires an output path for external source maps; we use a virtual path and write: false
  let outfile = path.join(
    path.dirname(filePath),
    path.basename(filePath, path.extname(filePath)) + '.js',
  )

  let externalList: string[] = options?.external !== undefined ? options.external : ['*']

  let result = await esbuild.build({
    ...userConfig,
    entryPoints: [filePath],
    outfile,
    bundle: true,
    external: externalList,
    write: false,
    format: 'esm',
  })

  let outputFiles = result.outputFiles ?? []
  let jsFile = outputFiles.find((f) => !f.path.endsWith('.map'))
  let mapFile = outputFiles.find((f) => f.path.endsWith('.map'))
  if (!jsFile) throw new Error('esbuild did not produce output')

  return {
    code: jsFile.text,
    map: mapFile?.text ?? null,
  }
}
