import MagicString from 'magic-string'

import {
  createAssetServerCompilationError,
  isAssetServerCompilationError,
} from '../compilation-error.ts'
import { hashContent } from '../fingerprint.ts'
import { composeSourceMaps } from '../source-maps.ts'
import type { AssetServerCompilationError } from '../compilation-error.ts'
import type { ResolvedStyle } from './resolve.ts'

export type EmittedAsset = {
  content: string
  etag: string
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
    getServedFileUrl?(
      identityPath: string,
      options: {
        transform: string | null
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

    if (rewriteResult.sourceMap) {
      if (options.sourceMaps === 'inline') {
        let encoded = Buffer.from(rewriteResult.sourceMap).toString('base64')
        finalCode += `\n/*# sourceMappingURL=data:application/json;base64,${encoded} */`
      } else if (options.sourceMaps === 'external') {
        finalCode += `\n/*# sourceMappingURL=${await options.getServedUrl(resolvedStyle.identityPath)}.map */`
      }
    }

    return {
      ok: true,
      value: {
        code: await createEmittedAsset(finalCode),
        fingerprint: resolvedStyle.fingerprint,
        importUrls,
        sourceMap: rewriteResult.sourceMap
          ? await createEmittedAsset(rewriteResult.sourceMap)
          : null,
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
        transform: string | null
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
          ? `${await options.getServedUrl(dependency.depPath)}${dependency.suffix}`
          : appendUrlSuffix(
              await getServedFileUrl(options, resolvedStyle.identityPath, dependency.depPath, {
                transform: dependency.requestTransform,
              }),
              dependency.suffix,
            )
    // Ensure double quotes used in transform queries don't break the quoted CSS URL output.
    replacement = replacement.replaceAll('"', '%22')
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
        transform: string | null
      },
    ): Promise<string>
    getServedUrl(identityPath: string): Promise<string>
  },
  importerPath: string,
  identityPath: string,
  request: {
    transform: string | null
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
      error.code === 'INVALID_TRANSFORM_QUERY'
    ) {
      console.warn(
        `Invalid file transform request "${request.transform}" in CSS asset ${importerPath} for ${identityPath}: ${error.message}`,
      )
      let href = await options.getServedFileUrl(identityPath, { transform: null })
      return `${href}?transform=${encodeURIComponent(request.transform)}`
    }

    throw error
  }
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
    `Failed to emit style ${identityPath}. ${error instanceof Error ? error.message : String(error)}`,
    {
      cause: error,
      code: 'EMIT_FAILED',
    },
  )
}
