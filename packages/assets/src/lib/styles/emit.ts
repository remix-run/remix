import MagicString from 'magic-string'

import {
  createAssetServerCompilationError,
  isAssetServerCompilationError,
} from '../compilation-error.ts'
import { formatFingerprintedPathname, hashContent } from '../fingerprint.ts'
import { composeSourceMaps } from '../source-maps.ts'
import type { AssetServerCompilationError } from '../compilation-error.ts'
import type { ResolvedStyle } from './resolve.ts'

export type EmittedAsset = {
  content: string
  etag: string
  fingerprint: string
}

export type EmittedStyle = {
  code: EmittedAsset
  fingerprint: string | null
  importUrls: string[]
  sourceMap: EmittedAsset | null
}

type EmitResult =
  | {
      ok: true
      value: EmittedStyle
    }
  | {
      error: AssetServerCompilationError
      ok: false
    }

export async function emitResolvedStyle(
  resolvedStyle: ResolvedStyle,
  options: {
    fingerprintAssets: boolean
    getServedFileUrl?(
      identityPath: string,
      options: {
        transform: readonly string[] | null
      },
    ): Promise<string>
    getServedUrl(identityPath: string): Promise<string>
    sourceMaps?: 'external' | 'inline'
  },
): Promise<EmitResult> {
  try {
    let importUrls = await Promise.all(
      resolvedStyle.deps.map((depPath) => options.getServedUrl(depPath)),
    )
    let rewriteResult = await rewriteDependencies(resolvedStyle, options)
    let finalCode = rewriteResult.code
    let sourceMap = rewriteResult.sourceMap
      ? await createEmittedAsset(rewriteResult.sourceMap)
      : null

    if (rewriteResult.sourceMap) {
      if (options.sourceMaps === 'inline') {
        let encoded = Buffer.from(rewriteResult.sourceMap).toString('base64')
        finalCode += `\n/*# sourceMappingURL=data:application/json;base64,${encoded} */`
      } else if (options.sourceMaps === 'external') {
        finalCode += `\n/*# sourceMappingURL=${formatFingerprintedPathname(
          resolvedStyle.stableUrlPathname,
          options.fingerprintAssets && sourceMap ? sourceMap.fingerprint : null,
        )}.map */`
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
      error: toEmitError(error, resolvedStyle.identityPath),
      ok: false,
    }
  }
}

async function rewriteDependencies(
  resolvedStyle: ResolvedStyle,
  options: {
    getServedUrl(identityPath: string): Promise<string>
    getServedFileUrl?(
      identityPath: string,
      options: {
        transform: readonly string[] | null
      },
    ): Promise<string>
  },
): Promise<{ code: string; sourceMap: string | null }> {
  if (resolvedStyle.dependencies.length === 0) {
    return {
      code: resolvedStyle.rawCode,
      sourceMap: resolvedStyle.sourceMap,
    }
  }

  let rewrittenSource = new MagicString(resolvedStyle.rawCode)

  for (let dependency of resolvedStyle.dependencies) {
    let replacement =
      dependency.kind === 'external'
        ? dependency.replacement
        : dependency.kind === 'style'
          ? appendUrlSuffix(await options.getServedUrl(dependency.depPath), dependency.suffix)
          : appendUrlSuffix(
              await getServedFileUrl(options, resolvedStyle.identityPath, dependency.depPath, {
                transform: dependency.requestTransform,
              }),
              dependency.suffix,
            )
    let start = resolvedStyle.rawCode.indexOf(dependency.placeholder)
    if (start < 0) {
      throw createAssetServerCompilationError(
        `Missing dependency placeholder "${dependency.placeholder}" while emitting style ${resolvedStyle.identityPath}.`,
        {
          code: 'EMIT_FAILED',
        },
      )
    }

    rewrittenSource.overwrite(start, start + dependency.placeholder.length, replacement)
  }

  return {
    code: rewrittenSource.toString(),
    sourceMap: resolvedStyle.sourceMap
      ? composeSourceMaps(
          rewrittenSource.generateMap({ hires: true }).toString(),
          resolvedStyle.sourceMap,
        )
      : null,
  }
}

function appendUrlSuffix(url: string, suffix: string): string {
  if (!suffix.startsWith('?') || !url.includes('?')) {
    return `${url}${suffix}`
  }

  return `${url}&${suffix.slice(1)}`
}

async function getServedFileUrl(
  options: {
    getServedFileUrl?(
      identityPath: string,
      options: {
        transform: readonly string[] | null
      },
    ): Promise<string>
    getServedUrl(identityPath: string): Promise<string>
  },
  importerPath: string,
  identityPath: string,
  request: {
    transform: readonly string[] | null
  },
): Promise<string> {
  if (!options.getServedFileUrl) {
    throw createAssetServerCompilationError(`Missing file URL resolver for ${identityPath}.`, {
      code: 'EMIT_FAILED',
    })
  }

  try {
    return await options.getServedFileUrl(identityPath, request)
  } catch (error) {
    if (
      request.transform !== null &&
      isAssetServerCompilationError(error) &&
      error.code === 'FILE_TRANSFORM_QUERY_INVALID'
    ) {
      console.warn(
        `Invalid file transform request "${request.transform.join(',')}" in CSS asset ${importerPath} for ${identityPath}: ${error.message}`,
      )
      let href = await options.getServedFileUrl(identityPath, { transform: null })
      let searchParams = new URLSearchParams()
      for (let transform of request.transform) {
        searchParams.append('transform', transform)
      }

      let search = searchParams.toString()
      return search.length > 0 ? `${href}?${search}` : href
    }

    throw error
  }
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
    `Failed to emit style ${identityPath}. ${error instanceof Error ? error.message : String(error)}`,
    {
      cause: error,
      code: 'EMIT_FAILED',
    },
  )
}
