import * as fs from 'node:fs'
import * as path from 'node:path'

/**
 * Builds a reverse lookup from npm specifier to canonical `remix/*` path by
 * scanning workspace packages and expanding the manifest against their names.
 *
 * Literal entries map directly: `"remix/router": "@remix-run/fetch-router"`
 *   → `@remix-run/fetch-router` → `remix/router`
 *
 * Pattern entries expand against every package name:
 *   `"remix/middleware/$1": "@remix-run/([a-z-]+)-middleware"`
 *   → `@remix-run/csrf-middleware` → `remix/middleware/csrf`
 *   → `@remix-run/cors-middleware` → `remix/middleware/cors`
 *   → …
 *
 * Sub-path specifiers (e.g. `@remix-run/session/cookie-storage`) are covered
 * by literal entries whose values include a `/`.
 */
export function buildSpecifierToRemixPath(
  manifest: Record<string, string>,
  packagesDir: string,
): Map<string, string> {
  let workspacePackageNames = fs
    .readdirSync(packagesDir)
    .filter((dir) => fs.existsSync(path.join(packagesDir, dir, 'package.json')))
    .map((dir) => {
      let pkg: { name: string } = JSON.parse(
        fs.readFileSync(path.join(packagesDir, dir, 'package.json'), 'utf-8'),
      )
      return pkg.name
    })
    .filter((name) => name.startsWith('@remix-run/'))

  let result = new Map<string, string>()
  for (let [key, value] of Object.entries(manifest)) {
    if (value.includes('(')) {
      // Pattern entry: value is a regex matched against package names.
      let regex = new RegExp(`^${value}$`)
      for (let pkgName of workspacePackageNames) {
        let m = pkgName.match(regex)
        if (m) {
          let concreteKey = key.replace(/\$(\d+)/g, (_, n) => m[Number(n)] ?? '')
          result.set(pkgName, concreteKey)
        }
      }
    } else {
      // Literal entry: value is the full specifier (package or package/subpath).
      result.set(value, key)
    }
  }
  return result
}

/** Read and parse a manifest.json file. */
export function readManifest(manifestPath: string): Record<string, string> {
  return JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
}
