import * as fs from 'node:fs'
import * as path from 'node:path'

/**
 * Builds a reverse lookup from npm specifier to canonical `remix/*` path.
 * Reads the explicit manifest and inverts it.
 *
 * Each npm specifier must map to exactly one canonical `remix/*` path.
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
    if (remixPaths.length > 1) {
      throw new Error(
        `manifest.json: specifier "${specifier}" is mapped by ${remixPaths.length} remix paths ` +
          `(${remixPaths.join(', ')}). Expected exactly one canonical remix path.`,
      )
    }

    result.set(specifier, remixPaths[0])
  }

  return result
}
