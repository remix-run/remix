import * as path from 'node:path'
import { init as lexerInit, parse as parseImports } from 'es-module-lexer'
import MagicString from 'magic-string'
import type { ResolveContext } from './resolve.ts'
import { resolveSpecifiers } from './resolve.ts'

let lexerReady = lexerInit

export function isExternalSpecifier(specifier: string, externalSpecifiers: string[]): boolean {
  return externalSpecifiers.includes(specifier)
}

/**
 * Rewrite imports in the source code using the resolution cache.
 * Resolves uncached specifiers via resolveSpecifiers before applying replacements.
 *
 * @param source Transformed source code.
 * @param esbuildMap Source map from esbuild.
 * @param sourceUrl URL of the file being rewritten.
 * @param importerPath Absolute path of the importing file.
 * @param resolutionCache Map of specifier → resolved URL.
 * @param ctx Resolve context.
 * @param externalSpecifiers Specifier strings to leave unchanged (not rewritten).
 * @returns Rewritten code and combined source map.
 */
export async function rewriteImports(
  source: string,
  esbuildMap: string,
  sourceUrl: string,
  importerPath: string,
  resolutionCache: Map<string, string>,
  ctx: ResolveContext,
  externalSpecifiers: string[],
): Promise<{ code: string; map: string | null }> {
  await lexerReady

  let importerDir = path.dirname(importerPath)
  let [imports] = parseImports(source)

  let importInfos: Array<{ specifier: string; start: number; end: number }> = []
  for (let imp of imports) {
    if (imp.n != null) {
      importInfos.push({ specifier: imp.n, start: imp.s, end: imp.e })
    }
  }

  if (importInfos.length === 0) {
    return { code: source, map: esbuildMap }
  }

  let uncachedSpecifiers: string[] = []
  for (let { specifier } of importInfos) {
    if (isExternalSpecifier(specifier, externalSpecifiers)) continue
    let cacheKey = `${specifier}\0${importerDir}`
    if (!resolutionCache.has(cacheKey)) {
      uncachedSpecifiers.push(specifier)
    }
  }

  if (uncachedSpecifiers.length > 0) {
    let unique = [...new Set(uncachedSpecifiers)]
    await resolveSpecifiers(unique, importerDir, ctx, resolutionCache, externalSpecifiers, (s) =>
      isExternalSpecifier(s, externalSpecifiers),
    )
  }

  let magicString = new MagicString(source)
  let hasChanges = false

  for (let { specifier, start, end } of importInfos) {
    if (isExternalSpecifier(specifier, externalSpecifiers)) continue
    let cacheKey = `${specifier}\0${importerDir}`
    let resolved = resolutionCache.get(cacheKey)
    if (resolved && resolved !== specifier) {
      magicString.overwrite(start, end, resolved)
      hasChanges = true
    }
  }

  if (!hasChanges) {
    return { code: source, map: esbuildMap }
  }

  let rewrittenCode = magicString.toString()
  // We return the esbuild map only; composing it with the rewrite map is not yet implemented.
  return { code: rewrittenCode, map: esbuildMap }
}
