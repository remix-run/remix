import * as fs from 'node:fs'
import * as path from 'node:path'

/**
 * Builds a reverse lookup from npm specifier to canonical `remix/*` path.
 * Reads the explicit manifest and inverts it. When multiple remix paths map
 * to the same specifier (e.g. `remix/router` and `remix/fetch-router` both
 * map to `@remix-run/fetch-router`), the first occurrence wins — canonical
 * entries are listed before legacy aliases in manifest.json.
 */
export function buildSpecifierToRemixPath(packagesDir: string): Map<string, string> {
  let manifest: Record<string, string> = JSON.parse(
    fs.readFileSync(path.join(packagesDir, 'remix', 'manifest.json'), 'utf-8'),
  )

  let result = new Map<string, string>()
  for (let [remixPath, specifier] of Object.entries(manifest)) {
    if (remixPath.startsWith('_')) continue // skip comment/metadata keys
    if (!result.has(specifier)) {
      result.set(specifier, remixPath)
    }
  }
  return result
}
