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
      kind: 'file' | 'style'
      placeholder: string
      requestTransform: string | null
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

  let { hash, pathname, search } = splitUrlSuffix(url)
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
    kind: 'style',
    placeholder,
    requestTransform: null,
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

  let { hash, pathname, search } = splitUrlSuffix(url)
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
      `URL "${url}" in ${importerPath}, resolved to "${identityPath}", is not allowed by the asset server allow/deny configuration. ` +
        `Add a matching allow rule for this file path or remove a conflicting deny rule for this file path.`,
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

  let parsedRequest = parseResolvedFileRequest(search, hash)

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

function splitUrlSuffix(url: string): {
  hash: string
  pathname: string
  search: string
} {
  let queryIndex = url.indexOf('?')
  let hashIndex = url.indexOf('#')
  let endIndex = [queryIndex, hashIndex].filter((index) => index >= 0).sort((a, b) => a - b)[0]

  if (endIndex == null) {
    return {
      hash: '',
      pathname: url,
      search: '',
    }
  }

  let search = ''
  let hash = ''
  if (queryIndex >= 0) {
    let searchEnd = hashIndex >= 0 && hashIndex > queryIndex ? hashIndex : url.length
    search = url.slice(queryIndex, searchEnd)
  }
  if (hashIndex >= 0) {
    hash = url.slice(hashIndex)
  }

  return {
    hash,
    pathname: url.slice(0, endIndex),
    search,
  }
}

function parseResolvedFileRequest(
  search: string,
  hash: string,
): {
  suffix: string
  transform: string | null
} {
  if (search.length === 0) {
    return {
      suffix: hash,
      transform: null,
    }
  }

  let searchParams = new URLSearchParams(search.slice(1))
  let transform = searchParams.get('transform')
  searchParams.delete('transform')
  let remainingSearch = searchParams.toString()

  return {
    suffix: `${remainingSearch.length > 0 ? `?${remainingSearch}` : ''}${hash}`,
    transform,
  }
}

function getTrackedImportFilePath(specifier: string, importerPath: string): string | null {
  let { pathname } = splitUrlSuffix(specifier)
  if (pathname.startsWith('./') || pathname.startsWith('../')) {
    return normalizeFilePath(path.resolve(path.dirname(importerPath), pathname))
  }

  return null
}

function getTrackedUrlFilePath(url: string, importerPath: string): string | null {
  let { pathname } = splitUrlSuffix(url)
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
