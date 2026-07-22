import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

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
      kind: 'style'
      placeholder: string
      suffix: string
    }
  | {
      depPath: string
      kind: 'file'
      placeholder: string
      requestTransform: readonly string[] | null
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
  isServedFilePath(filePath: string): boolean
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

type ParsedRelativeUrl = {
  hash: string
  resolvedPath: string
  search: string
}

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
        : getTrackedUrlFilePath(unresolved.url, transformed.resolvedPath)
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
          : resolveUrlDependency(
              unresolved.url,
              transformed.resolvedPath,
              unresolved.placeholder,
              args,
            )

      dependencies.push(resolved)

      if (resolved.kind === 'style' || resolved.kind === 'file') {
        if (!args.isWatchIgnored(resolved.depPath)) {
          trackedFiles.add(resolved.depPath)
        }
      }

      if (resolved.kind === 'style') {
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
    throw createAssetServerCompilationError(
      `File "${identityPath}" is not allowed by the asset server access configuration. ` +
        `Add a matching allowFiles or allowPackages rule, or remove a conflicting denyFiles rule.`,
      {
        code: 'FILE_NOT_ALLOWED',
      },
    )
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

  let parsedUrl = parseRelativeUrl(url, importerPath)
  if (parsedUrl === null) {
    return {
      kind: 'external',
      placeholder,
      replacement: url,
    }
  }

  let { hash, resolvedPath, search } = parsedUrl
  let resolvedFilePath = resolvedPath
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
      `Import "${url}" in ${importerPath}, resolved to "${identityPath}", is not allowed by the asset server access configuration. ` +
        `Add a matching allowFiles or allowPackages rule, remove a conflicting denyFiles rule, or mark this import as external.`,
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
    kind: 'style',
    placeholder,
    suffix: `${search}${hash}`,
  }
}

function resolveUrlDependency(
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

  let parsedUrl = parseRelativeUrl(url, importerPath)
  if (parsedUrl === null) {
    return {
      kind: 'external',
      placeholder,
      replacement: url,
    }
  }

  let { hash, resolvedPath, search } = parsedUrl
  let resolvedFilePath = resolvedPath
  let identityPath = resolveExistingFilePath(resolvedFilePath)
  if (!identityPath) {
    throw createAssetServerCompilationError(`Failed to resolve url("${url}") in ${importerPath}.`, {
      code: 'URL_RESOLUTION_FAILED',
    })
  }

  if (!args.isServedFilePath(identityPath)) {
    throw createAssetServerCompilationError(
      `URL "${url}" in ${importerPath}, resolved to "${identityPath}", is not a supported file asset. ` +
        `Add the file extension to files.extensions to serve this asset.`,
      {
        code: 'URL_NOT_SUPPORTED',
      },
    )
  }

  if (!args.isAllowed(identityPath)) {
    throw createAssetServerCompilationError(
      `URL "${url}" in ${importerPath}, resolved to "${identityPath}", is not allowed by the asset server access configuration. ` +
        `Add a matching allowFiles or allowPackages rule, or remove a conflicting denyFiles rule.`,
      {
        code: 'URL_NOT_ALLOWED',
      },
    )
  }

  if (!args.routes.toUrlPathname(identityPath)) {
    throw createAssetServerCompilationError(
      `URL "${url}" in ${importerPath}, resolved to "${identityPath}", is outside all configured fileMap entries. ` +
        `Add a matching fileMap entry for this file path.`,
      {
        code: 'URL_OUTSIDE_FILE_MAP',
      },
    )
  }

  let parsedRequest = parseResolvedFileRequest({ hash, search })

  return {
    depPath: identityPath,
    kind: 'file',
    placeholder,
    requestTransform: parsedRequest.transform,
    suffix: parsedRequest.suffix,
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

function parseRelativeUrl(url: string, importerPath: string): ParsedRelativeUrl | null {
  if (url.length === 0 || url.startsWith('?') || url.startsWith('/') || isExternalUrl(url)) {
    return null
  }

  let parsed = new URL(url, pathToFileURL(importerPath))

  return {
    hash: parsed.hash,
    resolvedPath: normalizeFilePath(fileURLToPath(parsed)),
    search: parsed.search,
  }
}

function parseResolvedFileRequest(url: Pick<ParsedRelativeUrl, 'hash' | 'search'>): {
  suffix: string
  transform: readonly string[] | null
} {
  let { hash, search } = url

  if (search.length === 0) {
    return {
      suffix: hash,
      transform: null,
    }
  }

  let searchParams = new URLSearchParams(search.slice(1))
  let transform = searchParams.getAll('transform')
  searchParams.delete('transform')
  let remainingSearch = searchParams.toString()

  return {
    suffix: `${remainingSearch.length > 0 ? `?${remainingSearch}` : ''}${hash}`,
    transform: transform.length > 0 ? transform : null,
  }
}

function getTrackedImportFilePath(specifier: string, importerPath: string): string | null {
  return parseRelativeUrl(specifier, importerPath)?.resolvedPath ?? null
}

function getTrackedUrlFilePath(url: string, importerPath: string): string | null {
  return parseRelativeUrl(url, importerPath)?.resolvedPath ?? null
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
