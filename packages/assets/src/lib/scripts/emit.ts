import MagicString from 'magic-string'

import {
  createAssetServerCompilationError,
  isAssetServerCompilationError,
} from '../compilation-error.ts'
import { hashContent } from '../fingerprint.ts'
import type { ResolvedModule } from './resolve.ts'
import { composeSourceMaps } from '../source-maps.ts'
import type { AssetServerCompilationError } from '../compilation-error.ts'

export type EmittedAsset = {
  content: string
  etag: string
}

export type EmittedModule = {
  code: EmittedAsset
  fingerprint: string | null
  importUrls: string[]
  sourceMap: EmittedAsset | null
}

type EmitResult =
  | {
      ok: true
      value: EmittedModule
    }
  | {
      ok: false
      error: AssetServerCompilationError
    }

export async function emitResolvedModule(
  resolvedModule: ResolvedModule,
  options: {
    getHmrImportTimestamp(identityPath: string): number | null
    getServedUrl(identityPath: string): Promise<string>
    getStableUrl(identityPath: string): string
    hmrClientPathname?: string
    sourceMaps?: 'external' | 'inline'
  },
): Promise<EmitResult> {
  try {
    let importUrls = await Promise.all(
      resolvedModule.deps.map((depPath) => options.getServedUrl(depPath)),
    )
    let rewriteResult = await rewriteImports(resolvedModule, options)
    let finalCode = prependHmrContext(resolvedModule, rewriteResult.code, options)

    if (rewriteResult.sourceMap) {
      if (options.sourceMaps === 'inline') {
        let encoded = Buffer.from(rewriteResult.sourceMap).toString('base64')
        finalCode += `\n//# sourceMappingURL=data:application/json;base64,${encoded}`
      } else if (options.sourceMaps === 'external') {
        finalCode += `\n//# sourceMappingURL=${await options.getServedUrl(resolvedModule.identityPath)}.map`
      }
    }

    return {
      ok: true,
      value: {
        code: await createEmittedAsset(finalCode),
        fingerprint: resolvedModule.fingerprint,
        importUrls,
        sourceMap: rewriteResult.sourceMap
          ? await createEmittedAsset(rewriteResult.sourceMap)
          : null,
      },
    }
  } catch (error) {
    return {
      ok: false,
      error: toEmitError(error, resolvedModule.identityPath),
    }
  }
}

async function rewriteImports(
  resolvedModule: ResolvedModule,
  options: {
    getHmrImportTimestamp(identityPath: string): number | null
    getServedUrl(identityPath: string): Promise<string>
    getStableUrl(identityPath: string): string
  },
): Promise<{ code: string; sourceMap: string | null }> {
  let rewrittenSource = new MagicString(resolvedModule.rawCode)

  for (let imported of resolvedModule.imports) {
    let url = await options.getServedUrl(imported.depPath)
    let hmrImportTimestamp = options.getHmrImportTimestamp(imported.depPath)
    if (hmrImportTimestamp !== null) {
      url = addTimestampQuery(url, hmrImportTimestamp)
    }
    rewrittenSource.overwrite(
      imported.start,
      imported.end,
      imported.quote ? `${imported.quote}${url}${imported.quote}` : url,
    )
  }

  for (let acceptedDep of resolvedModule.hmr.acceptedDeps) {
    let url = options.getStableUrl(acceptedDep.depPath)
    rewrittenSource.overwrite(
      acceptedDep.start,
      acceptedDep.end,
      acceptedDep.quote ? `${acceptedDep.quote}${url}${acceptedDep.quote}` : url,
    )
  }

  let code = rewrittenSource.toString()
  let sourceMap =
    resolvedModule.sourceMap &&
    (resolvedModule.imports.length > 0 || resolvedModule.hmr.acceptedDeps.length > 0)
      ? composeSourceMaps(
          rewrittenSource.generateMap({ hires: true }).toString(),
          resolvedModule.sourceMap,
        )
      : resolvedModule.sourceMap

  return { code, sourceMap }
}

function addTimestampQuery(pathname: string, timestamp: number): string {
  return `${pathname}${pathname.includes('?') ? '&' : '?'}t=${timestamp}`
}

function prependHmrContext(
  resolvedModule: ResolvedModule,
  code: string,
  options: {
    hmrClientPathname?: string
  },
): string {
  if (!options.hmrClientPathname || !resolvedModule.hmr.usesImportMetaHot) return code

  return (
    `import { createHotContext as __remixCreateHotContext } from ${JSON.stringify(
      options.hmrClientPathname,
    )};\n` +
    `import.meta.hot = __remixCreateHotContext(${JSON.stringify(
      resolvedModule.stableUrlPathname,
    )});\n` +
    code
  )
}

async function createEmittedAsset(content: string): Promise<EmittedAsset> {
  return {
    content,
    etag: `W/"${await hashContent(content)}"`,
  }
}

function toEmitError(error: unknown, identityPath: string): AssetServerCompilationError {
  if (isAssetServerCompilationError(error)) return error

  return createAssetServerCompilationError(
    `Failed to emit script ${identityPath}. ${error instanceof Error ? error.message : String(error)}`,
    {
      cause: error,
      code: 'EMIT_FAILED',
    },
  )
}
