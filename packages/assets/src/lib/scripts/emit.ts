import MagicString from 'magic-string'

import {
  createAssetServerCompilationError,
  isAssetServerCompilationError,
} from '../compilation-error.ts'
import { formatFingerprintedPathname, hashContent } from '../fingerprint.ts'
import { restoreAuthoredInjectedPackageSpecifier } from '../injected-packages.ts'
import type { ResolvedModule } from './resolve.ts'
import { composeSourceMaps } from '../source-maps.ts'
import type { AssetServerCompilationError } from '../compilation-error.ts'

export type EmittedAsset = {
  content: string
  etag: string
  fingerprint: string
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

type RewriteImportsOptions = {
  getHmrImportTimestamp(identityPath: string): number | null
  getServedUrl(identityPath: string): Promise<string>
  getStableUrl(identityPath: string): string
}

export async function emitResolvedModule(
  resolvedModule: ResolvedModule,
  options: {
    fingerprintAssets: boolean
    getHmrImportTimestamp(identityPath: string): number | null
    getServedUrl(identityPath: string): Promise<string>
    getStableUrl(identityPath: string): string
    hmrClientPathname?: string
    sourceMaps?: 'external' | 'inline'
  },
): Promise<EmitResult> {
  try {
    let importUrls: string[] = []
    let rewriteResult = await rewriteImports(resolvedModule, options)
    let executableCode = prependHmrContext(resolvedModule, rewriteResult.code, options)
    let sourceMap = rewriteResult.sourceMap
      ? await createEmittedAsset(rewriteResult.sourceMap)
      : null
    let finalCode = executableCode

    if (rewriteResult.sourceMap) {
      if (options.sourceMaps === 'inline') {
        let encoded = Buffer.from(rewriteResult.sourceMap).toString('base64')
        finalCode += `\n//# sourceMappingURL=data:application/json;base64,${encoded}`
      } else if (options.sourceMaps === 'external') {
        finalCode += `\n//# sourceMappingURL=${formatFingerprintedPathname(
          resolvedModule.stableUrlPathname,
          options.fingerprintAssets && sourceMap ? sourceMap.fingerprint : null,
        )}.map`
      }
    }

    let code = await createEmittedAsset(finalCode)

    return {
      ok: true,
      value: {
        code,
        fingerprint: options.fingerprintAssets ? code.fingerprint : null,
        importUrls,
        sourceMap,
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
  options: RewriteImportsOptions,
): Promise<{ code: string; sourceMap: string | null }> {
  let rewrittenSource = new MagicString(resolvedModule.rawCode)
  let changed = false

  for (let imported of resolvedModule.imports) {
    let hmrImportTimestamp = options.getHmrImportTimestamp(imported.depPath)
    let url =
      hmrImportTimestamp === null
        ? restoreAuthoredInjectedPackageSpecifier(imported.specifier)
        : addTimestampQuery(await options.getServedUrl(imported.depPath), hmrImportTimestamp)

    if (url === null) {
      continue
    }
    rewrittenSource.overwrite(
      imported.start,
      imported.end,
      imported.quote ? `${imported.quote}${url}${imported.quote}` : url,
    )
    changed = true
  }

  for (let acceptedDep of resolvedModule.hmr.acceptedDeps) {
    let url = options.getStableUrl(acceptedDep.depPath)
    rewrittenSource.overwrite(
      acceptedDep.start,
      acceptedDep.end,
      acceptedDep.quote ? `${acceptedDep.quote}${url}${acceptedDep.quote}` : url,
    )
    changed = true
  }

  let code = changed ? rewrittenSource.toString() : resolvedModule.rawCode
  let sourceMap =
    resolvedModule.sourceMap && changed
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
  let fingerprint = await hashContent(content)
  return {
    content,
    etag: `W/"${fingerprint}"`,
    fingerprint,
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
