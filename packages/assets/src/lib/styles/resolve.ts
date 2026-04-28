import * as fs from 'node:fs'
import * as path from 'node:path'

import {
  createAssetServerCompilationError,
  isAssetServerCompilationError,
} from '../compilation-error.ts'
import { normalizeFilePath } from '../paths.ts'
import type { AssetServerCompilationError } from '../compilation-error.ts'
import type { ModuleRecord, ModuleTracking } from '../module-store.ts'
import type { CompiledRoutes } from '../routes.ts'
import type { EmittedStyle } from './emit.ts'
import type { TransformedStyle } from './transform.ts'

type StyleRecord = ModuleRecord<TransformedStyle, ResolvedStyle, EmittedStyle>

type ResolvedDependency =
  | {
      kind: 'external'
      placeholder: string
      replacement: string
    }
  | {
      depPath: string
      kind: 'local'
      placeholder: string
      suffix: string
    }

export type ResolvedStyle = {
  dependencies: ResolvedDependency[]
  deps: string[]
  fingerprint: string | null
  identityPath: string
  rawCode: string
  resolvedPath: string
  sourceMap: string | null
  stableUrlPathname: string
  trackedFiles: string[]
}

export type ResolveArgs = {
  isAllowed(absolutePath: string): boolean
  isWatchIgnored(filePath: string): boolean
  routes: CompiledRoutes
}

type ResolveResult = {
  tracking: ModuleTracking
} & (
  | {
      ok: true
      value: ResolvedStyle
    }
  | {
      error: AssetServerCompilationError
      ok: false
    }
)

export async function resolveStyle(
  record: StyleRecord,
  transformed: TransformedStyle,
  args: ResolveArgs,
): Promise<ResolveResult> {
  let trackedFiles = new Set(transformed.trackedFiles)
  let dependencies: ResolvedDependency[] = []
  let deps = new Set<string>()

  for (let unresolved of transformed.unresolvedDependencies) {
    let trackedFile =
      unresolved.type === 'import'
        ? getTrackedImportFilePath(unresolved.url, transformed.resolvedPath)
        : null
    if (trackedFile && !args.isWatchIgnored(trackedFile)) {
      trackedFiles.add(trackedFile)
    }

    try {
      let resolved =
        unresolved.type === 'import'
          ? resolveImportDependency(
              unresolved.url,
              transformed.resolvedPath,
              unresolved.placeholder,
              args,
            )
          : resolveUrlDependency(unresolved.url, unresolved.placeholder)

      dependencies.push(resolved)

      if (resolved.kind === 'local') {
        if (!args.isWatchIgnored(resolved.depPath)) {
          trackedFiles.add(resolved.depPath)
        }
        deps.add(resolved.depPath)
      }
    } catch (error) {
      return failResolve(error, trackedFiles, transformed.resolvedPath)
    }
  }

  return {
    ok: true,
    tracking: {
      trackedFiles: [...trackedFiles],
    },
    value: {
      dependencies,
      deps: [...deps],
      fingerprint: transformed.fingerprint,
      identityPath: record.identityPath,
      rawCode: transformed.rawCode,
      resolvedPath: transformed.resolvedPath,
      sourceMap: transformed.sourceMap,
      stableUrlPathname: transformed.stableUrlPathname,
      trackedFiles: [...trackedFiles],
    },
  }
}

export function resolveServedStyleOrThrow(
  filePath: string,
  args: ResolveArgs,
): {
  identityPath: string
  stableUrlPathname: string
} {
  let identityPath = resolveExistingFilePath(filePath)
  if (!identityPath) {
    throw createAssetServerCompilationError(`File not found: ${filePath}`, {
      code: 'FILE_NOT_FOUND',
    })
  }

  if (!isStyleFilePath(identityPath)) {
    throw createAssetServerCompilationError(`File not found: ${identityPath}`, {
      code: 'FILE_NOT_FOUND',
    })
  }

  if (!args.isAllowed(identityPath)) {
    throw createAssetServerCompilationError(`File is not allowed: ${identityPath}`, {
      code: 'FILE_NOT_ALLOWED',
    })
  }

  let stableUrlPathname = args.routes.toUrlPathname(identityPath)
  if (!stableUrlPathname) {
    throw createAssetServerCompilationError(
      `File ${identityPath} is outside all configured fileMap entries.`,
      {
        code: 'FILE_OUTSIDE_FILE_MAP',
      },
    )
  }

  return { identityPath, stableUrlPathname }
}

function resolveImportDependency(
  url: string,
  importerPath: string,
  placeholder: string,
  args: ResolveArgs,
): ResolvedDependency {
  if (isExternalUrl(url)) {
    return {
      kind: 'external',
      placeholder,
      replacement: url,
    }
  }

  let { pathname, suffix } = splitUrlSuffix(url)
  if (pathname.length === 0 || pathname === '#') {
    return {
      kind: 'external',
      placeholder,
      replacement: url,
    }
  }

  if (pathname.startsWith('/')) {
    return {
      kind: 'external',
      placeholder,
      replacement: url,
    }
  }

  let resolvedFilePath = normalizeFilePath(path.resolve(path.dirname(importerPath), pathname))
  let identityPath = resolveExistingFilePath(resolvedFilePath)
  if (!identityPath || !isStyleFilePath(identityPath)) {
    throw createAssetServerCompilationError(
      `Failed to resolve import "${url}" in ${importerPath}.`,
      {
        code: 'IMPORT_RESOLUTION_FAILED',
      },
    )
  }

  if (!args.isAllowed(identityPath)) {
    throw createAssetServerCompilationError(
      `Import "${url}" in ${importerPath}, resolved to "${identityPath}", is not allowed by the asset server allow/deny configuration. ` +
        `Add a matching allow rule for this file path, remove a conflicting deny rule for this file path, or mark this import as external.`,
      {
        code: 'IMPORT_NOT_ALLOWED',
      },
    )
  }

  if (!args.routes.toUrlPathname(identityPath)) {
    throw createAssetServerCompilationError(
      `Import "${url}" in ${importerPath}, resolved to "${identityPath}", is outside all configured fileMap entries. ` +
        `Add a matching fileMap entry for this file path, or mark this import as external.`,
      {
        code: 'IMPORT_OUTSIDE_FILE_MAP',
      },
    )
  }

  return {
    depPath: identityPath,
    kind: 'local',
    placeholder,
    suffix,
  }
}

function resolveUrlDependency(url: string, placeholder: string): ResolvedDependency {
  return {
    kind: 'external',
    placeholder,
    replacement: url,
  }
}

function resolveExistingFilePath(filePath: string): string | null {
  try {
    return normalizeFilePath(fs.realpathSync(filePath))
  } catch (error) {
    if (isNoEntityError(error)) return null
    throw error
  }
}

function splitUrlSuffix(url: string): {
  pathname: string
  suffix: string
} {
  let queryIndex = url.indexOf('?')
  let hashIndex = url.indexOf('#')
  let endIndex = [queryIndex, hashIndex].filter((index) => index >= 0).sort((a, b) => a - b)[0]

  if (endIndex == null) {
    return {
      pathname: url,
      suffix: '',
    }
  }

  return {
    pathname: url.slice(0, endIndex),
    suffix: url.slice(endIndex),
  }
}

function getTrackedImportFilePath(specifier: string, importerPath: string): string | null {
  let { pathname } = splitUrlSuffix(specifier)
  if (pathname.startsWith('./') || pathname.startsWith('../')) {
    return normalizeFilePath(path.resolve(path.dirname(importerPath), pathname))
  }

  return null
}

function isStyleFilePath(filePath: string): boolean {
  return path.extname(filePath).toLowerCase() === '.css'
}

function isExternalUrl(url: string): boolean {
  return url.startsWith('#') || url.startsWith('//') || /^[A-Za-z][A-Za-z\d+.-]*:/.test(url)
}

function isNoEntityError(error: unknown): error is NodeJS.ErrnoException & { code: 'ENOENT' } {
  return (
    error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT'
  )
}

function toResolveError(error: unknown, importerPath: string): AssetServerCompilationError {
  if (isAssetServerCompilationError(error)) return error

  return createAssetServerCompilationError(
    `Failed to resolve imports in ${importerPath}. ${error instanceof Error ? error.message : String(error)}`,
    {
      cause: error,
      code: 'IMPORT_RESOLUTION_FAILED',
    },
  )
}

function failResolve(
  error: unknown,
  trackedFiles: ReadonlySet<string>,
  importerPath: string,
): ResolveResult {
  return {
    ok: false,
    error: toResolveError(error, importerPath),
    tracking: {
      trackedFiles: [...trackedFiles],
    },
  }
}
