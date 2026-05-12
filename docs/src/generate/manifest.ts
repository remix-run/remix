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
 * Resolves a full npm specifier (e.g. `@remix-run/fetch-router` or
 * `@remix-run/session/cookie-storage`) to its canonical `remix/*` import path
 * (e.g. `remix/router` or `remix/session-storage/cookie`).
 *
 * Falls back to the mechanical `remix/<short-name>` path when no manifest
 * entry covers the specifier.
 */
export function resolveRemixPath(specifier: string): string {
  // Direct hit (literal entries and pattern-expanded package names).
  let direct = specifierMap.get(specifier)
  if (direct) return direct.replace(/^remix\//, '')

  // Sub-path specifier whose package root matched a pattern entry:
  // e.g. `@remix-run/fetch-router/routes` — check the bare package name.
  let slashIdx = specifier.lastIndexOf('/')
  let pkgName = specifier.startsWith('@')
    ? specifier.slice(0, specifier.indexOf('/', 1))
    : specifier.slice(0, slashIdx)
  let subpath = specifier.slice(pkgName.length + 1) // strip leading "/"

  if (subpath) {
    let pkgKey = specifierMap.get(pkgName)
    if (pkgKey) return `${pkgKey.replace(/^remix\//, '')}/${subpath}`
  }

  // Mechanical fallback.
  return specifier.replace(/^@remix-run\//, '')
}
