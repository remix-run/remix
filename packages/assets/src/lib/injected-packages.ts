import * as fs from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { getFilePathDirectory, normalizeFilePath } from './paths.ts'

type ResolvedInjectedPackage = {
  packageJsonPath: string
  packageRoot: string
}

const injectedPackageNames = ['@oxc-project/runtime'] as const
const injectedPackagesBasePath = '/__@remix/injected'

const resolvedInjectedPackages = new Map<string, ResolvedInjectedPackage>()

export function isInjectedPackageFilePath(filePath: string): boolean {
  let normalizedFilePath = normalizeFilePath(filePath)

  for (let packageName of injectedPackageNames) {
    let packageRoot = getResolvedInjectedPackage(packageName).packageRoot
    if (normalizedFilePath === packageRoot || normalizedFilePath.startsWith(`${packageRoot}/`)) {
      return true
    }
  }

  return false
}

export function getInjectedPackageRouteConfigs(): {
  fileMap: Record<string, string>
  rootDir: string
}[] {
  return injectedPackageNames.map((packageName) => {
    let { packageRoot } = getResolvedInjectedPackage(packageName)

    return {
      fileMap: {
        [getInjectedPackageRoutePattern(packageName)]: `${packageName}/*path`,
      },
      rootDir: getInjectedPackageRouteRoot(packageRoot, packageName),
    }
  })
}

export function getInjectedPackageNameForSpecifier(specifier: string): string | null {
  for (let packageName of injectedPackageNames) {
    if (specifier === packageName || specifier.startsWith(`${packageName}/`)) {
      return packageName
    }
  }

  return null
}

export function mayContainInjectedPackageSpecifier(sourceText: string): boolean {
  return injectedPackageNames.some((packageName) => sourceText.includes(packageName))
}

export function maskAuthoredInjectedPackageSpecifier(specifier: string): string | null {
  let packageName = getInjectedPackageNameForSpecifier(specifier)
  if (!packageName) return null

  let maskedPackageName = getMaskedInjectedPackageName(packageName)
  return `${maskedPackageName}${specifier.slice(packageName.length)}`
}

export function restoreAuthoredInjectedPackageSpecifier(specifier: string): string | null {
  for (let packageName of injectedPackageNames) {
    let maskedPackageName = getMaskedInjectedPackageName(packageName)
    if (specifier === maskedPackageName) {
      return packageName
    }
    if (specifier.startsWith(`${maskedPackageName}/`)) {
      return `${packageName}${specifier.slice(maskedPackageName.length)}`
    }
  }

  return null
}

function getMaskedInjectedPackageName(packageName: string): string {
  return `~${packageName.slice(1)}`
}

export function getInjectedPackageImporterPath(): string {
  return normalizeFilePath(fileURLToPath(import.meta.url))
}

function getResolvedInjectedPackage(packageName: string): ResolvedInjectedPackage {
  let existing = resolvedInjectedPackages.get(packageName)
  if (existing) return existing

  let packageJsonUrl = resolveInjectedPackageJsonUrl(packageName)
  let packageJsonPath = normalizeFilePath(fs.realpathSync(fileURLToPath(packageJsonUrl)))

  let resolvedInjectedPackage = {
    packageJsonPath,
    packageRoot: normalizeFilePath(fs.realpathSync(getFilePathDirectory(packageJsonPath))),
  }

  resolvedInjectedPackages.set(packageName, resolvedInjectedPackage)
  return resolvedInjectedPackage
}

export function resolveInjectedPackageJsonUrl(
  packageName: string,
  resolve: ((specifier: string) => string) | undefined = import.meta.resolve,
): string {
  if (typeof resolve === 'function') {
    return resolve(`${packageName}/package.json`)
  }

  let require = createRequire(import.meta.url)
  return pathToFileURL(require.resolve(`${packageName}/package.json`)).href
}

function getInjectedPackageRoutePattern(packageName: string): string {
  return `${injectedPackagesBasePath}/${packageName}/*path`
}

function getInjectedPackageRouteRoot(packageRoot: string, packageName: string): string {
  let routeRoot = packageRoot

  for (let _segment of packageName.split('/')) {
    routeRoot = getFilePathDirectory(routeRoot)
  }

  return routeRoot
}
