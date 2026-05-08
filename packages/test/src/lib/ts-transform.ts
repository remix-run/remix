import { transform } from 'esbuild'
import { getTsconfig, type TsConfigResult } from 'get-tsconfig'
import * as path from 'node:path'

const tsconfigCache = new Map<string, TsConfigResult | null>()

/*
 * Transform a TypeScript file to JavaScript using esbuild with an inline
 * source map and no minification. Used by the coverage ESM loader hook (so V8
 * instruments readable JS), the coverage collector (so byte offsets can be
 * re-derived and mapped back to TypeScript lines), and the browser harness
 * server (so the bytes V8 sees in the browser match what the collector
 * re-derives). Identical inputs must produce identical outputs across all
 * call sites or coverage offsets won't line up.
 *
 * Compiler options (notably JSX) are taken from the nearest `tsconfig.json`
 * walking up from the file's directory, so each project picks up its own
 * `jsxImportSource` etc. Discovery results are cached by directory.
 */
export async function transformTypeScript(
  source: string,
  filePath: string,
): Promise<{ code: string }> {
  let loader: 'ts' | 'tsx' = filePath.endsWith('.tsx') ? 'tsx' : 'ts'

  let tsConfig = getTsconfig(path.dirname(filePath), 'tsconfig.json', tsconfigCache)

  let result = await transform(source, {
    loader,
    sourcemap: 'inline',
    sourcesContent: true,
    sourcefile: filePath,
    tsconfigRaw: { compilerOptions: tsConfig?.config.compilerOptions ?? {} },
  })
  return { code: result.code }
}
