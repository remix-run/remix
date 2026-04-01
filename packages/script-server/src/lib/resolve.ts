import * as fs from 'node:fs'
import * as path from 'node:path'
import type { ResolverFactory } from 'oxc-resolver'

import {
  ScriptServerCompilationError,
  createScriptServerCompilationError,
  isScriptServerCompilationError,
} from './compilation-error.ts'
import { normalizeFilePath } from './paths.ts'
import type { CompiledRoutes } from './routes.ts'
import type { ModuleRecord } from './store.ts'
import type { ResolveModuleResult, TransformedModule } from './transform.ts'

export const resolverExtensionAlias = {
  '.js': ['.js', '.ts', '.tsx', '.jsx'],
  '.jsx': ['.jsx', '.tsx'],
  '.mjs': ['.mjs', '.mts'],
} satisfies Record<string, string[]>

export const resolverExtensions = ['.ts', '.tsx', '.js', '.jsx', '.mts', '.mjs']
export const supportedScriptExtensions = ['.ts', '.tsx', '.js', '.jsx', '.mts', '.mjs']

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
  fingerprint: string
  identityPath: string
  imports: ResolvedImport[]
  trackedFiles: string[]
  trackedResolutions: TrackedResolution[]
  rawCode: string
  resolvedPath: string
  sourcemap: string | null
  stableUrlPathname: string
}

export type FailedResolution = {
  trackedFiles: readonly string[]
  trackedResolutions: readonly TrackedResolution[]
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

export class FailedResolutionError extends ScriptServerCompilationError {
  failedResolution: FailedResolution

  constructor(
    message: string,
    options: {
      cause?: unknown
      code: 'IMPORT_RESOLUTION_FAILED' | 'IMPORT_NOT_SUPPORTED' | 'IMPORT_NOT_ALLOWED'
      failedResolution: FailedResolution
    },
  ) {
    super(message, {
      cause: options.cause,
      code: options.code,
    })
    this.name = 'FailedResolutionError'
    this.failedResolution = options.failedResolution
  }
}

export function isFailedResolutionError(error: unknown): error is FailedResolutionError {
  return error instanceof FailedResolutionError
}

export async function resolveModule(
  record: ModuleRecord,
  transformed: TransformedModule,
  args: ResolveArgs,
): Promise<ResolvedModule> {
  let resolvedImports =
    transformed.unresolvedImports.length > 0
      ? await batchResolveSpecifiers(
          getUniqueSpecifiers(transformed.unresolvedImports),
          transformed.resolvedPath,
          args.resolverFactory,
        )
      : new Map<string, ResolvedSpec>()

  let importsWithPaths: ResolvedImport[] = []
  let deps = new Set<string>()
  let trackedFiles = new Set(transformed.trackedFiles)
  let trackedResolutions: TrackedResolution[] = []

  for (let unresolved of transformed.unresolvedImports) {
    let trackedResolution = getTrackedRelativeImportResolution(
      transformed.importerDir,
      unresolved.specifier,
    )

    let resolvedSpec = resolvedImports.get(unresolved.specifier)
    if (!resolvedSpec?.absolutePath) {
      if (trackedResolution) {
        trackedResolutions.push({
          ...trackedResolution,
          resolvedIdentityPath: null,
        })
      }
      throw new FailedResolutionError(
        `Failed to resolve import "${unresolved.specifier}" in ${transformed.resolvedPath}.\n\n` +
          `Ensure it resolves to a file within the configured script-server routes, or mark it as external.`,
        {
          code: 'IMPORT_RESOLUTION_FAILED',
          failedResolution: {
            trackedFiles: [...trackedFiles],
            trackedResolutions,
          },
        },
      )
    }

    let resolvedImport = args.resolveModulePath(resolvedSpec.absolutePath)
    if (!resolvedImport) {
      if (trackedResolution) {
        trackedResolutions.push({
          ...trackedResolution,
          resolvedIdentityPath: null,
        })
      }
      throw new FailedResolutionError(
        `Resolved import "${unresolved.specifier}" in ${transformed.resolvedPath} is not a supported script module.\n\n` +
          `Supported extensions are ${supportedScriptExtensions.join(', ')}.`,
        {
          code: 'IMPORT_NOT_SUPPORTED',
          failedResolution: {
            trackedFiles: [...trackedFiles],
            trackedResolutions,
          },
        },
      )
    }

    if (!args.isAllowed(resolvedImport.identityPath)) {
      if (trackedResolution) {
        trackedResolutions.push({
          ...trackedResolution,
          resolvedIdentityPath: null,
        })
      }
      throw new FailedResolutionError(
        `Resolved import "${unresolved.specifier}" in ${transformed.resolvedPath} points outside the script-server routing/allow configuration.\n\n` +
          `Add a matching route and allow rule, or mark this import as external.`,
        {
          code: 'IMPORT_NOT_ALLOWED',
          failedResolution: {
            trackedFiles: [...trackedFiles],
            trackedResolutions,
          },
        },
      )
    }

    let stableUrlPathname = args.routes.toUrlPathname(resolvedImport.identityPath)
    if (!stableUrlPathname) {
      if (trackedResolution) {
        trackedResolutions.push({
          ...trackedResolution,
          resolvedIdentityPath: null,
        })
      }
      throw new FailedResolutionError(
        `Resolved import "${unresolved.specifier}" in ${transformed.resolvedPath} points outside the script-server routing/allow configuration.\n\n` +
          `Add a matching route and allow rule, or mark this import as external.`,
        {
          code: 'IMPORT_NOT_ALLOWED',
          failedResolution: {
            trackedFiles: [...trackedFiles],
            trackedResolutions,
          },
        },
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
    deps: [...deps],
    fingerprint: transformed.fingerprint,
    identityPath: record.identityPath,
    imports: importsWithPaths,
    trackedFiles: [...trackedFiles],
    trackedResolutions,
    rawCode: transformed.rawCode,
    resolvedPath: transformed.resolvedPath,
    sourcemap: transformed.sourcemap,
    stableUrlPathname: transformed.stableUrlPathname,
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
        throw createScriptServerCompilationError(
          `Failed to resolve import "${specifier}" in ${importerPath}.\n\n` +
            `Ensure it resolves to a file within the configured script-server routes, or mark it as external.`,
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
    if (isScriptServerCompilationError(error) && error.code === 'IMPORT_RESOLUTION_FAILED') {
      throw error
    }

    throw createScriptServerCompilationError(
      `Failed to resolve imports in ${importerPath}.\n\n${formatUnknownError(error)}`,
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
