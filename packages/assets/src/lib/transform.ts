import * as esbuild from 'esbuild'
import { SUPPORTED_ESBUILD_OPTIONS, type DevAssetsEsbuildConfig } from './options.ts'

/**
 * Transform a single file with esbuild (TypeScript/JSX to ESM).
 * Does not rewrite imports; use resolveSpecifiers + rewriteImports for that.
 *
 * @param filePath Absolute path to the file to transform
 * @param esbuildConfig Optional esbuild config (only supported options are applied)
 * @returns Transformed code and optional source map
 */
export async function transformFile(
  filePath: string,
  esbuildConfig?: DevAssetsEsbuildConfig,
): Promise<{ code: string; map: string | null }> {
  let sourcemap: boolean = esbuildConfig?.sourcemap === false ? false : true
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

  let result = await esbuild.build({
    ...userConfig,
    entryPoints: [filePath],
    bundle: true,
    external: ['*'],
    write: false,
    format: 'esm',
    sourcemap,
  })

  let output = result.outputFiles?.[0]
  if (!output) throw new Error('esbuild did not produce output')

  let code = output.text
  let map = result.outputFiles?.[1]?.text ?? null
  return { code, map }
}
