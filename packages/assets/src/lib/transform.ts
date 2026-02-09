import * as path from 'node:path'
import * as esbuild from 'esbuild'
import { SUPPORTED_ESBUILD_OPTIONS, type DevAssetsEsbuildConfig } from './options.ts'

export interface TransformFileOptions {
  /** Override external list (e.g. when using inject so injected modules are inlined). */
  external?: string[]
}

/**
 * Transform a single file with esbuild (TypeScript/JSX to ESM).
 * Does not rewrite imports; use resolveSpecifiers + rewriteImports for that.
 *
 * @param filePath Absolute path to the file to transform
 * @param esbuildConfig Optional esbuild config (only supported options are applied)
 * @param options Optional overrides (e.g. external when using inject)
 * @returns Transformed code and optional source map
 */
export async function transformFile(
  filePath: string,
  esbuildConfig?: DevAssetsEsbuildConfig,
  options?: TransformFileOptions,
): Promise<{ code: string; map: string | null }> {
  let userConfig: Partial<esbuild.BuildOptions> = {}
  if (esbuildConfig) {
    for (let key of SUPPORTED_ESBUILD_OPTIONS) {
      if (key === 'entryPoints' || key === 'external') continue
      let value = esbuildConfig[key]
      if (value !== undefined) {
        ;(userConfig as Record<string, unknown>)[key] = value
      }
    }
  }

  // When 'inline' or 'both', we need the map in outputFiles[1] to fix paths and then inline ourselves
  let sourcemap = userConfig.sourcemap
  if (sourcemap === 'inline' || sourcemap === 'both') {
    ;(userConfig as Record<string, unknown>).sourcemap = 'external'
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
