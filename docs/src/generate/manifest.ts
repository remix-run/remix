import * as fs from 'node:fs'
import * as path from 'node:path'
import * as url from 'node:url'

const manifestPath = path.resolve(
  path.dirname(url.fileURLToPath(import.meta.url)),
  '../../../packages/remix/manifest.json',
)

const manifestRaw: Record<string, string> = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))

/**
 * Resolves a full npm specifier (e.g. `@remix-run/fetch-router` or
 * `@remix-run/session/cookie-storage`) to its canonical `remix/*` import path
 * (e.g. `remix/router` or `remix/session-storage/cookie`).
 *
 * Pattern entries in the manifest (value contains a capture group) are matched
 * against workspace package names at build time. Literal entries are matched
 * exactly. Falls back to the mechanical `remix/<short-name>` path when no
 * manifest entry covers the specifier.
 */
export function resolveRemixPath(specifier: string): string {
  // Check literal entries first (both bare package and subpath specifiers).
  for (let [key, value] of Object.entries(manifestRaw)) {
    if (value.includes('(')) continue // pattern entry — skip for now
    if (value === specifier) return key.replace(/^remix\//, '')
  }

  // Check pattern entries: value is a regex matched against the package name
  // portion of the specifier.
  let [pkgScope, pkgShort, ...subParts] = specifier.split('/')
  let pkgName = pkgScope.startsWith('@') ? `${pkgScope}/${pkgShort}` : pkgScope
  let subpath = subParts.length > 0 ? subParts.join('/') : undefined

  for (let [key, value] of Object.entries(manifestRaw)) {
    if (!value.includes('(')) continue
    let regex = new RegExp(`^${value}$`)
    let m = pkgName.match(regex)
    if (m) {
      let concreteKey = key.replace(/\$(\d+)/g, (_, n) => m[Number(n)] ?? '')
      // For sub-path specifiers (e.g. @remix-run/fetch-router/routes) the
      // pattern covers the package root; the key already encodes the full path.
      let resolved = concreteKey.replace(/^remix\//, '')
      return subpath ? `${resolved}/${subpath}` : resolved
    }
  }

  // Mechanical fallback: @remix-run/<short> → remix/<short>
  return specifier.replace(/^@remix-run\//, '')
}
