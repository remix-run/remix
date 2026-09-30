import * as path from 'node:path'
import * as url from 'node:url'
import { buildSpecifierToRemixPath, readRemixManifest } from '../../../../scripts/utils/manifest.ts'

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))
const packagesDir = path.resolve(__dirname, '../../../../packages')

const specifierMap = buildSpecifierToRemixPath(packagesDir)
const excludedPackages = readRemixManifest(packagesDir).excludedPackages

/**
 * Maps a full npm specifier (e.g. `@remix-run/fetch-router` or
 * `@remix-run/session/cookie-storage`) to its canonical `remix/*` import path
 * (e.g. `remix/router` or `remix/session-storage/cookie`).
 *
 * Excluded standalone packages retain their full npm specifier. Other
 * unrecognised packages fall back to the mechanical `remix/<short-name>` path.
 */
export function mapToRemixPackage(specifier: string): string {
  if (isExcludedRemixPackage(specifier)) return specifier
  return specifierMap.get(specifier) ?? specifier.replace(/^@remix-run\//, 'remix/')
}

export function hasRemixPackage(specifier: string): boolean {
  return specifierMap.has(specifier)
}

export function isExcludedRemixPackage(specifier: string): boolean {
  return excludedPackages.some(
    (packageName) => specifier === packageName || specifier.startsWith(`${packageName}/`),
  )
}
