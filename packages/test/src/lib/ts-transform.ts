import { transform } from 'esbuild'

/*
 * Transform a TypeScript file to JavaScript using esbuild with an inline
 * source map and no minification. Used by the coverage ESM loader hook (so V8
 * instruments readable JS), the coverage collector (so byte offsets can be
 * re-derived and mapped back to TypeScript lines), and the browser harness
 * server (so the bytes V8 sees in the browser match what the collector
 * re-derives). Identical inputs must produce identical outputs across all
 * call sites or coverage offsets won't line up.
 */
export async function transformTypeScript(
  source: string,
  filePath: string,
): Promise<{ code: string }> {
  let loader: 'ts' | 'tsx' = filePath.endsWith('.tsx') ? 'tsx' : ('ts' as const)
  let result = await transform(source, {
    loader,
    sourcemap: 'inline',
    sourcesContent: true,
    sourcefile: filePath,
    jsx: 'automatic',
    jsxImportSource: '@remix-run/component',
  })
  return { code: result.code }
}
