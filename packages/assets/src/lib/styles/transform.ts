import * as fs from 'node:fs/promises'
import { transform } from 'lightningcss'

import {
  createAssetServerCompilationError,
  isAssetServerCompilationError,
} from '../compilation-error.ts'
import { generateFingerprint } from '../fingerprint.ts'
import type { ModuleTracking } from '../module-store.ts'
import { rewriteSourceMapSources, stringifySourceMap } from '../source-maps.ts'
import type { AssetServerCompilationError } from '../compilation-error.ts'
import type { CompiledRoutes } from '../routes.ts'
import type { ResolvedStyleTarget } from '../target.ts'

type TransformedStyleDependency =
  | {
      placeholder: string
      type: 'import'
      url: string
    }
  | {
      placeholder: string
      type: 'url'
      url: string
    }

export type TransformedStyle = {
  fingerprint: string | null
  identityPath: string
  rawCode: string
  resolvedPath: string
  sourceMap: string | null
  stableUrlPathname: string
  trackedFiles: string[]
  unresolvedDependencies: TransformedStyleDependency[]
}

type TransformResult = {
  tracking: ModuleTracking
} & (
  | {
      ok: true
      value: TransformedStyle
    }
  | {
      error: AssetServerCompilationError
      ok: false
    }
)

export type TransformArgs = {
  buildId: string | null
  isWatchIgnored(filePath: string): boolean
  minify: boolean
  routes: CompiledRoutes
  sourceMaps: 'external' | 'inline' | null
  sourceMapSourcePaths: 'absolute' | 'url'
  targets: ResolvedStyleTarget | null
}

type TransformRecord = {
  identityPath: string
}

export async function transformStyle(
  record: TransformRecord,
  args: TransformArgs,
): Promise<TransformResult> {
  let resolvedPath = record.identityPath
  let trackedFiles = args.isWatchIgnored(resolvedPath) ? [] : [resolvedPath]
  let rawBytes: Uint8Array

  try {
    rawBytes = new Uint8Array(await fs.readFile(resolvedPath))
  } catch (error) {
    if (isNoEntityError(error)) {
      return {
        ok: false,
        error: createAssetServerCompilationError(`File not found: ${resolvedPath}`, {
          cause: error,
          code: 'FILE_NOT_FOUND',
        }),
        tracking: {
          trackedFiles,
        },
      }
    }

    return {
      ok: false,
      error: toTransformFailedError(error, resolvedPath),
      tracking: {
        trackedFiles,
      },
    }
  }

  try {
    let stableUrlPathname = args.routes.toUrlPathname(record.identityPath)
    if (!stableUrlPathname) {
      throw createAssetServerCompilationError(
        `File ${record.identityPath} is outside all configured fileMap entries.`,
        {
          code: 'FILE_OUTSIDE_FILE_MAP',
        },
      )
    }

    let transformResult = runLightningTransform(resolvedPath, rawBytes, {
      minify: args.minify,
      sourceMap: args.sourceMaps != null,
      targets: args.targets,
    })
    let sourceText = Buffer.from(rawBytes).toString('utf8')
    let sourceMap = stringifySourceMap(transformResult.map)
    sourceMap = sourceMap
      ? rewriteSourceMapSources(
          sourceMap,
          resolvedPath,
          stableUrlPathname,
          args.sourceMapSourcePaths,
          sourceText,
        )
      : null

    let unresolvedDependencies: TransformedStyleDependency[] = []
    for (let dependency of transformResult.dependencies ?? []) {
      if (dependency.type === 'import') {
        unresolvedDependencies.push({
          placeholder: dependency.placeholder,
          type: 'import',
          url: dependency.url,
        })
        continue
      }

      if (dependency.type === 'url') {
        unresolvedDependencies.push({
          placeholder: dependency.placeholder,
          type: 'url',
          url: dependency.url,
        })
      }
    }

    return {
      ok: true,
      tracking: {
        trackedFiles,
      },
      value: {
        fingerprint:
          args.buildId === null
            ? null
            : await generateFingerprint({
                buildId: args.buildId,
                content: sourceText,
              }),
        identityPath: record.identityPath,
        rawCode: Buffer.from(transformResult.code).toString('utf8'),
        resolvedPath,
        sourceMap,
        stableUrlPathname,
        trackedFiles,
        unresolvedDependencies,
      },
    }
  } catch (error) {
    return {
      ok: false,
      error: toTransformFailedError(error, resolvedPath),
      tracking: {
        trackedFiles,
      },
    }
  }
}

function runLightningTransform(
  identityPath: string,
  code: Uint8Array,
  options: {
    minify: boolean
    sourceMap: boolean
    targets: ResolvedStyleTarget | null
  },
) {
  try {
    return transform({
      analyzeDependencies: {
        preserveImports: true,
      },
      code,
      filename: identityPath,
      minify: options.minify,
      sourceMap: options.sourceMap,
      targets: options.targets ?? undefined,
    })
  } catch (error) {
    throw createAssetServerCompilationError(
      `Failed to transform style ${identityPath}. ${error instanceof Error ? error.message : String(error)}`,
      {
        cause: error,
        code: 'TRANSFORM_FAILED',
      },
    )
  }
}

function toTransformFailedError(error: unknown, resolvedPath: string): AssetServerCompilationError {
  if (isAssetServerCompilationError(error)) return error

  return createAssetServerCompilationError(
    `Failed to transform style ${resolvedPath}. ${error instanceof Error ? error.message : String(error)}`,
    {
      cause: error,
      code: 'TRANSFORM_FAILED',
    },
  )
}

function isNoEntityError(error: unknown): error is NodeJS.ErrnoException & { code: 'ENOENT' } {
  return (
    error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT'
  )
}
