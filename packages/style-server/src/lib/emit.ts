import MagicString from 'magic-string'

import {
  createStyleServerCompilationError,
  isStyleServerCompilationError,
} from './compilation-error.ts'
import { hashContent } from './fingerprint.ts'
import { composeSourceMaps } from './source-maps.ts'
import type { StyleServerCompilationError } from './compilation-error.ts'
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
      error: StyleServerCompilationError
      ok: false
    }

export async function emitResolvedStyle(
  resolvedStyle: ResolvedStyle,
  options: {
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
        : `${await options.getServedUrl(dependency.depPath)}${dependency.suffix}`
    let start = resolvedStyle.rawCode.indexOf(dependency.placeholder)
    if (start < 0) {
      throw createStyleServerCompilationError(
        `Missing dependency placeholder "${dependency.placeholder}" while emitting CSS.`,
        {
          code: 'STYLE_EMIT_FAILED',
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

async function createEmittedAsset(content: string): Promise<EmittedAsset> {
  return {
    content,
    etag: `W/"${await hashContent(content)}"`,
  }
}

function toEmitError(error: unknown, identityPath: string): StyleServerCompilationError {
  if (isStyleServerCompilationError(error)) return error

  return createStyleServerCompilationError(
    `Failed to emit CSS in ${identityPath}. ${error instanceof Error ? error.message : String(error)}`,
    {
      cause: error,
      code: 'STYLE_EMIT_FAILED',
    },
  )
}
