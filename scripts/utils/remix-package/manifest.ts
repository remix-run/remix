import * as fs from 'node:fs'
import * as path from 'node:path'

export interface RemixManifest {
  exports: Record<string, string>
  excludedPackages: string[]
}

export function readRemixManifest(packagesDir: string): RemixManifest {
  let manifestPath = path.join(packagesDir, 'remix', 'manifest.json')
  let value: unknown = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('manifest.json must contain an object')
  }

  let record = value as Record<string, unknown>
  let excludedValue = record._exclude ?? []
  if (!Array.isArray(excludedValue) || !excludedValue.every((item) => typeof item === 'string')) {
    throw new Error('manifest.json: "_exclude" must be an array of package names')
  }

  let exports: Record<string, string> = {}
  for (let [remixPath, specifier] of Object.entries(record)) {
    if (remixPath.startsWith('_')) continue
    if (typeof specifier !== 'string') {
      throw new Error(`manifest.json: "${remixPath}" must map to a package specifier`)
    }
    exports[remixPath] = specifier
  }

  return { exports, excludedPackages: excludedValue }
}

/**
 * Builds a reverse lookup from npm specifier to canonical `remix/*` path.
 * Reads the explicit manifest and inverts it.
 *
 * Each npm specifier must map to exactly one canonical `remix/*` path.
 */
export function buildSpecifierToRemixPath(packagesDir: string): Map<string, string> {
  let manifest = readRemixManifest(packagesDir).exports

  // Collect all remix paths per specifier first.
  let specifierToPaths = new Map<string, string[]>()
  for (let [remixPath, specifier] of Object.entries(manifest)) {
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
