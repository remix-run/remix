import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import * as fs from 'node:fs'
import * as path from 'node:path'
import * as url from 'node:url'

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))
const packagesDir = path.resolve(__dirname, '..')

const manifest: Record<string, string> = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'manifest.json'), 'utf-8'),
)

// --- Pattern support ---
// A pattern entry has capture groups in the value, e.g.:
//   "remix/middleware/$1": "@remix-run/([a-z-]+)-middleware"
// The value regex is matched against workspace package names; capture groups
// are substituted into the key via $1, $2, ... to produce concrete entries.

function isPatternEntry(value: string): boolean {
  return value.includes('(')
}

function expandPatternEntry(
  keyPattern: string,
  valuePattern: string,
  packageNames: string[],
): Array<[string, string]> {
  let regex = new RegExp(`^${valuePattern}$`)
  let results: Array<[string, string]> = []
  for (let pkgName of packageNames) {
    let m = pkgName.match(regex)
    if (m) {
      let concreteKey = keyPattern.replace(/\$(\d+)/g, (_, n) => m[Number(n)] ?? '')
      results.push([concreteKey, pkgName])
    }
  }
  return results
}

// Collect all workspace package names by scanning the packages directory.
const workspacePackageNames: string[] = fs
  .readdirSync(packagesDir)
  .filter(dir => fs.existsSync(path.join(packagesDir, dir, 'package.json')))
  .map(dir => {
    let pkg: { name: string } = JSON.parse(
      fs.readFileSync(path.join(packagesDir, dir, 'package.json'), 'utf-8'),
    )
    return pkg.name
  })

// Expand pattern entries alongside literal entries to form the effective manifest.
const effectiveManifest: Record<string, string> = {}
for (let [key, value] of Object.entries(manifest)) {
  if (isPatternEntry(value)) {
    for (let [k, v] of expandPatternEntry(key, value, workspacePackageNames)) {
      effectiveManifest[k] = v
    }
  } else {
    effectiveManifest[key] = value
  }
}

// --- Helpers ---

// A specifier like "@remix-run/session/cookie-storage" belongs to "@remix-run/session".
function packageNameFromSpecifier(specifier: string): string {
  let parts = specifier.split('/')
  return parts[0].startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0]
}

function shortName(packageName: string): string {
  return packageName.replace('@remix-run/', '')
}

// The import specifier for a package's export.
// "." -> "@remix-run/pkg", "./sub" -> "@remix-run/pkg/sub"
function exportSpecifier(packageName: string, exportPath: string): string {
  return exportPath === '.' ? packageName : `${packageName}/${exportPath.replace('./', '')}`
}

// Build a reverse lookup: specifier -> remix canonical path(s) from effective manifest.
const specifierToRemixPaths = new Map<string, string[]>()
for (let [remixPath, specifier] of Object.entries(effectiveManifest)) {
  let existing = specifierToRemixPaths.get(specifier) ?? []
  specifierToRemixPaths.set(specifier, [...existing, remixPath])
}

const referencedPackages = new Set(Object.values(effectiveManifest).map(packageNameFromSpecifier))

// --- Tests ---

describe('manifest', () => {
  it('every pattern entry matches at least one workspace package', () => {
    for (let [keyPattern, valuePattern] of Object.entries(manifest)) {
      if (!isPatternEntry(valuePattern)) continue
      let expanded = expandPatternEntry(keyPattern, valuePattern, workspacePackageNames)
      assert.ok(
        expanded.length > 0,
        `Pattern entry "${keyPattern}": "${valuePattern}" did not match any workspace package`,
      )
    }
  })

  it('every manifest value references a real export in its package', () => {
    for (let [remixPath, specifier] of Object.entries(effectiveManifest)) {
      let pkgName = packageNameFromSpecifier(specifier)
      let short = shortName(pkgName)
      let pkgJsonPath = path.join(packagesDir, short, 'package.json')

      assert.ok(
        fs.existsSync(pkgJsonPath),
        `manifest entry "${remixPath}" references package "${pkgName}" but no package.json found at packages/${short}/package.json`,
      )

      let pkgJson: { exports?: Record<string, unknown> } = JSON.parse(
        fs.readFileSync(pkgJsonPath, 'utf-8'),
      )
      let packageExports = pkgJson.exports ?? {}

      let exportKey =
        specifier === pkgName ? '.' : `./${specifier.slice(pkgName.length + 1)}`

      assert.ok(
        exportKey in packageExports,
        `manifest entry "${remixPath}" maps to "${specifier}" but "${exportKey}" is not an export of ${pkgName}`,
      )
    }
  })

  it('all exports of every referenced package are covered', () => {
    for (let pkgName of referencedPackages) {
      let short = shortName(pkgName)
      let pkgJsonPath = path.join(packagesDir, short, 'package.json')
      let pkgJson: { exports?: Record<string, unknown> } = JSON.parse(
        fs.readFileSync(pkgJsonPath, 'utf-8'),
      )

      for (let exportPath of Object.keys(pkgJson.exports ?? {})) {
        if (exportPath === './package.json') continue

        let specifier = exportSpecifier(pkgName, exportPath)

        // Every export of a package that appears anywhere in the manifest must
        // itself appear as a value in the manifest. There is no mechanical
        // fallback: once a package is referenced by a canonical remix path,
        // all its exports must be explicitly mapped.
        assert.ok(
          specifierToRemixPaths.has(specifier),
          `Export "${exportPath}" of ${pkgName} (specifier "${specifier}") is not covered by ` +
            `any manifest entry. Add an entry mapping a canonical remix path to "${specifier}".`,
        )
      }
    }
  })
})
