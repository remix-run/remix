import * as fs from 'node:fs'
import * as path from 'node:path'
import type { ResolverFactory } from 'oxc-resolver'

import {
  createAssetServerCompilationError,
  isAssetServerCompilationError,
} from '../compilation-error.ts'
import type { AssetServerCompilationError } from '../compilation-error.ts'
import { normalizeFilePath } from '../paths.ts'
import type { CompiledRoutes } from '../routes.ts'
import type { ModuleRecord } from './store.ts'
import type { ResolveModuleResult, TransformedModule } from './transform.ts'

export const resolverExtensionAlias = {
  '.js': ['.js', '.ts', '.tsx', '.jsx'],
  '.jsx': ['.jsx', '.tsx'],
  '.mjs': ['.mjs', '.mts'],
} satisfies Record<string, string[]>

export const resolverExtensions = ['.ts', '.tsx', '.js', '.jsx', '.mts', '.mjs']
export const supportedScriptExtensions = ['.ts', '.tsx', '.js', '.jsx', '.mts', '.mjs']
const supportedScriptExtensionSet = new Set<string>(supportedScriptExtensions)

type ResolvedImport = {
  depPath: string
  end: number
  quote?: '"' | "'" | '`'
  start: number
}

type RelativeImportResolution = {
  candidatePaths: readonly string[]
  candidatePrefixes: readonly string[]
  specifier: string
}

export type TrackedResolution = RelativeImportResolution & {
  resolvedIdentityPath: string | null
}

export type ResolvedModule = {
  deps: string[]
  fingerprint: string | null
  identityPath: string
  imports: ResolvedImport[]
  trackedFiles: string[]
  trackedResolutions: TrackedResolution[]
  rawCode: string
  resolvedPath: string
  sourceMap: string | null
  stableUrlPathname: string
}

export type ResolutionFailureState = {
  trackedFiles: readonly string[]
  trackedResolutions: readonly TrackedResolution[]
}

type ResolveResult =
  | {
      ok: true
      value: ResolvedModule
    }
  | {
      ok: false
      error: AssetServerCompilationError
      tracking: ResolutionFailureState
    }

export type ResolveArgs = {
  isAllowed(absolutePath: string): boolean
  resolveModulePath(absolutePath: string): ResolveModuleResult | null
  resolverFactory: ResolverFactory
  routes: CompiledRoutes
}

type ResolvedSpec = {
  absolutePath: string | null
  packageJsonPath: string | null
  specifier: string
}

export async function resolveModule(
  record: ModuleRecord,
  transformed: TransformedModule,
  args: ResolveArgs,
): Promise<ResolveResult> {
  let trackedFiles = new Set(transformed.trackedFiles)
  let trackedResolutions: TrackedResolution[] = []
  let resolvedImports: Map<string, ResolvedSpec>

  try {
    resolvedImports =
      transformed.unresolvedImports.length > 0
        ? await batchResolveSpecifiers(
            getUniqueSpecifiers(transformed.unresolvedImports),
            transformed.resolvedPath,
            args.resolverFactory,
          )
        : new Map<string, ResolvedSpec>()
  } catch (error) {
    return failResolve(error, trackedFiles, trackedResolutions, transformed.resolvedPath)
  }

  let importsWithPaths: ResolvedImport[] = []
  let deps = new Set<string>()

  for (let unresolved of transformed.unresolvedImports) {
    let trackedResolution = getTrackedRelativeImportResolution(
      transformed.importerDir,
      unresolved.specifier,
    )

    let resolvedSpec = resolvedImports.get(unresolved.specifier)
    if (!resolvedSpec?.absolutePath) {
      return failResolve(
        createAssetServerCompilationError(
          `Failed to resolve import "${unresolved.specifier}" in ${transformed.resolvedPath}. ` +
            `Ensure it resolves to a file within the configured asset server routes, or mark it as external.`,
          {
            code: 'IMPORT_RESOLUTION_FAILED',
          },
        ),
        trackedFiles,
        trackedResolutions,
        transformed.resolvedPath,
        trackedResolution,
      )
    }

    let resolvedImport = args.resolveModulePath(resolvedSpec.absolutePath)
    if (!resolvedImport) {
      return failResolve(
        createAssetServerCompilationError(
          `Resolved import "${unresolved.specifier}" in ${transformed.resolvedPath} is not a supported script module. ` +
            `Supported extensions are ${supportedScriptExtensions.join(', ')}.`,
          {
            code: 'IMPORT_NOT_SUPPORTED',
          },
        ),
        trackedFiles,
        trackedResolutions,
        transformed.resolvedPath,
        trackedResolution,
      )
    }

    if (!args.isAllowed(resolvedImport.identityPath)) {
      return failResolve(
        createAssetServerCompilationError(
          `Resolved import "${unresolved.specifier}" in ${transformed.resolvedPath} points outside the asset server routing/allow configuration. ` +
            `Add a matching route and allow rule, or mark this import as external.`,
          {
            code: 'IMPORT_NOT_ALLOWED',
          },
        ),
        trackedFiles,
        trackedResolutions,
        transformed.resolvedPath,
        trackedResolution,
      )
    }

    let stableUrlPathname = args.routes.toUrlPathname(resolvedImport.identityPath)
    if (!stableUrlPathname) {
      return failResolve(
        createAssetServerCompilationError(
          `Resolved import "${unresolved.specifier}" in ${transformed.resolvedPath} points outside the asset server routing/allow configuration. ` +
            `Add a matching route and allow rule, or mark this import as external.`,
          {
            code: 'IMPORT_NOT_ALLOWED',
          },
        ),
        trackedFiles,
        trackedResolutions,
        transformed.resolvedPath,
        trackedResolution,
      )
    }

    deps.add(resolvedImport.identityPath)

    if (transformed.packageSpecifiers.includes(unresolved.specifier)) {
      let packageJsonPath =
        resolvedSpec.packageJsonPath ?? findNearestPackageJsonPath(resolvedImport.resolvedPath)
      if (packageJsonPath) trackedFiles.add(packageJsonPath)
    }

    if (trackedResolution) {
      trackedResolutions.push({
        ...trackedResolution,
        resolvedIdentityPath: resolvedImport.identityPath,
      })
    }

    importsWithPaths.push({
      depPath: resolvedImport.identityPath,
      end: unresolved.end,
      quote: unresolved.quote,
      start: unresolved.start,
    })
  }

  return {
    ok: true,
    value: {
      deps: [...deps],
      fingerprint: transformed.fingerprint,
      identityPath: record.identityPath,
      imports: importsWithPaths,
      trackedFiles: [...trackedFiles],
      trackedResolutions,
      rawCode: transformed.rawCode,
      resolvedPath: transformed.resolvedPath,
      sourceMap: transformed.sourceMap,
      stableUrlPathname: transformed.stableUrlPathname,
    },
  }
}

function findNearestPackageJsonPath(filePath: string): string | null {
  let directory = path.dirname(filePath)

  while (true) {
    let packageJsonPath = path.join(directory, 'package.json')
    if (fs.existsSync(packageJsonPath)) {
      return normalizeFilePath(packageJsonPath)
    }

    let parentDirectory = path.dirname(directory)
    if (parentDirectory === directory) return null
    directory = parentDirectory
  }
}

function isRelativeImportSpecifier(specifier: string): boolean {
  return specifier.startsWith('./') || specifier.startsWith('../')
}

function getTrackedRelativeImportResolution(
  importerDir: string,
  specifier: string,
): RelativeImportResolution | null {
  if (!isRelativeImportSpecifier(specifier)) return null

  let candidatePath = resolveCandidateBasePath(importerDir, specifier)
  let extension = path.extname(specifier)
  if (extension === '') {
    return {
      candidatePaths: [
        candidatePath,
        ...supportedScriptExtensions.map(
          (candidateExtension) => `${candidatePath}${candidateExtension}`,
        ),
      ],
      candidatePrefixes: [`${candidatePath}/`],
      specifier,
    }
  }

  let candidateExtensions = resolverExtensionAlias[extension as keyof typeof resolverExtensionAlias]
  if (!candidateExtensions && !supportedScriptExtensionSet.has(extension)) {
    return {
      candidatePaths: [
        candidatePath,
        ...supportedScriptExtensions.map(
          (candidateExtension) => `${candidatePath}${candidateExtension}`,
        ),
      ],
      candidatePrefixes: [`${candidatePath}/`],
      specifier,
    }
  }

  if (!candidateExtensions) return null

  return {
    candidatePaths: [
      candidatePath,
      ...candidateExtensions.map(
        (candidateExtension) =>
          `${candidatePath.slice(0, candidatePath.length - extension.length)}${candidateExtension}`,
      ),
    ],
    candidatePrefixes: [`${candidatePath}/`],
    specifier,
  }
}

function resolveCandidateBasePath(importerDir: string, specifier: string): string {
  return normalizeFilePath(path.resolve(importerDir, specifier))
}

async function batchResolveSpecifiers(
  specifiers: string[],
  importerPath: string,
  resolverFactory: ResolveArgs['resolverFactory'],
): Promise<Map<string, ResolvedSpec>> {
  let resolvedBySpecifier = new Map<string, ResolvedSpec>()
  if (specifiers.length === 0) return resolvedBySpecifier

  try {
    for (let specifier of specifiers) {
      let resolutionResult = await resolverFactory.resolveFileAsync(importerPath, specifier)
      if (resolutionResult.error) {
        throw createAssetServerCompilationError(
          `Failed to resolve import "${specifier}" in ${importerPath}. ` +
            `Ensure it resolves to a file within the configured asset server routes, or mark it as external.`,
          {
            code: 'IMPORT_RESOLUTION_FAILED',
          },
        )
      }

      resolvedBySpecifier.set(specifier, {
        absolutePath:
          resolutionResult.path && path.isAbsolute(resolutionResult.path)
            ? normalizeFilePath(resolutionResult.path)
            : null,
        packageJsonPath: resolutionResult.packageJsonPath
          ? normalizeFilePath(resolutionResult.packageJsonPath)
          : null,
        specifier,
      })
    }
  } catch (error) {
    if (isAssetServerCompilationError(error) && error.code === 'IMPORT_RESOLUTION_FAILED') {
      throw error
    }

    throw createAssetServerCompilationError(
      `Failed to resolve imports in ${importerPath}. ${formatUnknownError(error)}`,
      {
        cause: error,
        code: 'IMPORT_RESOLUTION_FAILED',
      },
    )
  }

  return resolvedBySpecifier
}

function getUniqueSpecifiers(unresolvedImports: TransformedModule['unresolvedImports']): string[] {
  return [...new Set(unresolvedImports.map((unresolved) => unresolved.specifier))]
}

function formatUnknownError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function failResolve(
  error: unknown,
  trackedFiles: ReadonlySet<string>,
  trackedResolutions: readonly TrackedResolution[],
  importerPath: string,
  trackedResolution?: RelativeImportResolution | null,
): ResolveResult {
  return {
    ok: false,
    error: toResolveError(error, importerPath),
    tracking: {
      trackedFiles: [...trackedFiles],
      trackedResolutions: appendFailedTrackedResolution(trackedResolutions, trackedResolution),
    },
  }
}

function appendFailedTrackedResolution(
  trackedResolutions: readonly TrackedResolution[],
  trackedResolution: RelativeImportResolution | null | undefined,
): TrackedResolution[] {
  if (trackedResolution == null) return [...trackedResolutions]

  return [
    ...trackedResolutions,
    {
      ...trackedResolution,
      resolvedIdentityPath: null,
    },
  ]
}

function toResolveError(error: unknown, importerPath: string): AssetServerCompilationError {
  if (isAssetServerCompilationError(error)) return error

  return createAssetServerCompilationError(
    `Failed to resolve imports in ${importerPath}. ${formatUnknownError(error)}`,
    {
      cause: error,
      code: 'IMPORT_RESOLUTION_FAILED',
    },
  )
}
