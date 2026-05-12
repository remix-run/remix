import * as path from 'node:path'
import * as url from 'node:url'
import {
  buildSpecifierToRemixPath,
  readManifest,
  readWorkspacePackageNames,
} from '../../../scripts/utils/manifest.ts'

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))
const packagesDir = path.resolve(__dirname, '../../../../packages')
const manifestPath = path.resolve(packagesDir, 'remix/manifest.json')

const manifest = readManifest(manifestPath)
const packageNames = readWorkspacePackageNames(packagesDir)
const specifierMap = buildSpecifierToRemixPath(manifest, packageNames)

/**
 * Maps a full npm specifier (e.g. `@remix-run/fetch-router` or
 * `@remix-run/session/cookie-storage`) to its canonical `remix/*` import path
 * (e.g. `remix/router` or `remix/session-storage/cookie`).
 *
 * Falls back to the mechanical `remix/<short-name>` path when no manifest
 * entry covers the specifier.
 */
export function mapToRemixPackage(specifier: string): string {
  // Direct hit (literal entries and pattern-expanded package names).
  let direct = specifierMap.get(specifier)
  if (direct) return direct

  // Sub-path specifier (e.g. `@remix-run/fetch-router/routes`): check the
  // package root against the map and append the subpath.
  let parts = specifier.split('/')
  if (parts.length > 2) {
    let pkgName = `${parts[0]}/${parts[1]}`
    let subpath = parts.slice(2).join('/')
    let pkgKey = specifierMap.get(pkgName)
    if (pkgKey) return `${pkgKey}/${subpath}`
  }

  // Mechanical fallback.
  return specifier.replace(/^@remix-run\//, 'remix/')
}
