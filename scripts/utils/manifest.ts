import * as fs from 'node:fs'
import * as path from 'node:path'

/**
 * Builds a reverse lookup from npm specifier to canonical `remix/*` path.
 * Reads the explicit manifest and inverts it.
 *
 * When multiple `remix/*` paths map to the same specifier (e.g. `remix/router`
 * and `remix/fetch-router` both map to `@remix-run/fetch-router`), the
 * non-1:1 mapping is preferred as canonical. A 1:1 mapping is one where the
 * `remix/` path suffix exactly matches the `@remix-run/` specifier suffix
 * (e.g. `remix/fetch-router` → `@remix-run/fetch-router`).
 *
 * If 3+ remix paths map to the same specifier, an error is thrown — the
 * manifest has an ambiguity that must be resolved explicitly.
 */
export function buildSpecifierToRemixPath(packagesDir: string): Map<string, string> {
  let manifest: Record<string, string> = JSON.parse(
    fs.readFileSync(path.join(packagesDir, 'remix', 'manifest.json'), 'utf-8'),
  )

  // Collect all remix paths per specifier first.
  let specifierToPaths = new Map<string, string[]>()
  for (let [remixPath, specifier] of Object.entries(manifest)) {
    if (remixPath.startsWith('_')) continue
    let existing = specifierToPaths.get(specifier) ?? []
    specifierToPaths.set(specifier, [...existing, remixPath])
  }

  let result = new Map<string, string>()
  for (let [specifier, remixPaths] of specifierToPaths) {
    if (remixPaths.length === 1) {
      result.set(specifier, remixPaths[0])
      continue
    }

    if (remixPaths.length > 2) {
      throw new Error(
        `manifest.json: specifier "${specifier}" is mapped by ${remixPaths.length} remix paths ` +
          `(${remixPaths.join(', ')}). At most 2 are allowed (one canonical, one legacy alias).`,
      )
    }

    // Exactly 2: prefer the non-1:1 (canonical) mapping.
    let shortSpecifier = specifier.replace('@remix-run/', '')
    let canonical = remixPaths.find((rp) => rp.replace('remix/', '') !== shortSpecifier)
    result.set(specifier, canonical ?? remixPaths[0])
  }

  return result
}
