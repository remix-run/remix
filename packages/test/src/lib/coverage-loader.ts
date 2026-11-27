import { readFileSync } from 'node:fs'
import type { registerHooks } from 'node:module'
import { fileURLToPath } from 'node:url'
import { transformTypeScriptSync } from './ts-transform.ts'

type LoadHook = NonNullable<Parameters<typeof registerHooks>[0]['load']>

// In-thread module load hook for TypeScript files.
//
// Applies an un-minified esbuild transform that preserves line structure.
// This ensures V8 coverage byte offsets map
// cleanly to TypeScript source lines via the inline source map, giving
// accurate per-line coverage rather than collapsing multiple statements onto
// a single minified line.

export const load: LoadHook = (url, context, nextLoad) => {
  let cleanUrl = url.includes('?') ? url.slice(0, url.indexOf('?')) : url
  if (!cleanUrl.endsWith('.ts') && !cleanUrl.endsWith('.tsx')) {
    return nextLoad(url, context)
  }

  let filePath = fileURLToPath(cleanUrl)
  let source = readFileSync(filePath, 'utf-8')
  let { code } = transformTypeScriptSync(source, filePath)

  return { format: 'module', source: code, shortCircuit: true }
}
